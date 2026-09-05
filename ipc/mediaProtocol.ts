import { protocol } from 'electron';
import fs from 'fs';
import path from 'path';
import { normalizePathForSystem } from '../pathUtils';

export function getMediaMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mkv':
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.aac':
      return 'audio/aac';
    case '.m4a':
      return 'audio/mp4';
    case '.ogg':
    case '.oga':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    case '.opus':
      return 'audio/opus';
    default:
      return 'application/octet-stream';
  }
}

export function registerMediaProtocol(): void {
  protocol.handle('media', (request) => {
    // Handle CORS preflight if ever sent
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Accept-Encoding',
          'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
        },
      });
    }

    try {
      let filePath = '';
      try {
        const parsedUrl = new URL(request.url);
        const qPath = parsedUrl.searchParams.get('path');
        filePath = normalizePathForSystem(qPath || request.url);
      } catch (e) {
        filePath = normalizePathForSystem(request.url);
      }

      if (!filePath || filePath.includes('\0')) {
        return new Response('Invalid media file path', {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      const resolvedPath = path.resolve(filePath);

      if (!fs.existsSync(resolvedPath)) {
        console.warn('[protocol:media] File not found:', resolvedPath);
        return new Response('Media file not found', {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(resolvedPath);
      } catch (statErr: any) {
        console.warn('[protocol:media] Failed to stat file:', resolvedPath, statErr?.message || statErr);
        return new Response('Cannot access media file', {
          status: 403,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (!stat.isFile()) {
        return new Response('Path is not a regular file', {
          status: 403,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      const fileSize = stat.size;
      const rangeHeader = request.headers.get('range');
      const mime = getMediaMimeType(resolvedPath);

      const baseHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Accept-Encoding',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
        'Accept-Ranges': 'bytes',
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
      };

      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const rawStart = parseInt(parts[0], 10);
        let start = isNaN(rawStart) ? 0 : rawStart;
        const rawEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        let end = isNaN(rawEnd) ? fileSize - 1 : rawEnd;

        // HTTP 416 Range Not Satisfiable
        if (start >= fileSize || start < 0 || end < start) {
          return new Response(null, {
            status: 416,
            statusText: 'Range Not Satisfiable',
            headers: {
              ...baseHeaders,
              'Content-Range': `bytes */${fileSize}`,
            },
          });
        }

        end = Math.min(end, fileSize - 1);
        const chunkSize = end - start + 1;

        const nodeStream = fs.createReadStream(resolvedPath, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', (chunk) => controller.enqueue(chunk));
            nodeStream.on('end', () => {
              try { controller.close(); } catch {}
            });
            nodeStream.on('error', (err) => {
              try { controller.error(err); } catch {}
            });
          },
          cancel() {
            nodeStream.destroy();
          },
        });

        return new Response(webStream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': chunkSize.toString(),
          },
        });
      }

      const nodeStream = fs.createReadStream(resolvedPath);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => {
            try { controller.close(); } catch {}
          });
          nodeStream.on('error', (err) => {
            try { controller.error(err); } catch {}
          });
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      return new Response(webStream, {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': fileSize.toString(),
        },
      });
    } catch (err: any) {
      console.error('[protocol:media] Error serving media stream:', err?.message || err);
      return new Response('Media file stream error', {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  });
}

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
    default:
      return 'application/octet-stream';
  }
}

export function registerMediaProtocol(): void {
  protocol.handle('media', (request) => {
    try {
      let filePath = '';
      try {
        const parsedUrl = new URL(request.url);
        const qPath = parsedUrl.searchParams.get('path');
        filePath = normalizePathForSystem(qPath || request.url);
      } catch {
        filePath = normalizePathForSystem(request.url);
      }

      if (!fs.existsSync(filePath)) {
        console.warn('[protocol:media] File not found:', filePath, 'from:', request.url);
        return new Response('Media file not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('range');
      const mime = getMediaMimeType(filePath);

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', (chunk) => controller.enqueue(chunk));
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', (err) => controller.error(err));
          },
          cancel() {
            nodeStream.destroy();
          },
        });

        return new Response(webStream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': mime,
          },
        });
      }

      const nodeStream = fs.createReadStream(filePath);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk) => controller.enqueue(chunk));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Content-Type': mime,
        },
      });
    } catch (err) {
      console.error('[protocol:media] Error serving media stream:', err);
      return new Response('Media file stream error', { status: 500 });
    }
  });
}

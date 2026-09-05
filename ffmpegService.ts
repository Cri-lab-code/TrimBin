import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn, execFile } from 'child_process';
import { checkFFmpeg, getAugmentedEnv, loadEnginePaths } from './binaryFinder';
import { normalizePathForSystem } from './pathUtils';
import {
  ensureTempDir,
  getTrackedTempPath,
  deleteTempFile,
  deleteTempFileSync,
} from './tempFileManager';

export const PROXY_DIR = ensureTempDir('trimbin_proxies');

export async function safeAtomicRename(src: string, dest: string, maxRetries = 5): Promise<void> {
  let delay = 100;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.promises.rename(src, dest);
      return;
    } catch (err: any) {
      const isLockError = err?.code === 'EBUSY' || err?.code === 'EPERM' || err?.code === 'EACCES';
      const isCrossDevice = err?.code === 'EXDEV';

      if (isCrossDevice) {
        await fs.promises.copyFile(src, dest);
        await fs.promises.unlink(src).catch(() => {});
        return;
      }

      if (isLockError && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      if (attempt === maxRetries) {
        try {
          await fs.promises.copyFile(src, dest);
          await fs.promises.unlink(src).catch(() => {});
          return;
        } catch {
          throw err;
        }
      }

      throw err;
    }
  }
}

export interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  r_frame_rate?: string;
  disposition?: {
    attached_pic?: number;
  };
  tags?: {
    comment?: string;
    [key: string]: string | undefined;
  };
}

export interface FfprobeFormat {
  duration?: string;
  tags?: {
    title?: string;
    TIT2?: string;
    Title?: string;
    artist?: string;
    TPE1?: string;
    album_artist?: string;
    ARTIST?: string;
    Artist?: string;
    album?: string;
    TALB?: string;
    ALBUM?: string;
    Album?: string;
    [key: string]: string | undefined;
  };
}

export interface FfprobeData {
  format?: FfprobeFormat;
  streams?: FfprobeStream[];
}

export interface MediaMetadata {
  isAudioOnly: boolean;
  hasCover: boolean;
  coverDataUrl: string | null;
  title: string;
  artist: string;
  album: string;
  duration: number;
  format: string;
  playbackUrl?: string;
  isProxy?: boolean;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
}

export interface FfmpegExecutionResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function runFfmpegCommand(
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; binaryPath?: string }
): Promise<FfmpegExecutionResult> {
  const ffmpegStatus = await checkFFmpeg(loadEnginePaths().ffmpegPath);
  const ffmpegBin = options?.binaryPath || (ffmpegStatus.available && ffmpegStatus.path ? ffmpegStatus.path : 'ffmpeg');
  const env = options?.env || getAugmentedEnv();

  return new Promise((resolve, reject) => {
    execFile(ffmpegBin, args, { env, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      const outStr = typeof stdout === 'string' ? stdout : stdout ? String(stdout) : '';
      const errStr = typeof stderr === 'string' ? stderr : stderr ? String(stderr) : '';
      if (err && 'code' in err && typeof err.code === 'number') {
        resolve({ stdout: outStr, stderr: errStr, code: err.code });
      } else if (err) {
        reject(err);
      } else {
        resolve({ stdout: outStr, stderr: errStr, code: 0 });
      }
    });
  });
}

export function isWebPlayableVideo(ext: string, videoCodec?: string, audioCodec?: string): boolean {
  const normExt = ext.toLowerCase();

  if (!['.mp4', '.webm'].includes(normExt)) {
    return false;
  }

  const vCodec = (videoCodec || '').toLowerCase();
  const aCodec = (audioCodec || '').toLowerCase();

  const unsupportedVideoCodecs = [
    'prores', 'apcn', 'apch', 'ap4h', 'apco', 'ap4x',
    'dnxhd', 'dnxhr', 'qtrle', 'rawvideo', 'mjpeg',
    'v210', 'v308', 'v408', 'v410', 'yuv4',
    'cineform', 'cfhd', 'mpeg2video', 'dvvideo',
    'indeo', 'wmv3', 'vc1', 'rv40',
  ];

  if (unsupportedVideoCodecs.some((c) => vCodec.includes(c))) {
    return false;
  }

  if (aCodec.startsWith('pcm_') || aCodec === 'lpcm' || aCodec === 'alac' || aCodec === 'eac3') {
    return false;
  }

  return true;
}

const pendingProxyJobs = new Map<string, Promise<{ playbackPath: string; isProxy: boolean }>>();

export async function ensureMediaPreviewProxy(
  rawFilePath: string,
  probeData?: FfprobeData
): Promise<{ playbackPath: string; isProxy: boolean }> {
  const filePath = normalizePathForSystem(rawFilePath);
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { playbackPath: filePath, isProxy: false };
    }

    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    const streams = probeData?.streams || [];
    const videoStream = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
    const audioStream = streams.find((s) => s.codec_type === 'audio');

    const vCodec = (videoStream?.codec_name || '').toLowerCase();
    const aCodec = (audioStream?.codec_name || '').toLowerCase();

    if (isWebPlayableVideo(ext, vCodec, aCodec)) {
      return { playbackPath: filePath, isProxy: false };
    }

    const hash = crypto
      .createHash('md5')
      .update(`v9_${filePath}_${stat.size}_${stat.mtimeMs}`)
      .digest('hex')
      .slice(0, 16);
    const proxyPath = path.join(PROXY_DIR, `proxy_${hash}.mp4`);

    if (fs.existsSync(proxyPath) && fs.statSync(proxyPath).size > 1024) {
      return { playbackPath: proxyPath, isProxy: true };
    }

    if (pendingProxyJobs.has(proxyPath)) {
      return pendingProxyJobs.get(proxyPath)!;
    }

    const jobPromise = (async () => {
      const tempPath = getTrackedTempPath('proxy_tmp', 'mp4', 'trimbin_proxies');
      try {
        const env = getAugmentedEnv();
        const ffmpegStatus = await checkFFmpeg(loadEnginePaths().ffmpegPath);
        const ffmpegBin = ffmpegStatus.available && ffmpegStatus.path ? ffmpegStatus.path : 'ffmpeg';

        const canStreamCopyVideo = ['h264', 'avc1', 'hevc', 'h265', 'av1', 'vp9'].includes(vCodec);

        if (canStreamCopyVideo) {
          const remuxResult = await runFfmpegCommand([
            '-y',
            '-i', filePath,
            '-sn',
            '-dn',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            tempPath,
          ], { env, binaryPath: ffmpegBin });

          if (remuxResult.code === 0 && fs.existsSync(tempPath) && fs.statSync(tempPath).size > 1024) {
            try {
              await safeAtomicRename(tempPath, proxyPath);
              return { playbackPath: proxyPath, isProxy: true };
            } catch (rErr) {
              console.warn('[Auto-Proxy] Remux rename error:', rErr);
            }
          }
          await deleteTempFile(tempPath);
        }

        const transcodeResult = await runFfmpegCommand([
          '-y',
          '-i', filePath,
          '-sn',
          '-dn',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          tempPath,
        ], { env, binaryPath: ffmpegBin });

        if (transcodeResult.code === 0 && fs.existsSync(tempPath) && fs.statSync(tempPath).size > 1024) {
          try {
            await safeAtomicRename(tempPath, proxyPath);
            return { playbackPath: proxyPath, isProxy: true };
          } catch (rErr) {
            console.error('[Auto-Proxy] Rename error:', rErr);
          }
        }
      } catch (err) {
        console.warn('[Auto-Proxy] Error during proxy job:', err);
      } finally {
        await deleteTempFile(tempPath);
        pendingProxyJobs.delete(proxyPath);
      }

      return { playbackPath: filePath, isProxy: false };
    })();

    pendingProxyJobs.set(proxyPath, jobPromise);
    return jobPromise;
  } catch (err) {
    console.warn('[Auto-Proxy] Error during proxy check:', err);
  }

  return { playbackPath: filePath, isProxy: false };
}

export async function sanitizeAudioForAutoEditor(rawFilePath: string): Promise<{ targetPath: string; isTemp: boolean }> {
  const filePath = normalizePathForSystem(rawFilePath);
  const ext = path.extname(filePath).toLowerCase();
  const unsupportedContainerExts = ['.mkv', '.avi', '.wmv', '.flv', '.webm', '.vob'];
  const isVideoExt = ['.mp4', '.mov', '.m4v', ...unsupportedContainerExts].includes(ext);

  if (!isVideoExt) {
    return { targetPath: filePath, isTemp: false };
  }

  const cleanM4aPath = getTrackedTempPath('clean_audio', 'm4a', 'trimbin_previews');

  // Fast AAC audio copy attempt
  const aacResult = await runFfmpegCommand([
    '-y',
    '-i', filePath,
    '-vn',
    '-sn',
    '-c:a', 'copy',
    cleanM4aPath,
  ]);

  if (aacResult.code === 0 && fs.existsSync(cleanM4aPath) && fs.statSync(cleanM4aPath).size > 1024) {
    return { targetPath: cleanM4aPath, isTemp: true };
  }

  // If AAC copy failed, clean up cleanM4aPath and try PCM WAV
  deleteTempFileSync(cleanM4aPath);
  const cleanWavPath = getTrackedTempPath('clean_audio', 'wav', 'trimbin_previews');

  // Fallback to PCM WAV if copy fails
  const wavResult = await runFfmpegCommand([
    '-y',
    '-i', filePath,
    '-vn',
    '-sn',
    '-c:a', 'pcm_s16le',
    '-ar', '44100',
    cleanWavPath,
  ]);

  if (wavResult.code === 0 && fs.existsSync(cleanWavPath) && fs.statSync(cleanWavPath).size > 1024) {
    return { targetPath: cleanWavPath, isTemp: true };
  }

  deleteTempFileSync(cleanWavPath);
  return { targetPath: filePath, isTemp: false };
}

export async function getMediaMetadata(rawFilePath: string): Promise<MediaMetadata> {
  const filePath = normalizePathForSystem(rawFilePath);
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      isAudioOnly: false,
      hasCover: false,
      coverDataUrl: null,
      title: path.basename(filePath || ''),
      artist: '',
      album: '',
      duration: 0,
      format: '',
      playbackUrl: undefined,
    };
  }

  const ffmpegStatus = await checkFFmpeg(loadEnginePaths().ffmpegPath);
  let ffprobeBin = 'ffprobe';
  let ffmpegBin = 'ffmpeg';
  if (ffmpegStatus.available && ffmpegStatus.path) {
    ffmpegBin = ffmpegStatus.path;
    ffprobeBin = ffmpegStatus.path.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
  }

  return new Promise((resolve) => {
    const ext = path.extname(filePath).toLowerCase();
    const isKnownAudioExt = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.aiff', '.wma', '.opus'].includes(ext);
    const env = getAugmentedEnv();

    execFile(ffprobeBin, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ], { env }, (err, stdout) => {
      let probeData: FfprobeData | null = null;
      try {
        if (stdout) probeData = JSON.parse(stdout);
      } catch {}

      const tags = probeData?.format?.tags || {};
      const streams = probeData?.streams || [];
      const videoStream = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic && s.r_frame_rate !== '0/0');
      const hasRealVideo = Boolean(videoStream);
      const isAudioOnly = isKnownAudioExt || !hasRealVideo;

      const title = tags.title || tags.TIT2 || tags.Title || path.basename(filePath, path.extname(filePath));
      const artist = tags.artist || tags.TPE1 || tags.album_artist || tags.ARTIST || tags.Artist || '';
      const album = tags.album || tags.TALB || tags.ALBUM || tags.Album || '';

      let duration = parseFloat(probeData?.format?.duration || '0');
      if ((!duration || isNaN(duration) || duration <= 0) && videoStream?.duration) {
        duration = parseFloat(videoStream.duration);
      }

      const hasAttachedPic = streams.some((s) => s.disposition?.attached_pic === 1 || s.tags?.comment?.toLowerCase().includes('cover'));

      const vCodec = (videoStream?.codec_name || '').toLowerCase();
      const aCodec = (streams.find((s) => s.codec_type === 'audio')?.codec_name || '').toLowerCase();

      const isDirectlyPlayable = isAudioOnly || isWebPlayableVideo(ext, vCodec, aCodec);
      const immediatePlaybackUrl = `media://local/?path=${encodeURIComponent(filePath)}`;

      const finalizeResult = (coverDataUrl: string | null, finalPlaybackUrl?: string, isProxy = false) => {
        resolve({
          isAudioOnly,
          hasCover: Boolean(coverDataUrl),
          coverDataUrl,
          title,
          artist,
          album,
          duration: isNaN(duration) ? 0 : duration,
          format: ext.replace('.', '').toUpperCase(),
          playbackUrl: finalPlaybackUrl || immediatePlaybackUrl,
          isProxy,
          videoCodec: vCodec,
          audioCodec: aCodec,
          width: videoStream?.width,
          height: videoStream?.height,
        });
      };

      if (hasAttachedPic || isAudioOnly) {
        execFile(ffmpegBin, [
          '-y',
          '-i', filePath,
          '-an',
          '-vcodec', 'copy',
          '-f', 'image2pipe',
          '-vframes', '1',
          'pipe:1',
        ], { env, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (ffErr, stdoutBuf) => {
          let coverDataUrl: string | null = null;
          if (!ffErr && stdoutBuf && stdoutBuf.length > 100) {
            const isPng = stdoutBuf[0] === 0x89 && stdoutBuf[1] === 0x50 && stdoutBuf[2] === 0x4E && stdoutBuf[3] === 0x47;
            const mime = isPng ? 'image/png' : 'image/jpeg';
            coverDataUrl = `data:${mime};base64,${stdoutBuf.toString('base64')}`;
          }
          finalizeResult(coverDataUrl, immediatePlaybackUrl, false);
        });
      } else if (!isDirectlyPlayable) {
        const stat = fs.statSync(filePath);
        const hash = crypto
          .createHash('md5')
          .update(`v9_${filePath}_${stat.size}_${stat.mtimeMs}`)
          .digest('hex')
          .slice(0, 16);
        const cachedProxy = path.join(PROXY_DIR, `proxy_${hash}.mp4`);

        if (fs.existsSync(cachedProxy) && fs.statSync(cachedProxy).size > 1024) {
          const cachedUrl = `media://local/?path=${encodeURIComponent(cachedProxy)}`;
          finalizeResult(null, cachedUrl, true);
        } else {
          ensureMediaPreviewProxy(filePath, probeData || undefined).catch(() => {});
          finalizeResult(null, immediatePlaybackUrl, false);
        }
      } else {
        finalizeResult(null, immediatePlaybackUrl, false);
      }
    });
  });
}

export async function analyzeAudioLevels(rawFilePath: string): Promise<{
  success: boolean;
  meanVolume?: number;
  maxVolume?: number;
  suggestedThreshold?: number;
  error?: string;
}> {
  const filePath = normalizePathForSystem(rawFilePath);
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist on disk' };
    }

    const isWin = process.platform === 'win32';
    const nullOut = isWin ? 'NUL' : '/dev/null';

    const result = await runFfmpegCommand([
      '-i', filePath,
      '-af', 'volumedetect',
      '-vn',
      '-sn',
      '-dn',
      '-f', 'null',
      nullOut,
    ]);

    const meanMatch = result.stderr.match(/mean_volume:\s*([-.\d]+)\s*dB/i);
    const maxMatch = result.stderr.match(/max_volume:\s*([-.\d]+)\s*dB/i);

    if (meanMatch) {
      const meanVolume = parseFloat(meanMatch[1]);
      const maxVolume = maxMatch ? parseFloat(maxMatch[1]) : 0;
      const rawThreshold = meanVolume + 6;
      const clampedThreshold = Math.min(-10, Math.max(-50, Math.round(rawThreshold)));

      return {
        success: true,
        meanVolume,
        maxVolume,
        suggestedThreshold: clampedThreshold,
      };
    }

    return {
      success: false,
      error: 'Could not extract audio volume metrics from FFmpeg volumedetect',
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Audio analysis failed';
    return { success: false, error };
  }
}

export async function extractFirstFrame(rawFilePath: string, timestampSec?: number): Promise<string | null> {
  const filePath = normalizePathForSystem(rawFilePath);
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;

    const ffmpegStatus = await checkFFmpeg(loadEnginePaths().ffmpegPath);
    const ffmpegBin = ffmpegStatus.available && ffmpegStatus.path ? ffmpegStatus.path : 'ffmpeg';
    const env = getAugmentedEnv();

    const seekTime = typeof timestampSec === 'number' && timestampSec > 0
      ? timestampSec.toFixed(3)
      : '0.050';

    return await new Promise((resolve) => {
      const args = [
        '-ss', seekTime,
        '-i', filePath,
        '-vframes', '1',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-',
      ];

      const child = spawn(ffmpegBin, args, { env });
      const chunks: Buffer[] = [];

      child.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      child.on('error', () => {
        resolve(null);
      });

      child.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          const buffer = Buffer.concat(chunks);
          if (buffer.length > 100) {
            resolve('data:image/jpeg;base64,' + buffer.toString('base64'));
            return;
          }
        }
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

export async function extractHeadTailFrames(
  rawFilePath: string,
  duration: number
): Promise<{ headFrame: string | null; tailFrame: string | null }> {
  const filePath = normalizePathForSystem(rawFilePath);
  try {
    const headTs = Math.min(1.0, duration * 0.1);
    const tailTs = Math.max(0.1, duration - 1.0);

    const [headFrame, tailFrame] = await Promise.all([
      extractFirstFrame(filePath, headTs),
      extractFirstFrame(filePath, tailTs),
    ]);

    return { headFrame, tailFrame };
  } catch {
    return { headFrame: null, tailFrame: null };
  }
}

import fs from 'fs';
import path from 'path';
import os from 'os';

const activeTempFiles = new Set<string>();

export const BASE_TEMP_DIR = path.join(os.tmpdir(), 'trimbin_temp');

export function ensureTempDir(subDir?: string): string {
  const dir = subDir ? path.join(BASE_TEMP_DIR, subDir) : BASE_TEMP_DIR;
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err: any) {
      if (err?.code !== 'EEXIST') {
        console.warn(`[TempFileManager] Failed to create temp dir "${dir}":`, err?.message || err);
      }
    }
  }
  return dir;
}

export function registerTempFile(filePath: string): string {
  activeTempFiles.add(path.resolve(filePath));
  return filePath;
}

export function unregisterTempFile(filePath: string): void {
  activeTempFiles.delete(path.resolve(filePath));
}

export function getTrackedTempPath(prefix: string, ext: string, subDir?: string): string {
  const dir = ensureTempDir(subDir);
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
  const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}${cleanExt}`;
  const fullPath = path.join(dir, filename);
  registerTempFile(fullPath);
  return fullPath;
}

export async function deleteTempFile(filePath: string): Promise<boolean> {
  const resolved = path.resolve(filePath);
  activeTempFiles.delete(resolved);
  try {
    if (fs.existsSync(resolved)) {
      await fs.promises.unlink(resolved);
      return true;
    }
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.debug(`[TempFileManager] Failed to unlink temp file "${resolved}":`, err?.message || err);
    }
  }
  return false;
}

export function deleteTempFileSync(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  activeTempFiles.delete(resolved);
  try {
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      return true;
    }
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.debug(`[TempFileManager] Failed to unlink temp file sync "${resolved}":`, err?.message || err);
    }
  }
  return false;
}

export async function useTempFile<T>(
  prefix: string,
  ext: string,
  action: (tempPath: string) => Promise<T>,
  subDir?: string
): Promise<T> {
  const tempPath = getTrackedTempPath(prefix, ext, subDir);
  try {
    return await action(tempPath);
  } finally {
    await deleteTempFile(tempPath);
  }
}

export function cleanupAllTrackedTempFiles(): void {
  for (const filePath of activeTempFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        console.debug(`[TempFileManager] Cleanup error for "${filePath}":`, err?.message || err);
      }
    }
  }
  activeTempFiles.clear();
}

export function cleanupStaleTempFiles(maxAgeMs = 12 * 60 * 60 * 1000): void {
  try {
    if (!fs.existsSync(BASE_TEMP_DIR)) return;
    const now = Date.now();
    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
          try {
            if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
          } catch {}
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(full);
            if (now - stat.mtimeMs > maxAgeMs) {
              fs.unlinkSync(full);
            }
          } catch {}
        }
      }
    };
    scanDir(BASE_TEMP_DIR);
  } catch (err: any) {
    console.debug('[TempFileManager] Error cleaning stale temp files:', err?.message || err);
  }
}

let registeredExitHooks = false;
export function initTempFileManagerHooks(): void {
  if (registeredExitHooks) return;
  registeredExitHooks = true;

  process.once('exit', () => cleanupAllTrackedTempFiles());
  process.once('SIGINT', () => {
    cleanupAllTrackedTempFiles();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    cleanupAllTrackedTempFiles();
    process.exit(0);
  });
}

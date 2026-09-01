import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { openTargetNLE } from '../nlePatcher';
import {
  getMediaMetadata,
  ensureMediaPreviewProxy,
  analyzeAudioLevels,
  extractFirstFrame,
} from '../ffmpegService';

export interface MediaIpcOptions {
  getMainWindow: () => BrowserWindow | null;
  getDefaultOutputDir: () => string;
}

export function registerMediaIpc({ getMainWindow, getDefaultOutputDir }: MediaIpcOptions): void {
  ipcMain.handle('get-appdata-path', () => {
    return getDefaultOutputDir();
  });

  ipcMain.handle('open-file-dialog', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Video or Audio File',
      properties: ['openFile'],
      filters: [
        {
          name: 'Media Files',
          extensions: [
            'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'flv', 'wmv',
            'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus'
          ],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('open-folder-dialog', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Output Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  const handleOpenPathOrNLE = async (targetPath: string): Promise<boolean> => {
    if (!targetPath) return false;
    try {
      if (fs.existsSync(targetPath)) {
        const ext = path.extname(targetPath).toLowerCase();
        if (ext === '.fcpxml') {
          openTargetNLE('final-cut-pro', targetPath);
        } else if (ext === '.xml') {
          openTargetNLE('premiere', targetPath);
        } else if (ext === '.kdenlive') {
          openTargetNLE('kdenlive', targetPath);
        } else if (ext === '.mlt') {
          openTargetNLE('shotcut', targetPath);
        } else {
          await shell.openPath(targetPath);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error opening target path:', err);
      return false;
    }
  };

  ipcMain.handle('open-path', async (_event, targetPath: string) => {
    return await handleOpenPathOrNLE(targetPath);
  });

  ipcMain.handle('shell:open-path', async (_event, targetPath: string) => {
    return await handleOpenPathOrNLE(targetPath);
  });

  ipcMain.handle('open-external', async (_event, url: string) => {
    try {
      if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        await shell.openExternal(url);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error opening external url:', err);
      return false;
    }
  });

  ipcMain.handle('show-item-in-folder', async (_event, targetPath: string) => {
    if (!targetPath) return false;
    try {
      if (fs.existsSync(targetPath)) {
        shell.showItemInFolder(targetPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error showing item in folder:', err);
      return false;
    }
  });

  ipcMain.handle('shell:show-in-folder', async (_event, targetPath: string) => {
    if (!targetPath) return false;
    try {
      if (fs.existsSync(targetPath)) {
        shell.showItemInFolder(targetPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error showing item in folder:', err);
      return false;
    }
  });

  ipcMain.handle('get-media-metadata', async (_event, rawFilePath: string) => {
    return await getMediaMetadata(rawFilePath);
  });

  ipcMain.handle('ensure-media-preview-proxy', async (_event, rawFilePath: string) => {
    return await ensureMediaPreviewProxy(rawFilePath);
  });

  ipcMain.handle('analyze-audio-levels', async (_event, rawFilePath: string) => {
    return await analyzeAudioLevels(rawFilePath);
  });

  ipcMain.handle('extract-first-frame', async (_event, rawFilePath: string, timestampSec?: number) => {
    return await extractFirstFrame(rawFilePath, timestampSec);
  });
}

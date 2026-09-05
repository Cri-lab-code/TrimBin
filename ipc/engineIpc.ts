import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  findAutoEditorBinary,
  findAutoEditorBinaryAsync,
  checkAllDependencies,
  loadEnginePaths,
  saveEnginePaths,
  autoInstallDependencies,
  AutoEditorInfo,
  DependencyStatus,
} from '../binaryFinder';
import { transcribeAudioWithWhisper, TranscribeProgressData } from '../whisperService';

export interface EngineIpcOptions {
  getMainWindow: () => BrowserWindow | null;
  getDefaultOutputDir: () => string;
}

export function registerEngineIpc({ getMainWindow, getDefaultOutputDir }: EngineIpcOptions): void {
  ipcMain.handle('get-auto-editor-info', async (_event, forceRefresh?: boolean): Promise<AutoEditorInfo> => {
    return await findAutoEditorBinaryAsync(forceRefresh);
  });

  ipcMain.handle('check-dependencies', async (_event, forceRefresh?: boolean): Promise<DependencyStatus> => {
    return await checkAllDependencies(forceRefresh);
  });

  ipcMain.handle(
    'browse-binary-path',
    async (_event, toolName: 'autoEditor' | 'whisper' | 'ffmpeg'): Promise<string | null> => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return null;
      const isWin = process.platform === 'win32';
      const result = await dialog.showOpenDialog(mainWindow, {
        title: `Locate ${toolName} Executable`,
        properties: ['openFile'],
        filters: isWin
          ? [
              { name: 'Executables (*.exe; *.bat; *.cmd)', extensions: ['exe', 'bat', 'cmd'] },
              { name: 'All Files', extensions: ['*'] },
            ]
          : [{ name: 'All Files', extensions: ['*'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    }
  );

  ipcMain.handle(
    'set-binary-path',
    async (
      _event,
      payload: { tool: 'autoEditor' | 'whisper' | 'ffmpeg'; binaryPath: string }
    ): Promise<DependencyStatus> => {
      const current = loadEnginePaths();
      if (payload.tool === 'autoEditor') current.autoEditorPath = payload.binaryPath;
      else if (payload.tool === 'whisper') current.whisperPath = payload.binaryPath;
      else if (payload.tool === 'ffmpeg') current.ffmpegPath = payload.binaryPath;
      saveEnginePaths(current);
      return await checkAllDependencies(true);
    }
  );

  ipcMain.handle('auto-install-dependencies', async (event): Promise<{ success: boolean; error?: string }> => {
    const onLog = (logChunk: string) => {
      event.sender.send('dependency-install-log', logChunk);
    };
    return await autoInstallDependencies(onLog);
  });

  ipcMain.handle(
    'transcribe-audio',
    async (
      event,
      payload: { inputFile: string; model?: string; language?: string; duration?: number }
    ) => {
      return await transcribeAudioWithWhisper(payload, (progressData: TranscribeProgressData) => {
        event.sender.send('transcribe-progress', progressData);
      });
    }
  );

  ipcMain.handle(
    'save-subtitle-file',
    async (_event, payload: { content: string; defaultName: string; ext: string }) => {
      const { content, defaultName, ext = 'srt' } = payload;
      const mainWindow = getMainWindow();
      if (!mainWindow) return { success: false, message: 'Window is not active' };

      const defaultDir = getDefaultOutputDir();
      const defaultPath = path.join(defaultDir, defaultName || `subtitles_${Date.now()}.${ext}`);

      const result = await dialog.showSaveDialog(mainWindow, {
        title: `Export Subtitles .${ext.toUpperCase()}`,
        defaultPath,
        filters: [
          { name: `${ext.toUpperCase()} Subtitle File`, extensions: [ext] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Operation cancelled' };
      }

      try {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return { success: true, filePath: result.filePath };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error while saving subtitle file';
        console.error('Error saving subtitle file:', err);
        return { success: false, message };
      }
    }
  );
}

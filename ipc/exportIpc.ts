import { ipcMain } from 'electron';
import {
  analyzeCuts,
  generatePreview,
  runAutoEditorCommand,
  AnalyzeCutsPayload,
  RunCommandOptions,
} from '../autoEditorService';

export interface ExportIpcOptions {
  getDefaultOutputDir: () => string;
}

export function registerExportIpc({ getDefaultOutputDir }: ExportIpcOptions): void {
  ipcMain.handle('analyze-cuts', async (event, payload: AnalyzeCutsPayload) => {
    return await analyzeCuts(payload, (percent) => {
      event.sender.send('preview-progress', percent);
    });
  });

  ipcMain.handle(
    'generate-preview',
    async (event, payload: { inputFile: string; loudness: number; margin: number }) => {
      return await generatePreview(payload, (percent) => {
        event.sender.send('preview-progress', percent);
      });
    }
  );

  ipcMain.handle('run-command', async (event, payload: string[] | RunCommandOptions) => {
    return await runAutoEditorCommand(payload, getDefaultOutputDir(), {
      onOutput: (text) => event.sender.send('command-output', text),
      onProgress: (percent) => event.sender.send('command-progress', percent),
    });
  });
}

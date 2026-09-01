import { contextBridge, ipcRenderer } from 'electron';
import { CutTimelineData } from './cutParser';

export interface AutoEditorInfo {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export interface AnalyzeCutsPayload {
  inputFile: string;
  duration?: number;
  loudness?: number;
  margin?: number;
  paddingLeft?: number;
  paddingRight?: number;
  isPaddingLinked?: boolean;
  minSilenceDuration?: number;
  minClipDuration?: number;
  isAutoThreshold?: boolean;
}

export interface RunCommandOptions {
  inputFile?: string;
  exportFormat?: string;
  loudness?: number;
  margin?: number;
  paddingLeft?: number;
  paddingRight?: number;
  isPaddingLinked?: boolean;
  minSilenceDuration?: number;
  minClipDuration?: number;
  isAutoThreshold?: boolean;
  outputFolder?: string;
  outputFilePath?: string;
  videoCodec?: string;
  audioCodec?: string;
  openWhenDone?: boolean;
  customArgs?: string[];
  rawArgs?: string[];
}

export interface CommandResult {
  success: boolean;
  message?: string;
  output?: string;
}

export interface PreviewResult {
  success: boolean;
  previewPath: string;
  mediaUrl: string;
}

export interface AnalyzeCutsResult {
  success: boolean;
  timeline: CutTimelineData;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscribeProgressData {
  progress: number;
  status: string;
  step?: 'extracting' | 'transcribing' | 'completed' | 'error';
}

export interface TranscribeResult {
  success: boolean;
  segments: TranscriptSegment[];
  fullText: string;
  language?: string;
  duration?: number;
  message?: string;
}

export interface AudioLevelsAnalysis {
  success: boolean;
  meanVolume?: number;
  maxVolume?: number;
  suggestedThreshold?: number;
  error?: string;
}

export interface MediaMetadata {
  isAudioOnly: boolean;
  hasCover: boolean;
  coverDataUrl?: string | null;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  format?: string;
  playbackUrl?: string;
  isProxy?: boolean;
}


export interface DependencyItem {
  name: "auto-editor" | "whisper" | "ffmpeg";
  displayName: string;
  available: boolean;
  path?: string;
  version?: string;
  required: boolean;
  description: string;
  error?: string;
}

export interface EnginePaths {
  autoEditorPath?: string;
  whisperPath?: string;
  ffmpegPath?: string;
}

export interface DependencyStatus {
  autoEditor: DependencyItem;
  whisper: DependencyItem;
  ffmpeg: DependencyItem;
  allReady: boolean;
  customPaths: EnginePaths;
}

export interface ElectronAPI {
  checkDependencies: (forceRefresh?: boolean) => Promise<DependencyStatus>;
  browseBinaryPath: (toolName: "autoEditor" | "whisper" | "ffmpeg") => Promise<string | null>;
  setBinaryPath: (payload: { tool: "autoEditor" | "whisper" | "ffmpeg"; binaryPath: string }) => Promise<DependencyStatus>;
  analyzeAudioLevels: (filePath: string) => Promise<AudioLevelsAnalysis>;
  extractFirstFrame: (filePath: string, timestampSec?: number) => Promise<string | null>;
  autoInstallDependencies: () => Promise<{ success: boolean; error?: string }>;
  onDependencyInstallLog: (callback: (log: string) => void) => () => void;
  runCommand: (payload: string[] | RunCommandOptions) => Promise<CommandResult>;
  analyzeCuts: (payload: AnalyzeCutsPayload) => Promise<AnalyzeCutsResult>;
  getMediaMetadata: (filePath: string) => Promise<MediaMetadata>;
  ensureMediaPreviewProxy: (filePath: string) => Promise<{ playbackPath: string; isProxy: boolean }>;
  generatePreview: (payload: { inputFile: string; loudness: number; margin: number }) => Promise<PreviewResult>;
  transcribeAudio: (payload: { inputFile: string; model?: string; language?: string; duration?: number }) => Promise<TranscribeResult>;
  saveSubtitleFile: (payload: { content: string; defaultName: string; ext: string }) => Promise<{ success: boolean; filePath?: string; message?: string }>;
  getAutoEditorInfo: (forceRefresh?: boolean) => Promise<AutoEditorInfo>;
  getAppDataPath: () => Promise<string>;
  openFileDialog: () => Promise<string | null>;
  openFolderDialog: () => Promise<string | null>;
  openPath: (targetPath: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  showItemInFolder: (targetPath: string) => Promise<boolean>;
  getMediaUrl: (filePath: string) => string;
  onCommandOutput: (callback: (output: string) => void) => () => void;
  onCommandProgress: (callback: (progress: number) => void) => () => void;
  onPreviewProgress: (callback: (progress: number) => void) => () => void;
  onTranscribeProgress: (callback: (data: TranscribeProgressData) => void) => () => void;
}

contextBridge.exposeInMainWorld('electron', {
  checkDependencies: (forceRefresh?: boolean): Promise<DependencyStatus> => {
    return ipcRenderer.invoke("check-dependencies", forceRefresh);
  },

  browseBinaryPath: (toolName: "autoEditor" | "whisper" | "ffmpeg"): Promise<string | null> => {
    return ipcRenderer.invoke("browse-binary-path", toolName);
  },

  setBinaryPath: (payload: { tool: "autoEditor" | "whisper" | "ffmpeg"; binaryPath: string }): Promise<DependencyStatus> => {
    return ipcRenderer.invoke("set-binary-path", payload);
  },

  extractFirstFrame: (filePath: string, timestampSec?: number): Promise<string | null> => {
    return ipcRenderer.invoke("extract-first-frame", filePath, timestampSec);
  },

  analyzeAudioLevels: (filePath: string): Promise<AudioLevelsAnalysis> => {
    return ipcRenderer.invoke("analyze-audio-levels", filePath);
  },

  autoInstallDependencies: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("auto-install-dependencies");
  },

  onDependencyInstallLog: (callback: (log: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: string) => callback(log);
    ipcRenderer.on("dependency-install-log", handler);
    return () => {
      ipcRenderer.removeListener("dependency-install-log", handler);
    };
  },

  runCommand: (payload: string[] | RunCommandOptions): Promise<CommandResult> => {
    return ipcRenderer.invoke('run-command', payload);
  },

  analyzeCuts: (payload: AnalyzeCutsPayload): Promise<AnalyzeCutsResult> => {
    return ipcRenderer.invoke('analyze-cuts', payload);
  },

  getMediaMetadata: (filePath: string): Promise<MediaMetadata> => {
    return ipcRenderer.invoke('get-media-metadata', filePath);
  },

  ensureMediaPreviewProxy: (filePath: string): Promise<{ playbackPath: string; isProxy: boolean }> => {
    return ipcRenderer.invoke('ensure-media-preview-proxy', filePath);
  },

  generatePreview: (payload: { inputFile: string; loudness: number; margin: number }): Promise<PreviewResult> => {
    return ipcRenderer.invoke('generate-preview', payload);
  },

  transcribeAudio: (payload: { inputFile: string; model?: string; language?: string; duration?: number }): Promise<TranscribeResult> => {
    return ipcRenderer.invoke('transcribe-audio', payload);
  },

  saveSubtitleFile: (payload: { content: string; defaultName: string; ext: string }): Promise<{ success: boolean; filePath?: string; message?: string }> => {
    return ipcRenderer.invoke('save-subtitle-file', payload);
  },

  getAutoEditorInfo: (forceRefresh?: boolean): Promise<AutoEditorInfo> => {
    return ipcRenderer.invoke('get-auto-editor-info', forceRefresh);
  },

  getAppDataPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-appdata-path');
  },

  openFileDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('open-file-dialog');
  },

  openFolderDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke('open-folder-dialog');
  },

  openPath: (targetPath: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-path', targetPath);
  },

  openExternal: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-external', url);
  },

  showItemInFolder: (targetPath: string): Promise<boolean> => {
    return ipcRenderer.invoke('show-item-in-folder', targetPath);
  },

  getMediaUrl: (filePath: string): string => {
    return `media://local/?path=${encodeURIComponent(filePath)}`;
  },

  onCommandOutput: (callback: (output: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, output: string) => callback(output);
    ipcRenderer.on('command-output', handler);
    return () => {
      ipcRenderer.removeListener('command-output', handler);
    };
  },

  onCommandProgress: (callback: (progress: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: number) => callback(progress);
    ipcRenderer.on('command-progress', handler);
    return () => {
      ipcRenderer.removeListener('command-progress', handler);
    };
  },

  onPreviewProgress: (callback: (progress: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: number) => callback(progress);
    ipcRenderer.on('preview-progress', handler);
    return () => {
      ipcRenderer.removeListener('preview-progress', handler);
    };
  },

  onTranscribeProgress: (callback: (data: TranscribeProgressData) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: TranscribeProgressData) => callback(data);
    ipcRenderer.on('transcribe-progress', handler);
    return () => {
      ipcRenderer.removeListener('transcribe-progress', handler);
    };
  },
} as ElectronAPI);

declare module '*.png' {
  const content: string;
  export default content;
}

export interface FileWithPath extends File {
  path?: string;
}

export interface SelectedFile {
  name: string;
  path: string;
}

export interface CutSegment {
  id?: string;
  inFrame: number;
  outFrame: number;
  inSec: number;
  outSec: number;
  durationSec: number;
  isCut?: boolean;
}

export interface SilenceCut {
  inSec: number;
  outSec: number;
  durationSec: number;
}

export interface CutTimelineData {
  fps: number;
  segments: CutSegment[];
  silenceCuts: SilenceCut[];
  totalCutDuration: number;
  originalDuration: number;
  savedDuration: number;
  savedPercentage: number;
  cutsCount: number;
}

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
  cutRanges?: { start: number; end: number }[];
  duration?: number;
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

export interface AudioLevelsAnalysis {
  success: boolean;
  meanVolume?: number;
  maxVolume?: number;
  suggestedThreshold?: number;
  error?: string;
}

export interface DependencyStatus {
  autoEditor: DependencyItem;
  whisper: DependencyItem;
  ffmpeg: DependencyItem;
  allReady: boolean;
  customPaths: EnginePaths;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    electron: {
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
    };
  }
}

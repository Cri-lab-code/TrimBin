import React from 'react';
import { UserClip, SilenceSlice, SilenceSettings } from '../../types/timeline';
import { SidebarModeSwitcher, SidebarTabMode } from './sidebar/SidebarModeSwitcher';
import { SilenceTab } from './SilenceTab';
import { ClipsTab } from './sidebar/ClipsTab';
import { TranscribePanel } from './TranscribePanel';
import { ExportTab } from './sidebar/ExportTab';
import { AmberLedTimecode } from './AmberLedTimecode';
import { VuMeter } from './VuMeter';

export interface TrimBinSidebarProps {
  isPlaying?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement> | null;
  activeTab: SidebarTabMode;
  onTabChange: (tab: SidebarTabMode) => void;
  selectedFile?: { name: string; path: string } | null;
  silenceSettings: SilenceSettings;
  onSilenceSettingsChange: (newSettings: SilenceSettings) => void;
  isAnalyzing: boolean;
  analysisProgress: number;
  hasAnalyzedSilence: boolean;
  onAnalyzeCuts: () => void;
  onAutoCalibrate?: () => void;
  isCalibrating?: boolean;
  clips: UserClip[];
  silenceSlices?: SilenceSlice[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onToggleDeleteClip: (clipId?: string) => void;
  exportAs: string;
  onExportAsChange: (format: string) => void;
  videoCodec: string;
  onVideoCodecChange: (codec: string) => void;
  audioCodec: string;
  onAudioCodecChange: (codec: string) => void;
  videoQualityCrf?: number;
  onVideoQualityCrfChange?: (val: number) => void;
  audioTrackMode?: 'mix' | 'separate';
  onAudioTrackModeChange?: (mode: 'mix' | 'separate') => void;
  openWhenDone: boolean;
  onToggleOpenWhenDone: () => void;
  exportPath: string;
  onExportPathChange: (path: string) => void;
  onBrowseFolder: () => void;
  onRunExport: () => void;
  isProcessing: boolean;
  exportProgress: number;
  selectedFileName?: string;
  onSeekToTime: (timeSec: number) => void;
  currentTime: number;
  duration: number;
  transcriptSegments: import('@/global').TranscriptSegment[];
  onTranscriptSegmentsChange: (segments: import('@/global').TranscriptSegment[]) => void;
  transcriptModel: 'tiny' | 'base' | 'turbo';
  onTranscriptModelChange: (model: 'tiny' | 'base' | 'turbo') => void;
  transcriptLanguage: string;
  onTranscriptLanguageChange: (lang: string) => void;
  transcriptStatusText: string;
  onTranscriptStatusTextChange: (status: string) => void;
  transcriptProgress: number;
  onTranscriptProgressChange: (prog: number) => void;
  onResetTranscript: () => void;
}

export const TrimBinSidebar: React.FC<TrimBinSidebarProps> = ({
  isPlaying = false,
  videoRef,
  activeTab,
  onTabChange,
  selectedFile,
  silenceSettings,
  onSilenceSettingsChange,
  isAnalyzing,
  analysisProgress,
  onAnalyzeCuts,
  onAutoCalibrate,
  isCalibrating,
  clips,
  silenceSlices = [],
  selectedClipId,
  onSelectClip,
  onToggleDeleteClip,
  exportAs,
  onExportAsChange,
  videoCodec,
  onVideoCodecChange,
  audioCodec,
  onAudioCodecChange,
  videoQualityCrf,
  onVideoQualityCrfChange,
  audioTrackMode,
  onAudioTrackModeChange,
  openWhenDone,
  onToggleOpenWhenDone,
  exportPath,
  onExportPathChange,
  onBrowseFolder,
  onRunExport,
  isProcessing,
  exportProgress,
  onSeekToTime,
  currentTime,
  duration,
  transcriptSegments,
  onTranscriptSegmentsChange,
  transcriptModel,
  onTranscriptModelChange,
  transcriptLanguage,
  onTranscriptLanguageChange,
  transcriptStatusText,
  onTranscriptStatusTextChange,
  transcriptProgress,
  onTranscriptProgressChange,
  onResetTranscript,
}) => {
  return (
    <aside className="w-[320px] shrink-0 border-l border-black bg-[var(--panel-surface)] flex flex-col p-2 select-none overflow-hidden h-full">
      {/* Top Header VU & SMPTE Display */}
      <div className="space-y-1.5 mb-2 shrink-0">
        <VuMeter isPlaying={isPlaying} videoRef={videoRef} />
        <AmberLedTimecode seconds={currentTime} />
        <SidebarModeSwitcher activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      {/* Active Tab Panel Viewport */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-0.5">
        {activeTab === 'silence' && (
          <SilenceTab
            settings={silenceSettings}
            onSettingsChange={onSilenceSettingsChange}
            isAnalyzing={isAnalyzing}
            analysisProgress={analysisProgress}
            onAnalyzeCuts={onAnalyzeCuts}
            onAutoCalibrate={onAutoCalibrate}
            isCalibrating={isCalibrating}
          />
        )}

        {activeTab === 'sections' && (
          <ClipsTab
            clips={clips}
            silenceSlices={silenceSlices}
            selectedClipId={selectedClipId}
            currentTime={currentTime}
            onSelectClip={onSelectClip}
            onToggleDeleteClip={onToggleDeleteClip}
            onSeekToTime={onSeekToTime}
          />
        )}

        {activeTab === 'transcribe' && (
          <TranscribePanel
            selectedFile={selectedFile || null}
            currentTime={currentTime}
            duration={duration}
            onSeekToTime={onSeekToTime}
            transcriptSegments={transcriptSegments}
            onTranscriptSegmentsChange={onTranscriptSegmentsChange}
            transcriptModel={transcriptModel}
            onTranscriptModelChange={onTranscriptModelChange}
            transcriptLanguage={transcriptLanguage}
            onTranscriptLanguageChange={onTranscriptLanguageChange}
            transcriptStatusText={transcriptStatusText}
            onTranscriptStatusTextChange={onTranscriptStatusTextChange}
            transcriptProgress={transcriptProgress}
            onTranscriptProgressChange={onTranscriptProgressChange}
            onResetTranscript={onResetTranscript}
          />
        )}

        {activeTab === 'export' && (
          <ExportTab
            exportAs={exportAs}
            onExportAsChange={onExportAsChange}
            videoCodec={videoCodec}
            onVideoCodecChange={onVideoCodecChange}
            audioCodec={audioCodec}
            onAudioCodecChange={onAudioCodecChange}
            videoQualityCrf={videoQualityCrf}
            onVideoQualityCrfChange={onVideoQualityCrfChange}
            audioTrackMode={audioTrackMode}
            onAudioTrackModeChange={onAudioTrackModeChange}
            openWhenDone={openWhenDone}
            onToggleOpenWhenDone={onToggleOpenWhenDone}
            exportPath={exportPath}
            onExportPathChange={onExportPathChange}
            onBrowseFolder={onBrowseFolder}
            onRunExport={onRunExport}
            isProcessing={isProcessing}
            exportProgress={exportProgress}
          />
        )}
      </div>
    </aside>
  );
};

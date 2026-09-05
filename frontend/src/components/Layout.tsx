import React, { useState, useRef, useCallback } from 'react';
import {
  SelectedFile,
  AutoEditorInfo,
  TranscriptSegment,
  DependencyStatus,
} from '@/global';
import { useTimelineStore } from '../hooks/useTimelineStore';
import { usePlaybackEngine } from '../hooks/usePlaybackEngine';
import { useExportWorkflow } from '../hooks/useExportWorkflow';
import { useAppHotkeys } from '../hooks/useAppHotkeys';
import { useCutAnalysis } from '../hooks/useCutAnalysis';
import { useSystemIpcListeners } from '../hooks/useSystemIpcListeners';
import { useFileDropzone } from '../hooks/useFileDropzone';
import { SilenceSettings, DEFAULT_SILENCE_SETTINGS } from '../types/timeline';
import { TrimBinHeader } from './trimbin/TrimBinHeader';
import { TrimBinAlertBanner } from './trimbin/TrimBinAlertBanner';
import { TrimBinVideoStage } from './trimbin/TrimBinVideoStage';
import { TrimBinSidebar } from './trimbin/TrimBinSidebar';
import { TrimBinTimeline } from './trimbin/TrimBinTimeline';
import { TrimBinConsoleDrawer } from './trimbin/TrimBinConsoleDrawer';
import { AboutModal } from './trimbin/AboutModal';
import { DependencyModal } from './trimbin/DependencyModal';
import { sanitizeFilePath } from '../utils/pathSanitizer';

export const Layout: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [silenceSettings, setSilenceSettings] = useState<SilenceSettings>(DEFAULT_SILENCE_SETTINGS);
  const [activeTab, setActiveTab] = useState<'silence' | 'sections' | 'transcribe' | 'export'>('silence');
  const [sourceDuration, setSourceDuration] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Timeline state store (clips, slices, undo/redo history)
  const {
    clips,
    activeMagneticClips,
    totalProjectDuration,
    silenceSlices,
    selectedClipId,
    selectedSilenceId,
    canUndo,
    canRedo,
    playableSegments,
    cutRanges,
    savedPercentage,
    cutsCount,
    initTimeline,
    setInitialSilenceAnalysis,
    setSilenceAnalysis,
    splitClip,
    toggleDeleteSelectedClip,
    selectClip,
    selectSilence,
    toggleKeepSelectedSilence,
    undo,
    redo,
    resetTimeline,
  } = useTimelineStore(sourceDuration);

  // Playback engine (60fps rAF tick, smart-skip, scrubbing, play/pause)
  const {
    isPlaying,
    setIsPlaying,
    sourceCurrentTime,
    setSourceCurrentTime,
    timelineCurrentTime,
    setTimelineCurrentTime,
    fps,
    setFps,
    isMuted,
    setIsMuted,
    smartSkipOn,
    setSmartSkipOn,
    seekSource,
    seekTimeline,
    handleTimeUpdate,
    togglePlay,
    jumpNextCut,
    jumpPrevCut,
  } = usePlaybackEngine({
    videoRef,
    selectedFile,
    activeMagneticClips,
    playableSegments,
    totalProjectDuration,
    sourceDuration,
  });

  // Export pipeline (codecs, CRF, output path, command string, execution)
  const {
    exportPath,
    setExportPath,
    exportAs,
    setExportAs,
    videoCodec,
    setVideoCodec,
    audioCodec,
    setAudioCodec,
    videoQualityCrf,
    setVideoQualityCrf,
    audioTrackMode,
    setAudioTrackMode,
    openWhenDone,
    setOpenWhenDone,
    commandString,
    alert,
    setAlert,
    runExport,
  } = useExportWorkflow({
    selectedFile,
    silenceSettings,
    cutRanges,
  });

  // Keyboard shortcuts (Space, Split B, Ripple Delete, Undo/Redo, Shift+Arrows)
  useAppHotkeys({
    togglePlay,
    splitClip,
    toggleDeleteSelectedClip,
    selectedClipId,
    sourceCurrentTime,
    canUndo,
    canRedo,
    undo,
    redo,
    jumpNextCut,
    jumpPrevCut,
  });

  // Cut Analysis & Audio Calibration
  const {
    isAnalyzing,
    analysisProgress,
    setAnalysisProgress,
    isCalibrating,
    handleAnalyzeCuts,
    handleAutoCalibrateThreshold,
  } = useCutAnalysis({
    selectedFile,
    sourceDuration,
    silenceSettings,
    setSilenceSettings,
    setFps,
    setInitialSilenceAnalysis,
    setSilenceAnalysis,
    setSmartSkipOn,
    videoRef,
    setSourceCurrentTime,
    setAlert,
  });

  // Transcription state
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [transcriptModel, setTranscriptModel] = useState<'tiny' | 'base' | 'turbo'>('base');
  const [transcriptLanguage, setTranscriptLanguage] = useState<string>('auto');
  const [transcriptStatusText, setTranscriptStatusText] = useState<string>('Ready to Transcribe');
  const [transcriptProgress, setTranscriptProgress] = useState<number>(0);

  const handleResetTranscript = useCallback(() => {
    setTranscriptSegments([]);
    setTranscriptProgress(0);
    setTranscriptStatusText('Ready to Transcribe');
  }, []);

  // System status and background tasks
  const [autoEditorInfo, setAutoEditorInfo] = useState<AutoEditorInfo | null>(null);
  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null);
  const [showDependencyModal, setShowDependencyModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);

  const refreshDependencies = useCallback(async () => {
    try {
      if (window.electron?.checkDependencies) {
        const status = await window.electron.checkDependencies();
        setDependencyStatus(status);
        setAutoEditorInfo({
          available: status.autoEditor.available,
          path: status.autoEditor.path,
          version: status.autoEditor.version,
          error: status.autoEditor.error,
        });
        if (!status.allReady) {
          setShowDependencyModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to check dependencies:', err);
    }
  }, []);

  const { logs, setLogs, progress, setProgress } = useSystemIpcListeners({
    refreshDependencies,
    setExportPath,
    setAnalysisProgress,
  });

  const loadMediaFile = useCallback(
    async (filePath: string, fileName?: string) => {
      const clean = sanitizeFilePath(filePath);
      const name = fileName || clean.split(/[\\/]/).pop() || 'video';

      resetTimeline();
      setSourceCurrentTime(0);
      setTimelineCurrentTime(0);
      setIsPlaying(false);
      setAlert(null);

      setSelectedFile({ name, path: clean });

      if (typeof window !== 'undefined' && window.electron && typeof window.electron.getMediaMetadata === 'function') {
        try {
          const meta = await window.electron.getMediaMetadata(clean);
          if (meta && typeof meta.duration === 'number' && meta.duration > 0) {
            setSourceDuration(meta.duration);
            initTimeline(meta.duration, name);

            if (silenceSettings.isAutoThreshold) {
              handleAutoCalibrateThreshold(clean, true);
            } else {
              handleAnalyzeCuts(true, clean);
            }
            return;
          }
        } catch (metaErr) {
          console.warn('[MEDIA LOAD] getMediaMetadata error, falling back to video element:', metaErr);
        }
      }

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        const dur = videoRef.current.duration;
        if (dur && !isNaN(dur) && dur > 0) {
          setSourceDuration(dur);
          initTimeline(dur, name);

          if (silenceSettings.isAutoThreshold) {
            handleAutoCalibrateThreshold(clean, true);
          } else {
            handleAnalyzeCuts(true, clean);
          }
        }
      }
    },
    [
      resetTimeline,
      initTimeline,
      silenceSettings.isAutoThreshold,
      handleAutoCalibrateThreshold,
      handleAnalyzeCuts,
      setSourceCurrentTime,
      setTimelineCurrentTime,
      setIsPlaying,
      setAlert,
    ]
  );

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useFileDropzone({
    onFileDrop: loadMediaFile,
  });

  const handleBrowseFile = async () => {
    try {
      const filePath = await window.electron.openFileDialog();
      if (filePath) {
        loadMediaFile(filePath);
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const folderPath = await window.electron.openFolderDialog();
      if (folderPath) {
        setExportPath(folderPath);
      }
    } catch (err) {
      console.error('Folder dialog error:', err);
    }
  };

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const dur = e.currentTarget.duration;
      if (!dur || isNaN(dur) || !selectedFile) return;

      setSourceDuration(dur);

      if (clips.length === 0) {
        initTimeline(dur, selectedFile.name);
        if (silenceSettings.isAutoThreshold) {
          handleAutoCalibrateThreshold(selectedFile.path, true);
        } else {
          handleAnalyzeCuts(true, selectedFile.path);
        }
      }
    },
    [
      selectedFile,
      clips.length,
      initTimeline,
      silenceSettings.isAutoThreshold,
      handleAutoCalibrateThreshold,
      handleAnalyzeCuts,
    ]
  );

  const handleExportAsChange = (format: string) => {
    setExportAs(format);
    const isTimelineProject = [
      'premiere',
      'final-cut-pro',
      'davinci',
      'davinci-xml',
      'davinci-fcpxml',
      'resolve',
      'kdenlive',
      'shotcut',
    ].includes(format);
    setOpenWhenDone(isTimelineProject);
  };

  const hasActiveClips = !!selectedFile;

  return (
    <div className="h-screen w-screen flex flex-col vulcanite-leather-bg overflow-hidden select-none font-sans text-slate-200">
      {/* 1. Brushed Dark Console Header with Brass Badges */}
      <TrimBinHeader
        projectName={hasActiveClips && selectedFile ? selectedFile.name : ''}
        isProcessing={isProcessing}
        progress={progress}
        savedPercentage={hasActiveClips ? savedPercentage : undefined}
        cutsCount={hasActiveClips ? cutsCount : undefined}
        autoEditorInfo={autoEditorInfo}
        dependencyStatus={dependencyStatus}
        onOpenDependencies={() => setShowDependencyModal(true)}
        isConsoleOpen={isConsoleOpen}
        onToggleConsole={() => setIsConsoleOpen((v) => !v)}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      {/* Progress Line Bar during active operations */}
      {isProcessing && (
        <div className="h-1 w-full bg-[var(--bg-inset)] overflow-hidden relative shrink-0 shadow-inner z-50">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-200 shadow-glow-amber"
            style={{ width: `${Math.max(progress, 3)}%` }}
          />
        </div>
      )}

      {/* Alert Notification Toast Banner */}
      <TrimBinAlertBanner
        alert={alert}
        isProcessing={isProcessing}
        onDismiss={() => setAlert(null)}
      />

      {/* 2. Top Stage Area (Light Table Viewport + Inspector Audio Rack) */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-[var(--bg-chassis)] panel-groove">
        {/* TrimBin Center TV Monitor Stage */}
        <TrimBinVideoStage
          selectedFile={selectedFile}
          videoRef={videoRef}
          isPlaying={isPlaying}
          hasActiveClips={hasActiveClips}
          onTogglePlay={togglePlay}
          onJumpPrevCut={jumpPrevCut}
          onJumpNextCut={jumpNextCut}
          smartSkipOn={smartSkipOn}
          onToggleSmartSkip={() => setSmartSkipOn((v) => !v)}
          currentTime={timelineCurrentTime}
          duration={totalProjectDuration}
          fps={fps}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onBrowseFile={handleBrowseFile}
          onLoadFile={loadMediaFile}
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((m) => !m)}
        />

        {/* Right Brushed Metal Inspector Rack */}
        <TrimBinSidebar
          videoRef={videoRef}
          isPlaying={isPlaying}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedFile={selectedFile}
          silenceSettings={silenceSettings}
          onSilenceSettingsChange={setSilenceSettings}
          isAnalyzing={isAnalyzing}
          analysisProgress={analysisProgress}
          hasAnalyzedSilence={silenceSlices.length > 0}
          onAnalyzeCuts={handleAnalyzeCuts}
          onAutoCalibrate={handleAutoCalibrateThreshold}
          isCalibrating={isCalibrating}
          clips={clips}
          silenceSlices={silenceSlices}
          selectedClipId={selectedClipId}
          onSelectClip={selectClip}
          onToggleDeleteClip={toggleDeleteSelectedClip}
          exportAs={exportAs}
          onExportAsChange={handleExportAsChange}
          videoCodec={videoCodec}
          onVideoCodecChange={setVideoCodec}
          audioCodec={audioCodec}
          onAudioCodecChange={setAudioCodec}
          videoQualityCrf={videoQualityCrf}
          onVideoQualityCrfChange={setVideoQualityCrf}
          audioTrackMode={audioTrackMode}
          onAudioTrackModeChange={setAudioTrackMode}
          openWhenDone={openWhenDone}
          onToggleOpenWhenDone={() => setOpenWhenDone((v) => !v)}
          exportPath={exportPath}
          onExportPathChange={setExportPath}
          onBrowseFolder={handleBrowseFolder}
          onRunExport={() => runExport(setIsProcessing, setProgress)}
          isProcessing={isProcessing}
          exportProgress={progress}
          selectedFileName={selectedFile?.name}
          onSeekToTime={seekSource}
          currentTime={sourceCurrentTime}
          duration={sourceDuration}
          transcriptSegments={transcriptSegments}
          onTranscriptSegmentsChange={setTranscriptSegments}
          transcriptModel={transcriptModel}
          onTranscriptModelChange={setTranscriptModel}
          transcriptLanguage={transcriptLanguage}
          onTranscriptLanguageChange={setTranscriptLanguage}
          transcriptStatusText={transcriptStatusText}
          onTranscriptStatusTextChange={setTranscriptStatusText}
          transcriptProgress={transcriptProgress}
          onTranscriptProgressChange={setTranscriptProgress}
          onResetTranscript={handleResetTranscript}
        />
      </div>

      {/* 3. Bottom Multi-Track NLE Magnetic Ripple Timeline */}
      <TrimBinTimeline
        selectedFile={selectedFile}
        sourceDuration={sourceDuration}
        totalProjectDuration={totalProjectDuration}
        timelineCurrentTime={timelineCurrentTime}
        fps={fps}
        activeMagneticClips={activeMagneticClips}
        silenceSlices={silenceSlices}
        selectedClipId={selectedClipId}
        selectedSilenceId={selectedSilenceId}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectClip={selectClip}
        onSelectSilence={selectSilence}
        onToggleKeepSilence={toggleKeepSelectedSilence}
        onSplitClip={splitClip}
        onToggleDeleteClip={toggleDeleteSelectedClip}
        onUndo={undo}
        onRedo={redo}
        onSeekTimeline={seekTimeline}
      />

      {/* 4. Collapsible Terminal Console Drawer */}
      <TrimBinConsoleDrawer
        isOpen={isConsoleOpen}
        onToggle={() => setIsConsoleOpen((v) => !v)}
        commandString={commandString}
        logs={logs}
        onClearLogs={() => setLogs([])}
        progress={progress}
        isProcessing={isProcessing}
      />

      {/* 5. About TrimBin & Credits Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* 6. System Engine Dependencies Setup Modal */}
      <DependencyModal
        isOpen={showDependencyModal}
        status={dependencyStatus}
        onRefresh={refreshDependencies}
        onClose={() => setShowDependencyModal(false)}
      />
    </div>
  );
};

export default Layout;

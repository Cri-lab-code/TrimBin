import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { SilenceSettings, DEFAULT_SILENCE_SETTINGS } from '../types/timeline';
import { convertCutsToSilenceSlices } from '../utils/timelineEngine';
import { calibrateAudioSilence } from '../utils/audioCalibration';
import { TrimBinHeader } from './trimbin/TrimBinHeader';
import { TrimBinVideoStage } from './trimbin/TrimBinVideoStage';
import { TrimBinSidebar } from './trimbin/TrimBinSidebar';
import { TrimBinTimeline } from './trimbin/TrimBinTimeline';
import { TrimBinConsoleDrawer } from './trimbin/TrimBinConsoleDrawer';
import { AboutModal } from './trimbin/AboutModal';
import { DependencyModal } from './trimbin/DependencyModal';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';

const sanitizeFilePath = (p: string): string => {
  if (!p) return '';
  let clean = p.trim();
  if (clean.includes('?path=')) {
    try {
      const idx = clean.indexOf('?path=');
      clean = clean.substring(idx + 6).split('&')[0];
    } catch {}
  }
  clean = clean.replace(/^(?:file|media):\/\/(?:local\/)?/, '');
  try {
    clean = decodeURIComponent(clean);
  } catch {}
  clean = clean.replace(/^[/\\]+([a-zA-Z]:)/, '$1');
  return clean;
};

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

  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

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
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

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

  useEffect(() => {
    let isMounted = true;

    const initSystem = async () => {
      try {
        if (window.electron) {
          await refreshDependencies();
          const defaultFolder = await window.electron.getAppDataPath();
          if (isMounted && defaultFolder) {
            setExportPath(defaultFolder);
          }
        }
      } catch (err) {
        console.error('System init error:', err);
      }
    };

    initSystem();

    let unsubOutput: (() => void) | undefined;
    let unsubProg: (() => void) | undefined;
    let unsubPrevProg: (() => void) | undefined;

    if (window.electron?.onCommandOutput) {
      unsubOutput = window.electron.onCommandOutput((chunk) => {
        if (isMounted) setLogs((prev) => [...prev, chunk]);
      });
    }

    if (window.electron?.onCommandProgress) {
      unsubProg = window.electron.onCommandProgress((prog) => {
        if (isMounted) setProgress(prog);
      });
    }

    if (window.electron?.onPreviewProgress) {
      unsubPrevProg = window.electron.onPreviewProgress((prog) => {
        if (isMounted) setAnalysisProgress(prog);
      });
    }

    return () => {
      isMounted = false;
      if (unsubOutput) unsubOutput();
      if (unsubProg) unsubProg();
      if (unsubPrevProg) unsubPrevProg();
    };
  }, [refreshDependencies, setExportPath]);

  const handleAnalyzeCuts = useCallback(
    async (isInitialBaseline: boolean = false, overrideFilePath?: string) => {
      const targetPath = overrideFilePath || selectedFile?.path;
      if (!targetPath) return;

      setIsAnalyzing(true);
      setAnalysisProgress(10);

      try {
        const res = await window.electron.analyzeCuts({
          inputFile: targetPath,
          duration: sourceDuration,
          ...silenceSettings,
          loudness: silenceSettings.threshold,
          margin: silenceSettings.paddingLeft,
        });

        if (res.success && res.timeline) {
          setFps(res.timeline.fps || 30);
          const dur = sourceDuration > 0 ? sourceDuration : res.timeline.originalDuration;

          const slices = convertCutsToSilenceSlices(res.timeline.silenceCuts, dur);
          if (isInitialBaseline) {
            setInitialSilenceAnalysis(slices);
          } else {
            setSilenceAnalysis(slices);
          }
          setSmartSkipOn(true);

          if (res.timeline.segments.length > 0 && videoRef.current) {
            const firstIn = res.timeline.segments[0].inSec;
            videoRef.current.currentTime = firstIn;
            setSourceCurrentTime(firstIn);
          }
        }
      } catch (err: unknown) {
        console.error('Analyze cuts error:', err);
        setAlert({
          message: (err instanceof Error ? err.message : 'Cut analysis failed.'),
          type: 'error',
        });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [selectedFile, silenceSettings, sourceDuration, setSilenceAnalysis, setInitialSilenceAnalysis, setFps, setSmartSkipOn, setSourceCurrentTime, setAlert]
  );

  const handleAutoCalibrateThreshold = useCallback(
    async (filePathToCalibrate?: string, isInitialBaseline: boolean = false) => {
      const targetPath = filePathToCalibrate || selectedFile?.path;
      if (!targetPath) return;

      setIsCalibrating(true);
      await new Promise((resolve) => setTimeout(resolve, 25));

      try {
        const calibration = await calibrateAudioSilence(targetPath);
        const roundedDb = typeof calibration === 'object' ? calibration.db : Math.round(calibration);

        const newSettings = {
          ...silenceSettings,
          threshold: roundedDb,
          isAutoThreshold: true,
        };
        setSilenceSettings(newSettings);

        setIsAnalyzing(true);
        setAnalysisProgress(15);

        try {
          const res = await window.electron.analyzeCuts({
            inputFile: targetPath,
            duration: sourceDuration,
            ...newSettings,
            loudness: roundedDb,
            margin: newSettings.paddingLeft,
          });

          if (res.success && res.timeline) {
            setFps(res.timeline.fps || 30);
            const dur = sourceDuration > 0 ? sourceDuration : res.timeline.originalDuration;
            const slices = convertCutsToSilenceSlices(res.timeline.silenceCuts, dur);

            if (isInitialBaseline) {
              setInitialSilenceAnalysis(slices);
            } else {
              setSilenceAnalysis(slices);
            }
            setSmartSkipOn(true);

            if (res.timeline.segments.length > 0 && videoRef.current) {
              const firstIn = res.timeline.segments[0].inSec;
              videoRef.current.currentTime = firstIn;
              setSourceCurrentTime(firstIn);
            }
          }
        } catch (err: unknown) {
          console.error('Analyze cuts error after auto-calibration:', err);
          setAlert({
            message: (err instanceof Error ? err.message : 'Silence re-analysis failed after auto-calibration.'),
            type: 'error',
          });
        } finally {
          setIsAnalyzing(false);
        }
      } catch (err) {
        console.error('Auto-calibration error:', err);
      } finally {
        setTimeout(() => {
          setIsCalibrating(false);
        }, 150);
      }
    },
    [selectedFile, silenceSettings, sourceDuration, setSilenceAnalysis, setInitialSilenceAnalysis, setFps, setSmartSkipOn, setSourceCurrentTime, setAlert]
  );

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
    [resetTimeline, initTimeline, silenceSettings.isAutoThreshold, handleAutoCalibrateThreshold, handleAnalyzeCuts, setSourceCurrentTime, setTimelineCurrentTime, setIsPlaying, setAlert]
  );

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const filePath = (file as File & { path?: string }).path || file.name;
      loadMediaFile(filePath, file.name);
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
    [selectedFile, clips.length, initTimeline, silenceSettings.isAutoThreshold, handleAutoCalibrateThreshold, handleAnalyzeCuts]
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
      {alert && !isProcessing && (
        <div
          className={`mx-2 my-1.5 px-3.5 py-2 rounded-[6px] flex items-center justify-between z-40 text-xs font-mono font-bold shadow-panel-bevel border ${
            alert.type === 'error'
              ? 'bg-gradient-to-b from-red-900 via-red-800 to-red-950 text-red-100 border-red-500'
              : 'bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 text-emerald-100 border-emerald-500'
          }`}
        >
          <div className="flex items-center gap-2 truncate mr-2">
            {alert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={2.4} />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2.4} />
            )}
            <span className="truncate font-extrabold text-white">
              {alert.message}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {alert.filePath && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (window.electron && alert.filePath) {
                      window.electron.openPath(alert.filePath);
                    }
                  }}
                  className="px-2.5 py-1 text-[10px] font-mono font-black text-amber-200 bg-[var(--accent-amber-subtle)] border border-[var(--accent-amber-border)] rounded-[4px] hover:text-white flex items-center gap-1 cursor-pointer"
                  title="Open directly in default application (DaVinci, Final Cut, Premiere)"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.4} />
                  OPEN IN APPLICATION
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.electron && alert.filePath) {
                      window.electron.showItemInFolder(alert.filePath);
                    }
                  }}
                  className="px-2.5 py-1 text-[10px] font-mono font-black text-slate-200 bg-[var(--bg-panel-sub)] border border-[var(--border-default)] rounded-[4px] hover:text-white flex items-center gap-1 cursor-pointer"
                  title="Reveal file in Finder"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.4} />
                  REVEAL IN FINDER
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setAlert(null)}
              className="px-2.5 py-1 text-[10px] font-mono font-bold text-slate-300 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-[4px] hover:text-white cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

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

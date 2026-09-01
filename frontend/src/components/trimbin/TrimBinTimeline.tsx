import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ComputedTimelineClip, SilenceSlice } from '../../types/timeline';
import { useTimelineGestures, RenderedSilenceCut } from './timeline/useTimelineGestures';
import { TimelineTransportControls } from './timeline/TimelineTransportControls';
import { TimelineRuler } from './timeline/TimelineRuler';
import { VideoClipsTrack } from './timeline/VideoClipsTrack';
import { WaveformTrack } from './timeline/WaveformTrack';
import { PlayheadOverlay } from './timeline/PlayheadOverlay';
import { TracksContainer } from './timeline/TracksContainer';

export interface TrimBinTimelineProps {
  selectedFile: { name: string; path: string } | null;
  sourceDuration: number;
  totalProjectDuration: number;
  timelineCurrentTime: number;
  fps?: number;
  activeMagneticClips: ComputedTimelineClip[];
  silenceSlices: SilenceSlice[];
  selectedClipId: string | null;
  selectedSilenceId?: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onSelectClip: (clipId: string | null) => void;
  onSelectSilence?: (silenceId: string | null) => void;
  onToggleKeepSilence?: (silenceId?: string) => void;
  onSplitClip: (sourceTimeSec: number) => void;
  onToggleDeleteClip: (clipId?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSeekTimeline: (timelineTimeSec: number) => void;
}

const MAX_CANVAS_SAFE_WIDTH = 32000;

export const TrimBinTimeline: React.FC<TrimBinTimelineProps> = React.memo(({
  selectedFile,
  sourceDuration,
  totalProjectDuration,
  timelineCurrentTime,
  fps = 30,
  activeMagneticClips,
  silenceSlices,
  selectedClipId,
  selectedSilenceId,
  canUndo,
  canRedo,
  onSelectClip,
  onSelectSilence,
  onToggleKeepSilence,
  onSplitClip,
  onToggleDeleteClip,
  onUndo,
  onRedo,
  onSeekTimeline,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [viewportWidth, setViewportWidth] = useState<number>(1200);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const hasMedia = !!selectedFile && (sourceDuration > 0 || totalProjectDuration > 0);
  const projectDuration = hasMedia ? (totalProjectDuration > 0 ? totalProjectDuration : sourceDuration) : 0;

  const effectiveClips: ComputedTimelineClip[] = useMemo(() => {
    if (activeMagneticClips && activeMagneticClips.length > 0) {
      return activeMagneticClips;
    }
    if (hasMedia && projectDuration > 0) {
      return [
        {
          id: 'clip-1',
          name: selectedFile?.name || 'Clip 1',
          sourceStart: 0,
          sourceEnd: projectDuration,
          timelineStart: 0,
          timelineEnd: projectDuration,
          duration: projectDuration,
          isDeleted: false,
        },
      ];
    }
    return [];
  }, [activeMagneticClips, hasMedia, projectDuration, selectedFile?.name]);

  useEffect(() => {
    const updateWidth = () => {
      if (scrollRef.current) {
        setViewportWidth(scrollRef.current.clientWidth || 1200);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const maxSafeZoom = useMemo(() => {
    return Math.max(1, Math.min(32, Math.floor(MAX_CANVAS_SAFE_WIDTH / Math.max(100, viewportWidth))));
  }, [viewportWidth]);

  const totalTimelineWidth = useMemo(() => {
    if (!hasMedia) return viewportWidth;
    const raw = Math.round(viewportWidth * zoomLevel);
    return Math.min(MAX_CANVAS_SAFE_WIDTH, Math.max(viewportWidth, raw));
  }, [viewportWidth, zoomLevel, hasMedia]);

  const renderedSilenceCuts = useMemo(() => {
    if (!hasMedia || projectDuration <= 0) return [];
    const results: RenderedSilenceCut[] = [];

    effectiveClips.forEach((clip) => {
      silenceSlices.forEach((slice) => {
        if (!slice.isSilent) return;
        if (slice.end <= clip.sourceStart || slice.start >= clip.sourceEnd) return;

        const sliceStart = Math.max(slice.start, clip.sourceStart);
        const sliceEnd = Math.min(slice.end, clip.sourceEnd);
        const tStart = clip.timelineStart + (sliceStart - clip.sourceStart);
        const duration = sliceEnd - sliceStart;

        const pixelStart = (tStart / projectDuration) * totalTimelineWidth;
        const pixelWidth = (duration / projectDuration) * totalTimelineWidth;

        results.push({
          id: slice.id,
          pixelStart,
          pixelWidth,
          isKept: slice.isKept === true,
          isSelected: selectedSilenceId === slice.id,
        });
      });
    });

    return results;
  }, [hasMedia, effectiveClips, silenceSlices, projectDuration, totalTimelineWidth, selectedSilenceId]);

  const { handleMouseDown } = useTimelineGestures({
    scrollRef,
    playheadRef,
    videoCanvasRef,
    waveformCanvasRef,
    totalTimelineWidth,
    projectDuration,
    hasMedia,
    zoomLevel,
    setZoomLevel,
    maxSafeZoom,
    viewportWidth,
    timelineCurrentTime,
    effectiveClips,
    silenceSlices,
    renderedSilenceCuts,
    selectedSilenceId,
    onSeekTimeline,
    onSelectClip,
    onSelectSilence,
    onToggleKeepSilence,
  });

  return (
    <div
      ref={containerRef}
      className="h-[218px] mx-2 mb-2 vulcanite-panel border-t-2 border-black/90 flex flex-col select-none shrink-0 relative overflow-hidden rounded-[6px] p-1.5 gap-1.5 border border-[var(--border-panel-groove)] panel-groove contain-paint"
    >
      <TimelineTransportControls
        hasMedia={hasMedia}
        projectDuration={projectDuration}
        timelineCurrentTime={timelineCurrentTime}
        effectiveClips={effectiveClips}
        silenceSlices={silenceSlices}
        selectedClipId={selectedClipId}
        selectedSilenceId={selectedSilenceId}
        canUndo={canUndo}
        canRedo={canRedo}
        zoomLevel={zoomLevel}
        maxSafeZoom={maxSafeZoom}
        fps={fps}
        setZoomLevel={setZoomLevel}
        onUndo={onUndo}
        onRedo={onRedo}
        onSplitClip={onSplitClip}
        onToggleDeleteClip={onToggleDeleteClip}
        onToggleKeepSilence={onToggleKeepSilence}
      />

      <TracksContainer
        scrollRef={scrollRef}
        totalTimelineWidth={totalTimelineWidth}
        hasMedia={hasMedia}
        onMouseDown={handleMouseDown}
        playheadSlot={<PlayheadOverlay playheadRef={playheadRef} hasMedia={hasMedia} />}
        rulerSlot={
          <TimelineRuler
            rulerCanvasRef={rulerCanvasRef}
            totalTimelineWidth={totalTimelineWidth}
            projectDuration={projectDuration}
            hasMedia={hasMedia}
          />
        }
        videoTrackSlot={
          <VideoClipsTrack
            videoCanvasRef={videoCanvasRef}
            totalTimelineWidth={totalTimelineWidth}
            projectDuration={projectDuration}
            hasMedia={hasMedia}
            effectiveClips={effectiveClips}
            selectedClipId={selectedClipId}
          />
        }
        waveformTrackSlot={
          <WaveformTrack
            waveformCanvasRef={waveformCanvasRef}
            totalTimelineWidth={totalTimelineWidth}
            projectDuration={projectDuration}
            hasMedia={hasMedia}
            effectiveClips={effectiveClips}
            silenceSlices={silenceSlices}
            renderedSilenceCuts={renderedSilenceCuts}
          />
        }
      />
    </div>
  );
});

TrimBinTimeline.displayName = 'TrimBinTimeline';

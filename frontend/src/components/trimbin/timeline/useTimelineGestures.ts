import { useRef, useEffect, useCallback } from 'react';
import { ComputedTimelineClip, SilenceSlice } from '../../../types/timeline';
import { getSourceTime } from '../../../utils/timelineEngine';

export interface RenderedSilenceCut {
  id: string;
  pixelStart: number;
  pixelWidth: number;
  isKept: boolean;
  isSelected: boolean;
}

export interface UseTimelineGesturesProps {
  scrollRef: React.RefObject<HTMLDivElement>;
  playheadRef: React.RefObject<HTMLDivElement>;
  videoCanvasRef: React.RefObject<HTMLCanvasElement>;
  waveformCanvasRef: React.RefObject<HTMLCanvasElement>;
  totalTimelineWidth: number;
  projectDuration: number;
  hasMedia: boolean;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  maxSafeZoom: number;
  viewportWidth: number;
  timelineCurrentTime: number;
  effectiveClips: ComputedTimelineClip[];
  silenceSlices: SilenceSlice[];
  renderedSilenceCuts: RenderedSilenceCut[];
  selectedSilenceId?: string | null;
  onSeekTimeline: (timelineTimeSec: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onSelectSilence?: (silenceId: string | null) => void;
  onToggleKeepSilence?: (silenceId?: string) => void;
}

export function useTimelineGestures({
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
}: UseTimelineGesturesProps) {
  const isScrubbingRef = useRef(false);
  const isPanningRef = useRef(false);
  const startPanRef = useRef({ startX: 0, scrollLeft: 0 });
  const rafScrubRef = useRef<number | null>(null);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  useEffect(() => {
    if (isScrubbingRef.current) return;
    if (playheadRef.current && hasMedia && projectDuration > 0) {
      const px = (timelineCurrentTime / projectDuration) * totalTimelineWidth;
      playheadRef.current.style.transform = `translate3d(${px}px, 0, 0) translateX(-50%)`;
    }
  }, [timelineCurrentTime, hasMedia, projectDuration, totalTimelineWidth, playheadRef]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !hasMedia) return;

    let rafId: number | null = null;
    let pendingZoom = zoomLevelRef.current;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const zoomDelta = -e.deltaY * 0.008;
        const current = pendingZoom;
        const newZoom = Math.max(1, Math.min(maxSafeZoom, current * Math.exp(zoomDelta)));

        if (Math.abs(newZoom - current) < 0.0001 || projectDuration <= 0) return;

        pendingZoom = newZoom;

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            const rect = scrollEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const scrollLeft = scrollEl.scrollLeft;
            const currentTotalWidth = Math.round(viewportWidth * current);
            const anchorTime = ((scrollLeft + mouseX) / currentTotalWidth) * projectDuration;

            setZoomLevel(newZoom);
            zoomLevelRef.current = newZoom;

            const nextTotalWidth = Math.round(viewportWidth * newZoom);
            const newScrollLeft = (anchorTime / projectDuration) * nextTotalWidth - mouseX;

            scrollEl.scrollLeft = Math.max(0, newScrollLeft);
            rafId = null;
          });
        }
      } else if (scrollEl.scrollWidth > scrollEl.clientWidth) {
        e.preventDefault();
        e.stopPropagation();
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const speedMultiplier = e.shiftKey ? 2.5 : 1.2;
        scrollEl.scrollLeft += delta * speedMultiplier;
      }
    };

    scrollEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      scrollEl.removeEventListener('wheel', handleWheel);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [hasMedia, projectDuration, viewportWidth, maxSafeZoom, scrollRef, setZoomLevel]);

  const handleSeekFromEvent = useCallback(
    (clientX: number, clientY?: number, isDirectClick: boolean = false) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl || !hasMedia || projectDuration <= 0) return;

      const rect = scrollEl.getBoundingClientRect();
      const offsetX = clientX - rect.left + scrollEl.scrollLeft;
      const clampedX = Math.max(0, Math.min(totalTimelineWidth, offsetX));
      const percentage = clampedX / totalTimelineWidth;
      const targetTimelineTime = percentage * projectDuration;

      if (playheadRef.current) {
        playheadRef.current.style.transform = `translate3d(${clampedX}px, 0, 0) translateX(-50%)`;
      }

      if (isDirectClick) {
        onSeekTimeline(targetTimelineTime);

        const videoRect = videoCanvasRef.current?.getBoundingClientRect();
        const waveformRect = waveformCanvasRef.current?.getBoundingClientRect();

        const isClickOnVideoTrack = !!(
          videoRect &&
          clientY !== undefined &&
          clientY >= videoRect.top &&
          clientY <= videoRect.bottom
        );
        const isClickOnAudioTrack = !!(
          waveformRect &&
          clientY !== undefined &&
          clientY >= waveformRect.top &&
          clientY <= waveformRect.bottom
        );

        if (isClickOnVideoTrack) {
          if (onSelectSilence) onSelectSilence(null);
          if (effectiveClips.length > 0) {
            const found = effectiveClips.find(
              (c) => targetTimelineTime >= c.timelineStart - 0.001 && targetTimelineTime <= c.timelineEnd + 0.001
            );
            onSelectClip(found ? found.id : null);
          }
        } else if (isClickOnAudioTrack) {
          onSelectClip(null);
          const sourceTime = getSourceTime(targetTimelineTime, effectiveClips);

          let hitSilence = silenceSlices.find(
            (s) => s.isSilent && sourceTime >= s.start && sourceTime <= s.end
          );

          if (!hitSilence && renderedSilenceCuts.length > 0) {
            let closestDist = Infinity;
            for (const cut of renderedSilenceCuts) {
              const dist =
                clampedX < cut.pixelStart
                  ? cut.pixelStart - clampedX
                  : clampedX > cut.pixelStart + cut.pixelWidth
                  ? clampedX - (cut.pixelStart + cut.pixelWidth)
                  : 0;
              if (dist <= 16 && dist < closestDist) {
                closestDist = dist;
                hitSilence = silenceSlices.find((s) => s.id === cut.id);
              }
            }
          }

          if (onSelectSilence) {
            onSelectSilence(hitSilence ? hitSilence.id : null);
          }
        }
      } else {
        if (!rafScrubRef.current) {
          rafScrubRef.current = requestAnimationFrame(() => {
            rafScrubRef.current = null;
            onSeekTimeline(targetTimelineTime);
          });
        }
      }
    },
    [
      hasMedia,
      projectDuration,
      totalTimelineWidth,
      onSeekTimeline,
      effectiveClips,
      onSelectClip,
      silenceSlices,
      onSelectSilence,
      renderedSilenceCuts,
      scrollRef,
      playheadRef,
      videoCanvasRef,
      waveformCanvasRef,
    ]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasMedia) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanningRef.current = true;
      startPanRef.current = {
        startX: e.clientX,
        scrollLeft: scrollEl.scrollLeft,
      };
      return;
    }

    if (e.button === 0) {
      isScrubbingRef.current = true;
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      handleSeekFromEvent(e.clientX, e.clientY, true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current && scrollRef.current) {
        const dx = e.clientX - startPanRef.current.startX;
        scrollRef.current.scrollLeft = startPanRef.current.scrollLeft - dx;
        return;
      }
      if (isScrubbingRef.current) {
        handleSeekFromEvent(e.clientX, undefined, false);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
      }
      if (isScrubbingRef.current) {
        isScrubbingRef.current = false;
        if (rafScrubRef.current !== null) {
          cancelAnimationFrame(rafScrubRef.current);
          rafScrubRef.current = null;
        }
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx < 4 && dy < 4) {
          handleSeekFromEvent(e.clientX, e.clientY, true);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafScrubRef.current !== null) {
        cancelAnimationFrame(rafScrubRef.current);
      }
    };
  }, [handleSeekFromEvent, scrollRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (e.key === 'r' || e.key === 'R' || e.key === 'k' || e.key === 'K') {
        const currentSourceTime = getSourceTime(timelineCurrentTime, effectiveClips);
        const targetSilence = selectedSilenceId
          ? silenceSlices.find((s) => s.id === selectedSilenceId && s.isSilent)
          : silenceSlices.find((s) => s.isSilent && currentSourceTime >= s.start && currentSourceTime <= s.end);

        if (targetSilence && onToggleKeepSilence) {
          e.preventDefault();
          onToggleKeepSilence(targetSilence.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSilenceId, silenceSlices, timelineCurrentTime, effectiveClips, onToggleKeepSilence]);

  return {
    handleMouseDown,
  };
}

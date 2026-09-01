import { useState, useRef, useEffect, useCallback } from 'react';
import { SelectedFile } from '@/global';
import { ComputedTimelineClip, PlayableSegment } from '../types/timeline';
import { getSourceTime, getTimelineTime } from '../utils/timelineEngine';

export interface UsePlaybackEngineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  selectedFile: SelectedFile | null;
  activeMagneticClips: ComputedTimelineClip[];
  playableSegments: PlayableSegment[];
  totalProjectDuration: number;
  sourceDuration: number;
}

export interface UsePlaybackEngineReturn {
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  sourceCurrentTime: number;
  setSourceCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  timelineCurrentTime: number;
  setTimelineCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  fps: number;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  smartSkipOn: boolean;
  setSmartSkipOn: React.Dispatch<React.SetStateAction<boolean>>;
  seekSource: (targetSource: number) => void;
  seekTimeline: (timelineTimeSec: number) => void;
  handleTimeUpdate: () => void;
  togglePlay: () => void;
  jumpNextCut: () => void;
  jumpPrevCut: () => void;
}

export function usePlaybackEngine({
  videoRef,
  selectedFile,
  activeMagneticClips,
  playableSegments,
  totalProjectDuration,
  sourceDuration,
}: UsePlaybackEngineProps): UsePlaybackEngineReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sourceCurrentTime, setSourceCurrentTime] = useState(0);
  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0);
  const [fps, setFps] = useState(30);
  const [isMuted, setIsMuted] = useState(false);
  const [smartSkipOn, setSmartSkipOn] = useState(true);

  const targetSeekTimeRef = useRef<{ time: number; timestamp: number } | null>(null);

  const seekTimeline = useCallback(
    (timelineTimeSec: number) => {
      const targetSource = getSourceTime(timelineTimeSec, activeMagneticClips);
      if (videoRef.current) {
        videoRef.current.currentTime = targetSource;
      }
      setSourceCurrentTime(targetSource);
      setTimelineCurrentTime(timelineTimeSec);
    },
    [activeMagneticClips, videoRef]
  );

  const seekSource = useCallback(
    (sourceTimeSec: number) => {
      let targetSource = sourceTimeSec;
      if (smartSkipOn && isPlaying && playableSegments.length > 0) {
        const inPlayable = playableSegments.some(
          (s) => targetSource >= s.start - 0.05 && targetSource < s.end - 0.02
        );
        if (!inPlayable) {
          const next = playableSegments.find((s) => s.start > targetSource);
          if (next) {
            targetSource = next.start;
          }
        }
      }
      if (videoRef.current) {
        videoRef.current.currentTime = targetSource;
      }
      setSourceCurrentTime(targetSource);
      const tTime = getTimelineTime(targetSource, activeMagneticClips);
      setTimelineCurrentTime(tTime);
    },
    [activeMagneticClips, smartSkipOn, isPlaying, playableSegments, videoRef]
  );

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setSourceCurrentTime(cur);

    if (activeMagneticClips.length > 0) {
      const tTime = getTimelineTime(cur, activeMagneticClips);
      setTimelineCurrentTime(tTime);
    }
  }, [activeMagneticClips, videoRef]);

  // High-precision 60fps playhead tick & seamless cut skipping
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;

    const tick = () => {
      const video = videoRef.current;
      if (!video || video.paused) {
        animId = requestAnimationFrame(tick);
        return;
      }

      const cur = video.currentTime;

      if (targetSeekTimeRef.current !== null) {
        const isTimeout = Date.now() - targetSeekTimeRef.current.timestamp > 350;
        const isReached =
          Math.abs(cur - targetSeekTimeRef.current.time) < 0.3 ||
          cur >= targetSeekTimeRef.current.time;

        if (isReached || isTimeout) {
          targetSeekTimeRef.current = null;
        } else {
          animId = requestAnimationFrame(tick);
          return;
        }
      }

      if (activeMagneticClips.length > 0) {
        if (smartSkipOn && playableSegments.length > 0) {
          const lastPlayable = playableSegments[playableSegments.length - 1];
          const currentSeg = playableSegments.find(
            (seg) => cur >= seg.start - 0.05 && cur < seg.end - 0.02
          );

          if (!currentSeg) {
            const nextPlayable = playableSegments.find((seg) => seg.start > cur + 0.01);
            if (nextPlayable) {
              targetSeekTimeRef.current = { time: nextPlayable.start, timestamp: Date.now() };
              video.currentTime = nextPlayable.start;
              setSourceCurrentTime(nextPlayable.start);
              setTimelineCurrentTime(getTimelineTime(nextPlayable.start, activeMagneticClips));
              animId = requestAnimationFrame(tick);
              return;
            }

            if (cur >= (lastPlayable?.end || 0) - 0.05) {
              video.currentTime = lastPlayable.end;
              video.pause();
              setIsPlaying(false);
              setSourceCurrentTime(lastPlayable.end);
              setTimelineCurrentTime(totalProjectDuration);
              return;
            }
          }
        } else {
          const lastClip = activeMagneticClips[activeMagneticClips.length - 1];
          const currentActiveClip = activeMagneticClips.find(
            (c) => cur >= c.sourceStart - 0.05 && cur < c.sourceEnd - 0.02
          );

          if (!currentActiveClip) {
            const nextClip = activeMagneticClips.find((c) => c.sourceStart > cur + 0.01);
            if (nextClip) {
              targetSeekTimeRef.current = { time: nextClip.sourceStart, timestamp: Date.now() };
              video.currentTime = nextClip.sourceStart;
              setSourceCurrentTime(nextClip.sourceStart);
              setTimelineCurrentTime(getTimelineTime(nextClip.sourceStart, activeMagneticClips));
              animId = requestAnimationFrame(tick);
              return;
            }

            if (cur >= (lastClip?.sourceEnd || 0) - 0.05) {
              video.currentTime = lastClip.sourceEnd;
              video.pause();
              setIsPlaying(false);
              setSourceCurrentTime(lastClip.sourceEnd);
              setTimelineCurrentTime(totalProjectDuration);
              return;
            }
          }
        }

        setSourceCurrentTime(cur);
        setTimelineCurrentTime(getTimelineTime(cur, activeMagneticClips));
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, smartSkipOn, playableSegments, activeMagneticClips, totalProjectDuration, videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying || !video.paused) {
      video.pause();
      setIsPlaying(false);
      targetSeekTimeRef.current = null;
      return;
    }

    let cur = video.currentTime;
    const maxDur = sourceDuration > 0 ? sourceDuration : (video.duration || 0);
    if (maxDur > 0 && cur >= maxDur - 0.1) {
      cur = 0;
      video.currentTime = 0;
      setSourceCurrentTime(0);
      setTimelineCurrentTime(0);
    }

    if (smartSkipOn && playableSegments.length > 0) {
      const inSeg = playableSegments.find(
        (s) => cur >= s.start - 0.05 && cur < s.end - 0.02
      );
      if (!inSeg) {
        const next = playableSegments.find((s) => s.start > cur);
        if (next) {
          targetSeekTimeRef.current = { time: next.start, timestamp: Date.now() };
          video.currentTime = next.start;
          setSourceCurrentTime(next.start);
          setTimelineCurrentTime(getTimelineTime(next.start, activeMagneticClips));
        }
      }
    } else if (activeMagneticClips.length > 0) {
      const inClip = activeMagneticClips.find(
        (c) => cur >= c.sourceStart - 0.05 && cur < c.sourceEnd - 0.02
      );
      if (!inClip) {
        const next = activeMagneticClips.find((c) => c.sourceStart > cur);
        if (next) {
          targetSeekTimeRef.current = { time: next.sourceStart, timestamp: Date.now() };
          video.currentTime = next.sourceStart;
          setSourceCurrentTime(next.sourceStart);
          setTimelineCurrentTime(getTimelineTime(next.sourceStart, activeMagneticClips));
        }
      }
    }

    video
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error('Playback execution error:', err));
  }, [isPlaying, smartSkipOn, playableSegments, activeMagneticClips, sourceDuration, videoRef]);

  const jumpNextCut = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playableSegments.length > 0) {
      const cur = video.currentTime;
      const next = playableSegments.find((s) => s.start > cur + 0.08);
      if (next) {
        video.currentTime = next.start;
        setSourceCurrentTime(next.start);
        setTimelineCurrentTime(getTimelineTime(next.start, activeMagneticClips));
        return;
      }
      const last = playableSegments[playableSegments.length - 1];
      const target = Math.min(video.duration || last.end, last.end);
      video.currentTime = target;
      setSourceCurrentTime(target);
      setTimelineCurrentTime(getTimelineTime(target, activeMagneticClips));
      return;
    }

    const nextTime = Math.min(video.duration || 0, video.currentTime + 5);
    video.currentTime = nextTime;
    setSourceCurrentTime(nextTime);
    setTimelineCurrentTime(getTimelineTime(nextTime, activeMagneticClips));
  }, [playableSegments, activeMagneticClips, videoRef]);

  const jumpPrevCut = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playableSegments.length > 0) {
      const cur = video.currentTime;
      const currentSegment = playableSegments.find(
        (s) => cur >= s.start - 0.05 && cur <= s.end + 0.05
      );
      if (currentSegment && cur > currentSegment.start + 0.5) {
        video.currentTime = currentSegment.start;
        setSourceCurrentTime(currentSegment.start);
        setTimelineCurrentTime(getTimelineTime(currentSegment.start, activeMagneticClips));
        return;
      }

      const prevList = playableSegments.filter((s) => s.start < cur - 0.2);
      const target = prevList.length > 0 ? prevList[prevList.length - 1] : playableSegments[0];
      video.currentTime = target.start;
      setSourceCurrentTime(target.start);
      setTimelineCurrentTime(getTimelineTime(target.start, activeMagneticClips));
      return;
    }

    const prevTime = Math.max(0, video.currentTime - 5);
    video.currentTime = prevTime;
    setSourceCurrentTime(prevTime);
    setTimelineCurrentTime(getTimelineTime(prevTime, activeMagneticClips));
  }, [playableSegments, activeMagneticClips, videoRef]);

  // Pause playback if no active media file is loaded
  useEffect(() => {
    if (!selectedFile && isPlaying) {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  }, [selectedFile, isPlaying, videoRef]);

  return {
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
  };
}

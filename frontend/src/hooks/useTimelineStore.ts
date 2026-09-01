import { useState, useCallback, useMemo } from 'react';
import {
  UserClip,
  ComputedTimelineClip,
  SilenceSlice,
  TimelineSnapshot,
  TimelineHistory,
  PlayableSegment,
  CutRange,
} from '../types/timeline';
import {
  createInitialClips,
  computeMagneticTimeline,
  computePlayableSegments,
  computeCutRanges,
  splitClipAtTime,
  toggleDeleteClip as toggleDeleteClipUtil,
} from '../utils/timelineEngine';

const MAX_HISTORY = 50;

export interface UseTimelineStoreReturn {
  clips: UserClip[];
  activeMagneticClips: ComputedTimelineClip[];
  totalProjectDuration: number;
  silenceSlices: SilenceSlice[];
  selectedClipId: string | null;
  selectedSilenceId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  playableSegments: PlayableSegment[];
  cutRanges: CutRange[];
  totalPlayableDuration: number;
  totalCutDuration: number;
  savedPercentage: number;
  cutsCount: number;

  initTimeline: (duration: number, fileName: string, initialSlices?: SilenceSlice[]) => void;
  setInitialSilenceAnalysis: (slices: SilenceSlice[]) => void;
  setSilenceAnalysis: (slices: SilenceSlice[]) => void;
  splitClip: (sourceTimeSec: number) => void;
  toggleDeleteSelectedClip: (clipId?: string) => void;
  selectClip: (clipId: string | null) => void;
  selectSilence: (silenceId: string | null) => void;
  toggleKeepSelectedSilence: (silenceId?: string) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  resetTimeline: () => void;
}

export function useTimelineStore(duration: number): UseTimelineStoreReturn {
  const [clips, setClips] = useState<UserClip[]>([]);
  const [silenceSlices, setSilenceSlices] = useState<SilenceSlice[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedSilenceId, setSelectedSilenceId] = useState<string | null>(null);

  const [history, setHistory] = useState<TimelineHistory>({
    past: [],
    future: [],
  });

  const pushHistory = useCallback((currentClips: UserClip[], currentSlices: SilenceSlice[]) => {
    const clipsToSave = currentClips && currentClips.length > 0
      ? currentClips
      : (duration > 0 ? createInitialClips(duration, 'video') : []);

    if (clipsToSave.length === 0) return;

    setHistory((prev) => ({
      past: [
        ...prev.past.slice(-(MAX_HISTORY - 1)),
        {
          clips: JSON.parse(JSON.stringify(clipsToSave)),
          silenceSlices: JSON.parse(JSON.stringify(currentSlices || [])),
        },
      ],
      future: [],
    }));
  }, [duration]);

  const initTimeline = useCallback((dur: number, fileName: string, initialSlices: SilenceSlice[] = []) => {
    const initialClips = createInitialClips(dur, fileName);
    setClips(initialClips);
    setSilenceSlices(initialSlices);
    setSelectedClipId(initialClips.length > 0 ? initialClips[0].id : null);
    setSelectedSilenceId(null);
    setHistory({ past: [], future: [] });
  }, []);

  const setInitialSilenceAnalysis = useCallback((slices: SilenceSlice[]) => {
    setSilenceSlices(slices);
    setSelectedSilenceId(null);
    setHistory({ past: [], future: [] });
  }, []);

  const setSilenceAnalysis = useCallback((slices: SilenceSlice[]) => {
    pushHistory(clips, silenceSlices);
    setSilenceSlices(slices);
    setSelectedSilenceId(null);
  }, [clips, silenceSlices, pushHistory]);

  const splitClip = useCallback((sourceTimeSec: number) => {
    setClips((prevClips) => {
      const { clips: nextClips, newClipId } = splitClipAtTime(prevClips, sourceTimeSec);
      if (newClipId) {
        pushHistory(prevClips, silenceSlices);
        setSelectedClipId(newClipId);
        return nextClips;
      }
      return prevClips;
    });
  }, [silenceSlices, pushHistory]);

  const toggleDeleteSelectedClip = useCallback((clipId?: string) => {
    const targetId = clipId || selectedClipId;
    if (!targetId) return;

    setClips((prevClips) => {
      const activeClips = prevClips.filter((c) => !c.isDeleted);
      const targetClip = prevClips.find((c) => c.id === targetId);

      if (targetClip && !targetClip.isDeleted && activeClips.length <= 1) {
        return prevClips;
      }

      pushHistory(prevClips, silenceSlices);
      return toggleDeleteClipUtil(prevClips, targetId);
    });
  }, [selectedClipId, silenceSlices, pushHistory]);

  const toggleKeepSelectedSilence = useCallback((silenceId?: string) => {
    const targetId = silenceId || selectedSilenceId;
    if (!targetId) return;

    setSilenceSlices((prevSlices) => {
      pushHistory(clips, prevSlices);
      return prevSlices.map((s) => {
        if (s.id === targetId && s.isSilent) {
          return { ...s, isKept: !s.isKept };
        }
        return s;
      });
    });
  }, [selectedSilenceId, clips, pushHistory]);

  const selectClip = useCallback((clipId: string | null) => {
    setSelectedClipId(clipId);
  }, []);

  const selectSilence = useCallback((silenceId: string | null) => {
    setSelectedSilenceId(silenceId);
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const previousSnapshot = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

      const currentSnapshot: TimelineSnapshot = {
        clips: JSON.parse(JSON.stringify(clips)),
        silenceSlices: JSON.parse(JSON.stringify(silenceSlices)),
      };

      setClips(previousSnapshot.clips);
      setSilenceSlices(previousSnapshot.silenceSlices);

      return {
        past: newPast,
        future: [currentSnapshot, ...prev.future],
      };
    });
  }, [clips, silenceSlices]);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      const nextSnapshot = prev.future[0];
      const newFuture = prev.future.slice(1);

      const currentSnapshot: TimelineSnapshot = {
        clips: JSON.parse(JSON.stringify(clips)),
        silenceSlices: JSON.parse(JSON.stringify(silenceSlices)),
      };

      setClips(nextSnapshot.clips);
      setSilenceSlices(nextSnapshot.silenceSlices);

      return {
        past: [...prev.past, currentSnapshot],
        future: newFuture,
      };
    });
  }, [clips, silenceSlices]);

  const clearHistory = useCallback(() => {
    setHistory({ past: [], future: [] });
  }, []);

  const resetTimeline = useCallback(() => {
    setClips([]);
    setSilenceSlices([]);
    setSelectedClipId(null);
    setSelectedSilenceId(null);
    setHistory({ past: [], future: [] });
  }, []);

  const { activeClips: activeMagneticClips, totalProjectDuration } = useMemo(() => {
    return computeMagneticTimeline(clips);
  }, [clips]);

  const playableSegments = useMemo(() => {
    return computePlayableSegments(clips, silenceSlices, duration);
  }, [clips, silenceSlices, duration]);

  const cutRanges = useMemo(() => {
    return computeCutRanges(clips, silenceSlices, duration);
  }, [clips, silenceSlices, duration]);

  const totalPlayableDuration = useMemo(() => {
    return parseFloat(
      playableSegments.reduce((acc, s) => acc + s.duration, 0).toFixed(3)
    );
  }, [playableSegments]);

  const totalCutDuration = useMemo(() => {
    return parseFloat(
      cutRanges.reduce((acc, c) => acc + c.duration, 0).toFixed(3)
    );
  }, [cutRanges]);

  const savedPercentage = useMemo(() => {
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((totalCutDuration / duration) * 100)));
  }, [totalCutDuration, duration]);

  const cutsCount = useMemo(() => {
    return cutRanges.length;
  }, [cutRanges]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return {
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
    totalPlayableDuration,
    totalCutDuration,
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
    clearHistory,
    resetTimeline,
  };
}

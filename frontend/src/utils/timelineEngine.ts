import { UserClip, ComputedTimelineClip, SilenceSlice, PlayableSegment, CutRange } from '../types/timeline';
import { SilenceCut } from '@/global';

let idCounter = 1;
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}_${idCounter++}`;
};

export function createInitialClips(duration: number, fileName: string = 'Video Clip'): UserClip[] {
  if (duration <= 0) return [];
  return [
    {
      id: generateId('clip'),
      name: fileName.replace(/\.[^/.]+$/, ''),
      sourceStart: 0,
      sourceEnd: parseFloat(duration.toFixed(3)),
      isDeleted: false,
    },
  ];
}

export function convertCutsToSilenceSlices(
  silenceCuts: SilenceCut[],
  duration: number
): SilenceSlice[] {
  if (duration <= 0) return [];
  if (!silenceCuts || silenceCuts.length === 0) {
    return [
      {
        id: generateId('slice'),
        start: 0,
        end: parseFloat(duration.toFixed(3)),
        isSilent: false,
      },
    ];
  }

  const sortedCuts = [...silenceCuts]
    .map((c) => ({
      inSec: Math.max(0, Math.min(duration, c.inSec)),
      outSec: Math.max(0, Math.min(duration, c.outSec)),
    }))
    .filter((c) => c.outSec > c.inSec)
    .sort((a, b) => a.inSec - b.inSec);

  const slices: SilenceSlice[] = [];
  let currentPos = 0;

  for (const cut of sortedCuts) {
    if (cut.inSec > currentPos + 0.01) {
      slices.push({
        id: generateId('speech'),
        start: parseFloat(currentPos.toFixed(3)),
        end: parseFloat(cut.inSec.toFixed(3)),
        isSilent: false,
      });
    }

    slices.push({
      id: generateId('silence'),
      start: parseFloat(cut.inSec.toFixed(3)),
      end: parseFloat(cut.outSec.toFixed(3)),
      isSilent: true,
    });

    currentPos = cut.outSec;
  }

  if (currentPos < duration - 0.01) {
    slices.push({
      id: generateId('speech'),
      start: parseFloat(currentPos.toFixed(3)),
      end: parseFloat(duration.toFixed(3)),
      isSilent: false,
    });
  }

  return slices;
}

export function computeMagneticTimeline(clips: UserClip[]): {
  activeClips: ComputedTimelineClip[];
  totalProjectDuration: number;
} {
  let currentOffset = 0;
  const activeClips: ComputedTimelineClip[] = [];

  for (const clip of clips) {
    if (!clip.isDeleted) {
      const dur = parseFloat((clip.sourceEnd - clip.sourceStart).toFixed(3));
      if (dur > 0.001) {
        const start = parseFloat(currentOffset.toFixed(3));
        const end = parseFloat((currentOffset + dur).toFixed(3));
        activeClips.push({
          ...clip,
          timelineStart: start,
          timelineEnd: end,
          duration: dur,
        });
        currentOffset += dur;
      }
    }
  }

  return {
    activeClips,
    totalProjectDuration: parseFloat(currentOffset.toFixed(3)),
  };
}

export function getSourceTime(
  timelineTime: number,
  activeClips: ComputedTimelineClip[]
): number {
  if (activeClips.length === 0) return 0;

  for (const clip of activeClips) {
    if (timelineTime >= clip.timelineStart && timelineTime <= clip.timelineEnd) {
      const offsetInClip = timelineTime - clip.timelineStart;
      return parseFloat((clip.sourceStart + offsetInClip).toFixed(3));
    }
  }

  if (timelineTime <= 0) return activeClips[0].sourceStart;
  return activeClips[activeClips.length - 1].sourceEnd;
}

export function getTimelineTime(
  sourceTime: number,
  activeClips: ComputedTimelineClip[]
): number {
  if (activeClips.length === 0) return 0;

  for (const clip of activeClips) {
    if (sourceTime >= clip.sourceStart && sourceTime <= clip.sourceEnd) {
      const offset = sourceTime - clip.sourceStart;
      return parseFloat((clip.timelineStart + offset).toFixed(3));
    }
  }

  // if time falls into a deleted gap, snap to next active clip start
  if (sourceTime < activeClips[0].sourceStart) {
    return 0;
  }

  for (let i = 0; i < activeClips.length - 1; i++) {
    if (sourceTime > activeClips[i].sourceEnd && sourceTime < activeClips[i + 1].sourceStart) {
      return activeClips[i + 1].timelineStart;
    }
  }

  return activeClips[activeClips.length - 1].timelineEnd;
}

export function computePlayableSegments(
  clips: UserClip[],
  silenceSlices: SilenceSlice[],
  duration: number
): PlayableSegment[] {
  const activeClips = clips.filter((c) => !c.isDeleted);
  if (activeClips.length === 0) return [];

  if (!silenceSlices || silenceSlices.length === 0) {
    return activeClips.map((c) => ({
      clipId: c.id,
      start: c.sourceStart,
      end: c.sourceEnd,
      duration: parseFloat((c.sourceEnd - c.sourceStart).toFixed(3)),
    }));
  }

  const speechSlices = silenceSlices.filter((s) => !s.isSilent || s.isKept === true);
  const segments: PlayableSegment[] = [];

  for (const clip of activeClips) {
    for (const slice of speechSlices) {
      const segStart = Math.max(clip.sourceStart, slice.start);
      const segEnd = Math.min(clip.sourceEnd, slice.end);

      if (segEnd > segStart + 0.01) {
        segments.push({
          clipId: clip.id,
          start: parseFloat(segStart.toFixed(3)),
          end: parseFloat(segEnd.toFixed(3)),
          duration: parseFloat((segEnd - segStart).toFixed(3)),
        });
      }
    }
  }

  return segments.sort((a, b) => a.start - b.start);
}

export function computeCutRanges(
  clips: UserClip[],
  silenceSlices: SilenceSlice[],
  duration: number
): CutRange[] {
  if (duration <= 0) return [];
  const playable = computePlayableSegments(clips, silenceSlices, duration);
  if (playable.length === 0) {
    return [{
      start: 0,
      end: parseFloat(duration.toFixed(3)),
      duration: parseFloat(duration.toFixed(3)),
      reason: 'silence',
    }];
  }

  const cutRanges: CutRange[] = [];
  let currentPos = 0;

  for (const seg of playable) {
    if (seg.start > currentPos + 0.01) {
      const start = parseFloat(currentPos.toFixed(3));
      const end = parseFloat(seg.start.toFixed(3));
      cutRanges.push({
        start,
        end,
        duration: parseFloat((end - start).toFixed(3)),
        reason: 'silence',
      });
    }
    currentPos = Math.max(currentPos, seg.end);
  }

  if (currentPos < duration - 0.01) {
    const start = parseFloat(currentPos.toFixed(3));
    const end = parseFloat(duration.toFixed(3));
    cutRanges.push({
      start,
      end,
      duration: parseFloat((end - start).toFixed(3)),
      reason: 'silence',
    });
  }

  return cutRanges.sort((a, b) => a.start - b.start);
}

export function splitClipAtTime(
  clips: UserClip[],
  sourceTimeSec: number
): { clips: UserClip[]; newClipId: string | null } {
  const time = parseFloat(sourceTimeSec.toFixed(3));
  const targetIndex = clips.findIndex(
    (c) => !c.isDeleted && time > c.sourceStart + 0.02 && time < c.sourceEnd - 0.02
  );

  if (targetIndex === -1) {
    return { clips, newClipId: null };
  }

  const targetClip = clips[targetIndex];
  const firstHalf: UserClip = {
    ...targetClip,
    sourceEnd: time,
  };

  const secondHalf: UserClip = {
    id: generateId('clip'),
    name: `${targetClip.name.replace(/_part\d+$/, '')}_part`,
    sourceStart: time,
    sourceEnd: targetClip.sourceEnd,
    isDeleted: false,
  };

  const nextClips = [
    ...clips.slice(0, targetIndex),
    firstHalf,
    secondHalf,
    ...clips.slice(targetIndex + 1),
  ];

  return { clips: nextClips, newClipId: secondHalf.id };
}

// toggle clip deletion (soft delete with ripple collapse)
export function toggleDeleteClip(
  clips: UserClip[],
  clipId: string
): UserClip[] {
  return clips.map((c) => {
    if (c.id === clipId) {
      return { ...c, isDeleted: !c.isDeleted };
    }
    return c;
  });
}

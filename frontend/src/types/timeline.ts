export interface UserClip {
  id: string;
  name: string;
  sourceStart: number;
  sourceEnd: number;
  isDeleted: boolean;
}

export interface ComputedTimelineClip extends UserClip {
  timelineStart: number;
  timelineEnd: number;
  duration: number;
}

export interface SilenceSlice {
  id: string;
  start: number;
  end: number;
  isSilent: boolean;
  isKept?: boolean;
}

export interface PlayableSegment {
  clipId: string;
  start: number;
  end: number;
  duration: number;
}

export interface CutRange {
  start: number;
  end: number;
  duration: number;
  reason: 'silence' | 'deleted_clip';
}

export interface TimelineSnapshot {
  clips: UserClip[];
  silenceSlices: SilenceSlice[];
}

export interface TimelineHistory {
  past: TimelineSnapshot[];
  future: TimelineSnapshot[];
}

export interface SilenceSettings {
  isAdvancedMode: boolean;
  threshold: number;
  isAutoThreshold: boolean;
  minSilenceDuration: number;
  paddingLeft: number;
  paddingRight: number;
  isPaddingLinked: boolean;
  minClipDuration: number;
}

export const DEFAULT_SILENCE_SETTINGS: SilenceSettings = {
  isAdvancedMode: false,
  threshold: -25,
  isAutoThreshold: false,
  minSilenceDuration: 0.0,
  paddingLeft: 0.2,
  paddingRight: 0.2,
  isPaddingLinked: true,
  minClipDuration: 0.0,
};

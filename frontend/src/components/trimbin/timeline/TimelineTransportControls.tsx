import React from 'react';
import { RotateCcw, RotateCw, Scissors, Trash2, ShieldCheck, ZoomIn, ZoomOut } from 'lucide-react';
import { ComputedTimelineClip, SilenceSlice } from '../../../types/timeline';
import { getSourceTime } from '../../../utils/timelineEngine';

export interface TimelineTransportControlsProps {
  hasMedia: boolean;
  projectDuration: number;
  timelineCurrentTime: number;
  effectiveClips: ComputedTimelineClip[];
  silenceSlices: SilenceSlice[];
  selectedClipId: string | null;
  selectedSilenceId?: string | null;
  canUndo: boolean;
  canRedo: boolean;
  zoomLevel: number;
  maxSafeZoom: number;
  fps: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  onUndo: () => void;
  onRedo: () => void;
  onSplitClip: (sourceTimeSec: number) => void;
  onToggleDeleteClip: (clipId?: string) => void;
  onToggleKeepSilence?: (silenceId?: string) => void;
}

export const TimelineTransportControls: React.FC<TimelineTransportControlsProps> = React.memo(({
  hasMedia,
  projectDuration,
  timelineCurrentTime,
  effectiveClips,
  silenceSlices,
  selectedClipId,
  selectedSilenceId,
  canUndo,
  canRedo,
  zoomLevel,
  maxSafeZoom,
  fps,
  setZoomLevel,
  onUndo,
  onRedo,
  onSplitClip,
  onToggleDeleteClip,
  onToggleKeepSilence,
}) => {
  const currentSourceTime = getSourceTime(timelineCurrentTime, effectiveClips);
  const activeSilenceSlice = selectedSilenceId
    ? silenceSlices.find((s) => s.id === selectedSilenceId && s.isSilent)
    : (!selectedClipId
        ? silenceSlices.find((s) => s.isSilent && currentSourceTime >= s.start && currentSourceTime <= s.end)
        : null);

  const isKept = activeSilenceSlice?.isKept === true;
  const hasSilenceTarget = !!activeSilenceSlice;

  return (
    <div className="h-7 px-2 flex items-center justify-between vulcanite-panel rounded-[4px] border border-[var(--border-panel-groove)] shrink-0">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="bg-[var(--btn-tactile-bg)] border border-slate-700/60 text-slate-200 hover:bg-[var(--btn-tactile-hover)] hover:text-white px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-[3px] flex items-center gap-1 cursor-pointer transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo Split/Delete (Cmd+Z)"
        >
          <RotateCcw className="w-2.5 h-2.5" strokeWidth={2.4} />
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="bg-[var(--btn-tactile-bg)] border border-slate-700/60 text-slate-200 hover:bg-[var(--btn-tactile-hover)] hover:text-white px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-[3px] flex items-center gap-1 cursor-pointer transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Cmd+Shift+Z)"
        >
          <RotateCw className="w-2.5 h-2.5" strokeWidth={2.4} />
          Redo
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--btn-tactile-divider)] mx-0.5" />

        <button
          type="button"
          onClick={() => {
            if (hasMedia && projectDuration > 0) {
              const sourceTime = getSourceTime(timelineCurrentTime, effectiveClips);
              onSplitClip(sourceTime);
            }
          }}
          disabled={!hasMedia}
          className="bg-[var(--btn-tactile-bg)] border border-slate-700/60 text-slate-200 hover:bg-[var(--btn-tactile-hover)] hover:text-white px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-[3px] flex items-center gap-1 cursor-pointer transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px"
          title="Split Active Clip at Playhead (B)"
        >
          <Scissors className="w-2.5 h-2.5 text-amber-400" strokeWidth={2.4} />
          Split clip (B)
        </button>

        <button
          type="button"
          onClick={() => {
            if (selectedClipId) {
              onToggleDeleteClip(selectedClipId);
            }
          }}
          disabled={!selectedClipId}
          className="bg-[var(--btn-tactile-bg)] border border-slate-700/60 text-slate-200 hover:bg-[var(--btn-tactile-hover)] hover:text-red-400 px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-[3px] flex items-center gap-1 cursor-pointer transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px"
          title="Delete Selected Clip from Output (Del / Backspace)"
        >
          <Trash2 className="w-2.5 h-2.5 text-red-500" strokeWidth={2.4} />
          Delete (Del)
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeSilenceSlice && onToggleKeepSilence) {
              onToggleKeepSilence(activeSilenceSlice.id);
            }
          }}
          disabled={!hasSilenceTarget}
          className={`px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-[3px] flex items-center gap-1 transition-all shadow-sm active:translate-y-px ${
            isKept
              ? 'bg-emerald-950/70 border border-emerald-500/70 text-emerald-300 hover:bg-emerald-900/70 cursor-pointer'
              : hasSilenceTarget
              ? 'bg-amber-950/70 border border-amber-500/70 text-amber-300 hover:bg-amber-900/70 cursor-pointer'
              : 'bg-[var(--btn-tactile-bg)] border border-slate-700/60 text-slate-200 hover:bg-[var(--btn-tactile-hover)] hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
          }`}
          title={isKept ? 'Mark Silence to be Cut (R)' : 'Keep / Restore Silence in Output (R)'}
        >
          {isKept ? (
            <>
              <Scissors className="w-2.5 h-2.5 text-emerald-400" strokeWidth={2.4} />
              Cut Silence (R)
            </>
          ) : (
            <>
              <ShieldCheck className={`w-2.5 h-2.5 ${hasSilenceTarget ? 'text-amber-400' : 'text-slate-400'}`} strokeWidth={2.4} />
              Restore (R)
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(1, z / 1.5))}
            disabled={!hasMedia}
            className="bg-[var(--btn-tactile-bg)] border border-slate-700/60 text-slate-200 hover:bg-[var(--btn-tactile-hover)] hover:text-white p-1 rounded-[3px] cursor-pointer transition-all shadow-sm disabled:opacity-30"
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" strokeWidth={2.4} />
          </button>
          <span className="text-[9.5px] font-mono font-bold text-amber-400 w-8 text-center">
            {zoomLevel.toFixed(1)}x
          </span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(maxSafeZoom, z * 1.5))}
            disabled={!hasMedia}
            className="bg-[var(--btn-tactile-bg)] border border-slate-700/60 text-slate-200 hover:bg-[var(--btn-tactile-hover)] hover:text-white p-1 rounded-[3px] cursor-pointer transition-all shadow-sm disabled:opacity-30"
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3" strokeWidth={2.4} />
          </button>
        </div>

        <div className="w-[1px] h-3.5 bg-[var(--btn-tactile-divider)]" />

        <span className="text-[9.5px] font-mono text-amber-300 font-bold bg-[var(--timeline-readout-bg)] px-2 py-0.5 rounded-[3px] border border-[var(--btn-tactile-divider)] shadow-inner">
          {fps} FPS
        </span>
      </div>
    </div>
  );
});

TimelineTransportControls.displayName = 'TimelineTransportControls';

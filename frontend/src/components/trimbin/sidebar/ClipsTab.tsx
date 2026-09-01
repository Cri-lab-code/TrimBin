import React, { useState, useMemo } from 'react';
import { UserClip, SilenceSlice } from '../../../types/timeline';
import { formatTimecode } from '../../../utils/timecode';

interface ClipCardProps {
  clip: UserClip;
  index: number;
  isSelected: boolean;
  isCurrent: boolean;
  isExpanded: boolean;
  isOnlyActiveClip: boolean;
  onSeekToTime: (t: number) => void;
  onSelectClip: (id: string) => void;
  onToggleExpand: (id: string, e?: React.MouseEvent) => void;
  onToggleDeleteClip: (id: string) => void;
  silenceSlices: SilenceSlice[];
}

const ClipCard: React.FC<ClipCardProps> = React.memo(
  ({
    clip,
    index,
    isSelected,
    isCurrent,
    isExpanded,
    isOnlyActiveClip,
    onSeekToTime,
    onSelectClip,
    onToggleExpand,
    onToggleDeleteClip,
    silenceSlices,
  }) => {
    const clipDuration = (clip.sourceEnd - clip.sourceStart).toFixed(2);
    const [visibleSliceLimit, setVisibleSliceLimit] = useState<number>(30);

    const clipSlices = useMemo(() => {
      if (!isExpanded || !silenceSlices || silenceSlices.length === 0) return [];
      return silenceSlices.filter(
        (slice) =>
          slice.start >= clip.sourceStart - 0.05 && slice.end <= clip.sourceEnd + 0.05
      );
    }, [isExpanded, silenceSlices, clip.sourceStart, clip.sourceEnd]);

    const renderedSlices = useMemo(() => {
      return clipSlices.slice(0, visibleSliceLimit);
    }, [clipSlices, visibleSliceLimit]);

    return (
      <div className="border-b border-[var(--border-subtle)]">
        <div
          onClick={() => {
            onSeekToTime(clip.sourceStart);
            onSelectClip(clip.id);
            onToggleExpand(clip.id);
          }}
          className={`h-7 px-2 flex items-center justify-between gap-1.5 select-none font-mono text-[9.5px] cursor-pointer transition-colors ${
            isSelected
              ? 'bg-[var(--accent-amber-subtle)] text-[var(--text-accent-bright)]'
              : isCurrent
              ? 'bg-[var(--accent-amber-subtle)] text-[var(--text-accent)]'
              : clip.isDeleted
              ? 'bg-red-950/40 opacity-60'
              : 'bg-[var(--bg-inset-sub)] hover:bg-[var(--bg-panel-hover)]'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[8px] text-slate-500 font-bold w-4 shrink-0">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <span className="font-bold text-slate-200 truncate max-w-[85px]">
              {clip.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] text-[var(--text-engraved)]">
              {formatTimecode(clip.sourceStart)} - {formatTimecode(clip.sourceEnd)}
            </span>
            <span className="text-[9px] font-bold text-amber-400">
              {clipDuration}s
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isOnlyActiveClip) {
                  onToggleDeleteClip(clip.id);
                }
              }}
              className={`px-1 py-0.5 rounded-[2px] text-[8px] font-bold uppercase transition-colors ${
                isOnlyActiveClip
                  ? 'bg-slate-800 text-slate-500 opacity-40 cursor-not-allowed'
                  : clip.isDeleted
                  ? 'bg-red-950 text-red-300 border border-red-800 hover:bg-red-900 cursor-pointer'
                  : 'bg-[var(--bg-panel-sub)] text-slate-400 hover:text-amber-300 border border-[var(--border-default)] cursor-pointer'
              }`}
              title={clip.isDeleted ? 'Restore clip' : 'Delete clip with ripple'}
            >
              {clip.isDeleted ? 'DEL' : 'CUT'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="panel-inset border-t border-[var(--border-subtle)] p-2 space-y-1 shadow-inner max-h-56 overflow-y-auto">
            {clipSlices.length > 0 ? (
              <>
                {renderedSlices.map((slice) => {
                  const sliceDur = (slice.end - slice.start).toFixed(2);
                  return (
                    <div
                      key={slice.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeekToTime(slice.start);
                      }}
                      className="flex items-center justify-between px-2 py-1 rounded cursor-pointer text-[10px] font-mono transition-colors border bg-[var(--bg-panel-sub)] hover:bg-[var(--bg-panel-hover)] border-white/5 text-slate-300"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">
                          {formatTimecode(slice.start)} - {formatTimecode(slice.end)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-slate-400 font-medium">{sliceDur}s</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            slice.isSilent
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                              : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                          }`}
                        >
                          {slice.isSilent ? 'Silence' : 'Voice'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {clipSlices.length > visibleSliceLimit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisibleSliceLimit((prev) => prev + 50);
                    }}
                    className="w-full py-1 text-[9px] font-mono font-bold text-amber-400 bg-[var(--bg-panel-sub)] hover:bg-[var(--bg-panel-hover)] rounded border border-[var(--border-default)] transition-colors text-center cursor-pointer"
                  >
                    + Show {Math.min(50, clipSlices.length - visibleSliceLimit)} more slices
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-2 text-[10px] font-mono text-slate-500 italic">
                No sub-slices available for this clip range.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

interface ClipsTabProps {
  clips: UserClip[];
  silenceSlices?: SilenceSlice[];
  selectedClipId: string | null;
  currentTime: number;
  onSelectClip: (clipId: string | null) => void;
  onToggleDeleteClip: (clipId?: string) => void;
  onSeekToTime: (timeSec: number) => void;
}

export const ClipsTab: React.FC<ClipsTabProps> = ({
  clips,
  silenceSlices = [],
  selectedClipId,
  currentTime,
  onSelectClip,
  onToggleDeleteClip,
  onSeekToTime,
}) => {
  const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(new Set());

  const toggleClipExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeClipsCount = clips.filter((c) => !c.isDeleted).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-mono font-bold text-[var(--text-accent-bright)] uppercase tracking-widest">
          MAGNETIC CLIPS ({activeClipsCount}/{clips.length})
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-[var(--border-panel-groove)] rounded-[4px] bg-[var(--bg-inset)] shadow-inner divide-y divide-[var(--border-subtle)]">
        {clips.length > 0 ? (
          clips.map((clip, idx) => {
            const isCurrent = currentTime >= clip.sourceStart && currentTime < clip.sourceEnd;
            const isSelected = selectedClipId === clip.id;
            const isExpanded = expandedClipIds.has(clip.id);

            return (
              <ClipCard
                key={clip.id}
                clip={clip}
                index={idx}
                isSelected={isSelected}
                isCurrent={isCurrent}
                isExpanded={isExpanded}
                isOnlyActiveClip={activeClipsCount <= 1 && !clip.isDeleted}
                onSeekToTime={onSeekToTime}
                onSelectClip={onSelectClip}
                onToggleExpand={toggleClipExpand}
                onToggleDeleteClip={onToggleDeleteClip}
                silenceSlices={silenceSlices}
              />
            );
          })
        ) : (
          <div className="p-4 text-center text-xs font-mono text-slate-500">
            No clips generated. Import a media file to begin.
          </div>
        )}
      </div>
    </div>
  );
};

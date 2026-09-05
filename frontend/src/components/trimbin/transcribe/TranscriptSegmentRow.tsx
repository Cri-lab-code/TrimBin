import React from 'react';
import { Clock } from 'lucide-react';
import { TranscriptSegment } from '@/global';
import { formatTimestamp } from '@/utils/subtitleParsers';

export interface TranscriptSegmentRowProps {
  seg: TranscriptSegment;
  isCurrent: boolean;
  onSeekToTime: (timeSec: number) => void;
  activeRef?: React.Ref<HTMLDivElement>;
}

export const TranscriptSegmentRow: React.FC<TranscriptSegmentRowProps> = React.memo(
  ({ seg, isCurrent, onSeekToTime, activeRef }) => {
    return (
      <div
        ref={activeRef}
        onClick={() => onSeekToTime(seg.start || 0)}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '40px' }}
        className={`p-2 rounded-[4px] text-xs cursor-pointer transition-all border ${
          isCurrent
            ? 'bg-[var(--segment-active-bg)] border-[var(--segment-active-border)] text-[var(--text-accent-bright)] shadow-sm'
            : 'bg-[var(--segment-idle-bg)] hover:bg-[var(--segment-idle-hover)] border-[var(--border-default)] text-[var(--text-primary)] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] text-amber-400 font-black flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" strokeWidth={2.4} />
            [{formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}]
          </span>
          {isCurrent && (
            <span className="text-[8px] bg-gradient-to-r from-amber-400 to-amber-500 text-black px-1.5 rounded-[2px] font-mono font-black uppercase shadow-sm">
              ACTIVE
            </span>
          )}
        </div>
        <p className="leading-snug text-slate-100 font-sans">{seg.text || ''}</p>
      </div>
    );
  }
);

TranscriptSegmentRow.displayName = 'TranscriptSegmentRow';

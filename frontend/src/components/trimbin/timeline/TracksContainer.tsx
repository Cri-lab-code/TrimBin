import React from 'react';
import { Eye, Volume2 } from 'lucide-react';

export interface TracksContainerProps {
  scrollRef: React.RefObject<HTMLDivElement>;
  totalTimelineWidth: number;
  hasMedia: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  rulerSlot: React.ReactNode;
  videoTrackSlot: React.ReactNode;
  waveformTrackSlot: React.ReactNode;
  playheadSlot: React.ReactNode;
}

export const TracksContainer: React.FC<TracksContainerProps> = React.memo(({
  scrollRef,
  totalTimelineWidth,
  hasMedia,
  onMouseDown,
  rulerSlot,
  videoTrackSlot,
  waveformTrackSlot,
  playheadSlot,
}) => {
  return (
    <div className="flex-1 flex min-h-0 relative overflow-hidden rounded-[4px] border border-[var(--border-panel-groove)] box-border contain-paint">
      {/* Track Headers Column */}
      <div className="w-24 bg-[var(--bg-chassis)] border-r border-black/90 flex flex-col shrink-0 z-20 shadow-track-header overflow-hidden h-[176px] box-border">
        <div className="h-[26px] flex items-center px-3 border-b border-black/80 bg-[var(--timeline-track-header)] shrink-0 box-border">
          <span className="text-[10px] font-bold tracking-wider text-[var(--timeline-track-label)] font-mono">
            TRACKS
          </span>
        </div>

        <div className="h-[42px] flex items-center justify-between px-2 border-b border-black/80 bg-[var(--timeline-track-lane)] shrink-0 box-border">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded-[3px] text-white bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 border border-amber-300/60 shadow-badge-amber drop-shadow-subtle">
              V1
            </span>
            <span className="text-[9px] font-mono font-black text-amber-200/90 truncate">
              CLIPS
            </span>
          </div>
          <Eye className="w-3.5 h-3.5 text-amber-500 hover:text-amber-400 cursor-pointer shrink-0" strokeWidth={2.4} />
        </div>

        <div className="h-[90px] flex items-center justify-between px-2 border-b border-black/80 bg-[var(--timeline-track-lane)] shrink-0 box-border">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded-[3px] text-white bg-gradient-to-b from-sky-400 via-cyan-500 to-blue-600 border border-sky-300/60 shadow-badge-cyan drop-shadow-subtle">
              A1
            </span>
            <span className="text-[9px] font-mono font-black text-sky-200/90 truncate">
              AUDIO
            </span>
          </div>
          <Volume2 className="w-3.5 h-3.5 text-sky-400 hover:text-sky-300 cursor-pointer shrink-0" strokeWidth={2.4} />
        </div>

        <div className="h-[18px] border-t border-black/80 bg-[var(--timeline-readout-bg)] shrink-0 box-border" />
      </div>

      {/* Main Scrollable Canvas Tracks Area */}
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        className={`flex-1 flex flex-col overflow-x-auto overflow-y-hidden timeline-scroll-container relative bg-[var(--timeline-readout-bg)] h-[176px] box-border contain-paint ${
          hasMedia ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        <div
          className="relative flex flex-col shrink-0 h-[176px] box-border"
          style={{ width: `${totalTimelineWidth}px`, minWidth: '100%' }}
        >
          {/* Playhead Overlay */}
          {playheadSlot}

          {/* Row 0: Timecode Ruler */}
          {rulerSlot}

          {/* Row 1 & 2: Center Tracks Container */}
          <div
            className="relative flex flex-col shrink-0 overflow-hidden select-none bg-[var(--bg-inset)] border-b border-black/90 shadow-track-groove box-border contain-paint"
            style={{ width: `${totalTimelineWidth}px`, height: '132px' }}
          >
            {/* Empty Film Ribbon Fallback */}
            {!hasMedia && (
              <div className="absolute inset-0 flex pointer-events-none z-0">
                {Array.from({ length: Math.ceil(totalTimelineWidth / 240) }).map((_, frameIndex) => {
                  const frameNum = frameIndex + 1;
                  const topLabels = ['SAFETY FILM', '35 MM', '500T • COLOR', 'EMULSION 8542'];
                  const topText = topLabels[frameIndex % topLabels.length];

                  return (
                    <div
                      key={`film-frame-${frameIndex}`}
                      className="relative shrink-0 flex flex-col justify-between overflow-hidden pb-1"
                      style={{
                        width: '240px',
                        height: '132px',
                        background:
                          'radial-gradient(ellipse at center, #c25e2e 0%, #a44c24 45%, #8f3a14 75%, #6e2b0e 100%)',
                        boxShadow: 'inset 0 6px 14px rgba(0,0,0,0.65), inset 0 -6px 14px rgba(0,0,0,0.65)',
                      }}
                    >
                      <div className="h-5 w-full flex items-center justify-between px-3 relative pt-1">
                        <div className="flex items-center gap-9">
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                        </div>

                        <span className="font-mono text-[7.5px] font-bold text-[var(--text-accent-bright)]/85 tracking-widest uppercase select-none whitespace-nowrap drop-shadow-subtle">
                          {topText}
                        </span>

                        <div className="flex items-center gap-9">
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                        </div>
                      </div>

                      <div className="h-5 w-full flex items-center justify-between px-3 relative pb-1 mb-0.5">
                        <div className="flex items-center gap-9">
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                        </div>

                        <div className="flex items-center justify-center gap-2 font-mono text-[8px] font-bold text-[var(--text-accent-bright)]/90 drop-shadow-subtle">
                          <span className="text-yellow-300 font-black">▶ {frameNum}</span>
                          <span className="text-[var(--text-accent-bright)]/75">{frameNum}A</span>
                          <div className="flex items-center gap-0.5 opacity-75">
                            <span className="w-[1.5px] h-2 bg-[var(--text-accent-bright)]" />
                            <span className="w-[1px] h-2 bg-[var(--text-accent-bright)]" />
                            <span className="w-[2px] h-2 bg-[var(--text-accent-bright)]" />
                            <span className="w-[1px] h-2 bg-[var(--text-accent-bright)]" />
                            <span className="w-[1.5px] h-2 bg-[var(--text-accent-bright)]" />
                            <span className="w-[2.5px] h-2 bg-[var(--text-accent-bright)]" />
                            <span className="w-[1px] h-2 bg-[var(--text-accent-bright)]" />
                          </div>
                        </div>

                        <div className="flex items-center gap-9">
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                          <div className="w-[14px] h-[10px] rounded-[2px] bg-[var(--sprocket-hole)] shadow-sprocket-hole" />
                        </div>
                      </div>

                      <div className="absolute right-0 top-0 bottom-0 w-[6px] bg-[var(--sprocket-border)] shadow-sprocket-edge border-l border-r border-[var(--bg-inset)]" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Layer 1: Timeline Tracks (Row 1: V1 42px, Row 2: A1 90px) */}
            <div className="relative z-10 flex flex-col w-full h-full">
              {videoTrackSlot}
              {waveformTrackSlot}
            </div>
          </div>

          {/* Row 3: Bottom Rail (18px) */}
          <div
            className="h-[18px] bg-[var(--bg-inset)] border-t border-black/80 relative shrink-0 overflow-hidden shadow-inset-well select-none box-border"
            style={{ width: `${totalTimelineWidth}px` }}
          />
        </div>
      </div>
    </div>
  );
});

TracksContainer.displayName = 'TracksContainer';

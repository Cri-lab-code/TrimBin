import React from 'react';

export interface PlayheadOverlayProps {
  playheadRef: React.RefObject<HTMLDivElement>;
  hasMedia: boolean;
}

export const PlayheadOverlay: React.FC<PlayheadOverlayProps> = React.memo(({
  playheadRef,
  hasMedia,
}) => {
  if (!hasMedia) return null;

  return (
    <div
      ref={playheadRef}
      className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center -translate-x-1/2"
      style={{
        left: 0,
        transform: 'translate3d(0, 0, 0) translateX(-50%)',
        willChange: 'transform',
      }}
    >
      <div className="w-4 h-4 bg-gradient-to-b from-red-500 via-red-600 to-red-800 border border-red-300 shadow-playhead-cap flex items-center justify-center rounded-[2px] shrink-0">
        <span className="text-[8px] font-mono font-black text-white drop-shadow-subtle select-none">
          M
        </span>
      </div>
      <div className="w-[1.5px] flex-1 bg-gradient-to-b from-red-400 via-red-500 to-red-600 shadow-laser-glow" />
    </div>
  );
});

PlayheadOverlay.displayName = 'PlayheadOverlay';

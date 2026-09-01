import React from 'react';

interface AmberLedTimecodeProps {
  seconds: number;
  fps?: number;
  label?: string;
  className?: string;
}

export const AmberLedTimecode: React.FC<AmberLedTimecodeProps> = React.memo(({
  seconds,
  fps = 30,
  label = 'TIMECODE',
  className = '',
}) => {
  const s = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const frames = Math.floor((s % 1) * fps);

  const formatted = `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames
    .toString()
    .padStart(2, '0')}`;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {label && (
        <span className="text-[9px] font-sans font-semibold tracking-wider text-[var(--text-silkscreen)] uppercase select-none drop-shadow">
          {label}
        </span>
      )}
      <div className="skeuo-7seg-amber px-3 py-1 text-sm font-mono font-bold select-none tracking-widest flex items-center justify-center min-w-[120px] contain-paint">
        <span>{formatted}</span>
      </div>
    </div>
  );
});

AmberLedTimecode.displayName = 'AmberLedTimecode';

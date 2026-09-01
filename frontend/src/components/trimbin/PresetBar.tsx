import React from 'react';

interface PresetBarProps {
  currentThreshold: number;
  onSelectThreshold: (db: number) => void;
  className?: string;
}

const PRESET_VALUES = [-40, -30, -25, -20, -15];

export const PresetBar: React.FC<PresetBarProps> = ({
  currentThreshold,
  onSelectThreshold,
  className = '',
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <span className="text-[9.5px] font-sans font-semibold text-[var(--text-secondary)] uppercase block">
        Preset Threshold
      </span>
      <div className="grid grid-cols-5 gap-[2px] panel-inset p-[2px]">
        {PRESET_VALUES.map((db) => {
          const isSelected = Math.round(currentThreshold) === db;
          return (
            <button
              key={db}
              type="button"
              onClick={() => onSelectThreshold(db)}
              className={`h-5 text-[10px] font-mono font-bold rounded-[2px] transition-all cursor-pointer flex items-center justify-center ${
                isSelected
                  ? 'chip-badge-accent font-black shadow-inner'
                  : 'bg-[var(--bg-panel-sub)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-panel-hover)]'
              }`}
            >
              {db}dB
            </button>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';

interface KnurledKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  className?: string;
}

export const KnurledKnob: React.FC<KnurledKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>('');
  
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const knobContainerRef = useRef<HTMLDivElement>(null);

  const clampedVal = Math.max(min, Math.min(max, value));
  const ratio = max > min ? (clampedVal - min) / (max - min) : 0;
  const rotationDeg = -135 + ratio * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = clampedVal;
  };

  // Drag tracking for rotary encoder adjustment
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startYRef.current - e.clientY;
      const range = max - min;
      const change = (deltaY / 150) * range;
      let nextVal = startValRef.current + change;

      if (step > 0) {
        nextVal = Math.round(nextVal / step) * step;
      }
      nextVal = Math.max(min, Math.min(max, nextVal));
      const decimals = step.toString().includes('.') ? (step.toString().split('.')[1]?.length || 2) : 2;
      onChange(parseFloat(nextVal.toFixed(decimals)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, step, onChange]);

  // Rotary scroll wheel incrementation
  useEffect(() => {
    const el = knobContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (isEditing) return;
      e.preventDefault();
      e.stopPropagation();

      const direction = e.deltaY < 0 ? 1 : -1;
      // Shift for high-precision fine adjustment
      const effectiveStep = e.shiftKey ? Math.max(step * 0.2, 0.01) : step;
      let nextVal = clampedVal + direction * effectiveStep;

      // Handle step rounding and precision
      const decimals = step.toString().includes('.')
        ? (step.toString().split('.')[1]?.length || 2)
        : (effectiveStep < 1 ? 2 : 0);

      nextVal = parseFloat(nextVal.toFixed(decimals));
      nextVal = Math.max(min, Math.min(max, nextVal));

      onChange(nextVal);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [clampedVal, min, max, step, onChange, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    setEditValue(String(clampedVal));
    setIsEditing(true);
  };

  const commitEdit = () => {
    if (!isEditing) return;

    const trimmed = editValue.trim().toLowerCase().replace(/[^\d.-]/g, '');
    
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || isNaN(Number(trimmed))) {
      setIsEditing(false);
      return;
    }

    let parsed = parseFloat(trimmed);
    if (isNaN(parsed)) {
      setIsEditing(false);
      return;
    }

    const isDb = unit.toLowerCase().includes('db') || label.toUpperCase().includes('THRESHOLD') || max <= 0;
    if (isDb && parsed > 0 && max <= 0) {
      parsed = -parsed;
    }

    parsed = Math.max(min, Math.min(max, parsed));

    if (step < 1) {
      const decimals = step.toString().split('.')[1]?.length || 2;
      parsed = parseFloat(parsed.toFixed(decimals));
    } else {
      parsed = Math.round(parsed);
    }

    onChange(parsed);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={knobContainerRef}
      className={`flex flex-col items-center gap-1 select-none ${className}`}
      title={`${label}: ${clampedVal}${unit} (Drag up/down or Scroll wheel, Shift for fine-tuning)`}
    >
      {/* Parameter Label */}
      <span className="text-[8.5px] font-sans font-semibold text-[var(--text-silkscreen)] uppercase tracking-wider drop-shadow text-center">
        {label}
      </span>

      {/* Rotary Knurled Knob Graphic */}
      <div
        onMouseDown={handleMouseDown}
        className="relative w-12 h-12 flex items-center justify-center cursor-ns-resize group"
      >
        {/* Outer Bezel Dial Ring with Tick Marks */}
        <div className="absolute inset-0 rounded-full bg-[var(--bg-panel)] border border-[var(--border-default)] shadow-knurled-base group-hover:border-amber-500/40 transition-colors" />

        {/* Knurled Aluminum Knob Body */}
        <div
          className="relative w-9 h-9 rounded-full bg-gradient-to-b from-[var(--knob-cap-top)] via-[var(--knob-cap-mid)] to-[var(--knob-cap-bot)] border border-[var(--knob-rim)] shadow-knurled-cap flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
          }}
        >
          {/* Radial Knurling Ribs */}
          <div className="absolute inset-0.5 rounded-full border border-black/60 shadow-inner bg-radial from-transparent to-black/40" />

          {/* White / Gold Indicator Pointer Line */}
          <div className="absolute top-1 w-[2px] h-2.5 bg-[var(--text-accent-bright)] rounded-full shadow-amber-bloom" />

          {/* Center Cap with subtle machining concentric ring */}
          <div className="w-4 h-4 rounded-full bg-gradient-to-b from-[var(--bg-panel-sub)] to-[var(--bg-inset)] border border-[var(--border-default)] shadow-inner" />
        </div>
      </div>

      {/* Value Display Badge (Inline Editable Hardware Badge) */}
      <div className="w-[74px] h-[24px] flex items-center justify-center">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            onFocus={(e) => e.target.select()}
            className="w-full h-full bg-[var(--bg-inset)] border border-amber-500/80 rounded font-mono text-[11px] font-bold text-amber-300 text-center outline-none shadow-tactile-press"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="w-full h-full px-1.5 py-0.5 rounded-[3px] bg-[var(--bg-inset-sub)] border border-[var(--border-default)] hover:border-amber-500/50 hover:bg-[var(--bg-panel)] transition-all cursor-text shadow-inner group flex items-center justify-center"
            title="Click to edit value"
          >
            <span className="text-[10px] font-mono font-bold text-[var(--text-accent-bright)] group-hover:text-amber-300 tracking-wider truncate">
              {clampedVal}
              {unit}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};


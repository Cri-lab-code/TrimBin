import React from 'react';
import { formatTimecode } from '../../../utils/timecode';

interface SmpteTimecodeProps {
  currentTime: number;
  fps: number;
  active: boolean;
}

export const SmpteTimecode: React.FC<SmpteTimecodeProps> = ({ currentTime, fps, active }) => {
  return (
    <div className="panel-inset px-2.5 py-1 text-xs font-mono font-black tracking-widest text-amber-300 glow-amber-text select-none">
      {active ? formatTimecode(currentTime, fps) : '00:00:00:00'}
    </div>
  );
};

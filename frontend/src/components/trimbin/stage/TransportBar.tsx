import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { SmpteTimecode } from './SmpteTimecode';

interface TransportBarProps {
  canPlay: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  smartSkipOn: boolean;
  isFullscreen: boolean;
  currentTime: number;
  fps: number;
  onTogglePlay: () => void;
  onJumpPrevCut: () => void;
  onJumpNextCut: () => void;
  onToggleSmartSkip: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  canPlay,
  isPlaying,
  isMuted,
  smartSkipOn,
  isFullscreen,
  currentTime,
  fps,
  onTogglePlay,
  onJumpPrevCut,
  onJumpNextCut,
  onToggleSmartSkip,
  onToggleMute,
  onToggleFullscreen,
}) => {
  return (
    <div className="relative h-11 px-3 flex items-center justify-between shrink-0 select-none mt-1.5 panel-surface">
      {/* Auto-Skip Silence Hardware Toggle */}
      <div className="flex items-center gap-2 z-10">
        <span className="text-[9px] font-mono font-bold tracking-wider text-[var(--text-engraved)] uppercase">
          AUTO-SKIP SILENCE:
        </span>
        <div
          onClick={canPlay ? onToggleSmartSkip : undefined}
          className={`w-9 h-4.5 rounded-full p-0.5 transition-colors ${
            smartSkipOn && canPlay
              ? 'bg-amber-600 border border-amber-400 shadow-glow-amber'
              : 'bg-[var(--well-inset)] border border-[var(--border-default)]'
          } ${!canPlay ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}`}
          title="Toggle Silence Auto-Skipping during Playback"
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-gradient-to-b from-white to-slate-300 shadow-md transition-transform ${
              smartSkipOn && canPlay ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>
        <span
          className={`text-[9px] font-mono font-black w-8 ${
            smartSkipOn && canPlay ? 'text-amber-400 glow-amber-text' : 'text-slate-600'
          }`}
        >
          {smartSkipOn && canPlay ? 'ACTIVE' : 'OFF'}
        </span>
      </div>

      {/* Dead-Center Transport Keycaps */}
      <div className="absolute inset-0 m-auto w-fit h-fit flex items-center justify-center gap-1.5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={onToggleFullscreen}
          disabled={!canPlay}
          className="btn-tactile w-[32px] h-[30px] rounded-[3px] flex items-center justify-center disabled:opacity-30 cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen (F)'}
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" strokeWidth={2.4} /> : <Maximize className="w-3.5 h-3.5" strokeWidth={2.4} />}
        </button>

        <div className="w-[1px] h-4 bg-[var(--border-default)] mx-1" />

        <button
          type="button"
          onClick={onJumpPrevCut}
          disabled={!canPlay}
          className="btn-tactile w-[36px] h-[30px] rounded-[3px] flex items-center justify-center disabled:opacity-30 cursor-pointer"
          title="Jump to Previous Cut (Shift + Left)"
        >
          <SkipBack className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!canPlay}
          className={`btn-tactile w-[46px] h-[30px] rounded-[4px] flex items-center justify-center disabled:opacity-30 cursor-pointer ${
            isPlaying
              ? 'active text-amber-300'
              : 'border-amber-500/70 text-amber-300 bg-[var(--accent-amber-subtle)] shadow-glow-amber-subtle'
          }`}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current text-amber-300" strokeWidth={2.4} />
          ) : (
            <Play className="w-4 h-4 fill-amber-300 text-amber-300 translate-x-[1px]" strokeWidth={2.4} />
          )}
        </button>

        <button
          type="button"
          onClick={onJumpNextCut}
          disabled={!canPlay}
          className="btn-tactile w-[36px] h-[30px] rounded-[3px] flex items-center justify-center disabled:opacity-30 cursor-pointer"
          title="Jump to Next Cut (Shift + Right)"
        >
          <SkipForward className="w-3.5 h-3.5" strokeWidth={2.4} />
        </button>

        <div className="w-[1px] h-4 bg-[var(--border-default)] mx-1" />

        <button
          type="button"
          onClick={onToggleMute}
          disabled={!canPlay}
          className={`btn-tactile w-[32px] h-[30px] rounded-[3px] flex items-center justify-center disabled:opacity-30 cursor-pointer ${
            isMuted ? 'text-red-400 border-red-500' : ''
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" strokeWidth={2.4} /> : <Volume2 className="w-3.5 h-3.5" strokeWidth={2.4} />}
        </button>
      </div>

      <div className="flex items-center justify-end gap-1.5 z-10">
        <SmpteTimecode currentTime={currentTime} fps={fps} active={canPlay} />
      </div>
    </div>
  );
};

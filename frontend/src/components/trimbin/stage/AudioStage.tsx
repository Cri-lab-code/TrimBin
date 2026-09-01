import React from 'react';
import { Volume2 } from 'lucide-react';
import { formatTimecode } from '../../../utils/timecode';
import { MediaMetadata } from '@/global';

interface AudioStageProps {
  isPlaying: boolean;
  selectedFile: { name: string; path: string } | null;
  mediaMetadata: MediaMetadata | null;
  currentTime: number;
  duration: number;
  fps: number;
  onTogglePlay?: () => void;
  canPlay: boolean;
}

export const AudioStage: React.FC<AudioStageProps> = ({
  isPlaying,
  selectedFile,
  mediaMetadata,
  currentTime,
  duration,
  fps,
  onTogglePlay,
  canPlay,
}) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-6 sm:p-10 select-none overflow-hidden bg-[var(--well-inset)]">
      {/* Studio Room Lighting */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          background: isPlaying
            ? 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.18) 0%, rgba(180, 83, 9, 0.08) 45%, rgba(6, 7, 10, 0.98) 75%)'
            : 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.05) 0%, rgba(6, 7, 10, 0.99) 75%)',
        }}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[600px] h-[30px] rounded-full bg-black/80 blur-xl pointer-events-none" />

      <div
        onClick={canPlay ? onTogglePlay : undefined}
        className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 lg:gap-16 max-w-5xl cursor-pointer group"
      >
        <div
          className={`relative flex items-center shrink-0 transition-all duration-500 ease-out ${
            isPlaying
              ? 'scale-100 brightness-100 opacity-100 drop-shadow-subtle'
              : 'scale-[0.92] brightness-[0.55] contrast-[0.95] opacity-80 drop-shadow-subtle'
          }`}
        >
          {/* Vinyl Record */}
          <div className="absolute left-[40%] top-1/2 -translate-y-1/2 z-10 shrink-0 w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] md:w-[350px] md:h-[350px] lg:w-[380px] lg:h-[380px] rounded-full shadow-disc-vinyl flex items-center justify-center pointer-events-none">
            <div
              className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, #1c1e24 0%, #0e0f13 25%, #050608 60%, #16181e 85%, #08090c 100%)',
                border: '2.5px solid #282c37',
                animation: 'spin 3.5s linear infinite',
                animationPlayState: isPlaying ? 'running' : 'paused',
              }}
            >
              <div className="absolute inset-3 rounded-full border border-white/5 opacity-40" />
              <div className="absolute inset-6 rounded-full border border-white/5 opacity-50" />
              <div className="absolute inset-10 rounded-full border border-white/5 opacity-30" />
              <div className="absolute inset-16 rounded-full border border-white/5 opacity-40" />
              <div className="absolute inset-24 rounded-full border border-white/5 opacity-50" />

              <div
                className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full shadow-panel-bevel flex flex-col items-center justify-center p-2 border-2 border-amber-500/85 text-center overflow-hidden z-10"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, #9a3412 0%, #451a03 70%, #1c0a02 100%)',
                }}
              >
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[var(--bg-inset)] border border-amber-400 shadow-inner mb-1" />
                <span className="text-[9px] sm:text-[10px] font-mono font-black text-amber-200 uppercase tracking-tighter truncate max-w-full">
                  {mediaMetadata?.format || 'AUDIO'}
                </span>
                <span className="text-[7.5px] sm:text-[8.5px] font-sans font-bold text-amber-300/90 uppercase tracking-wider truncate max-w-full">
                  MASTER REEL
                </span>
              </div>
            </div>
          </div>

          {/* Sleeve Jacket */}
          <div className="relative z-20 shrink-0 w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] md:w-[350px] md:h-[350px] lg:w-[380px] lg:h-[380px] rounded-[8px] shadow-audio-deck border-2 border-[var(--border-default)] bg-[var(--bg-panel)] overflow-hidden">
            {mediaMetadata?.hasCover && mediaMetadata.coverDataUrl ? (
              <img
                src={mediaMetadata.coverDataUrl}
                alt={mediaMetadata.title || 'Album Cover'}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-between p-6 bg-gradient-to-b from-amber-950/50 via-amber-950/80 to-black border border-amber-500/25 text-center select-none">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 tracking-widest uppercase">
                  <span>AUDIO MASTER REEL</span>
                </div>
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-950/70 border border-amber-500/40 flex items-center justify-center shadow-inner">
                  <Volume2 className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400" />
                </div>
                <div className="text-amber-200/90 font-mono text-sm font-bold truncate max-w-full">
                  {mediaMetadata?.title || selectedFile?.name}
                </div>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none shadow-panel-bevel" />
          </div>
        </div>

        {/* Track Typography & Metadata */}
        <div className="flex flex-col justify-center text-left space-y-3 max-w-xs sm:max-w-sm md:max-w-md shrink-0 pl-16 sm:pl-28 md:pl-36">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-[4px] bg-amber-950/30 border border-amber-500/50 text-amber-300 font-mono text-[10px] sm:text-xs font-bold tracking-widest uppercase shadow-inner">
              {mediaMetadata?.format || 'AUDIO'} HIGH-RES
            </span>
            <span
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] font-mono text-[9px] font-semibold uppercase tracking-wider ${
                isPlaying
                  ? 'text-amber-400 bg-amber-950/40 border border-amber-500/30'
                  : 'text-slate-500 bg-black/40 border border-slate-700/30'
              }`}
            >
              {isPlaying ? 'PLAYING' : 'PAUSED'}
            </span>
          </div>

          <h2 className="font-sans font-bold text-xl sm:text-2xl md:text-3xl text-[var(--text-primary)] leading-tight drop-shadow-md">
            {mediaMetadata?.title || selectedFile?.name}
          </h2>

          {mediaMetadata?.artist && (
            <p className="font-sans text-sm sm:text-base font-semibold text-amber-300/90 truncate drop-shadow">
              {mediaMetadata.artist}
            </p>
          )}

          {mediaMetadata?.album && (
            <p className="font-sans text-xs sm:text-sm text-amber-200/80 truncate">
              {mediaMetadata.album}
            </p>
          )}

          <div className="pt-2 flex items-center gap-3 text-xs font-mono text-amber-400/80">
            <span className="px-2 py-0.5 rounded bg-black/60 border border-amber-500/30">
              {formatTimecode(currentTime, fps)} / {formatTimecode(duration, fps)}
            </span>
            <span className="text-[10px] text-amber-500/60 uppercase tracking-widest font-bold">
              STEREO • MASTER
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

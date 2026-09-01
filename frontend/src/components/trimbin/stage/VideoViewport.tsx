import React from 'react';
import { Film } from 'lucide-react';
import { formatTimecode } from '../../../utils/timecode';
import { CurvedFilmBackground } from './CurvedFilmBackground';
import { AudioStage } from './AudioStage';
import { EmptyDropzone } from '../EmptyDropzone';
import { MediaMetadata } from '@/global';

interface VideoViewportProps {
  selectedFile: { name: string; path: string } | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  directVideoSrc: string;
  firstFramePoster: string | null;
  headThumb: string | null;
  tailThumb: string | null;
  isAudioMode: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  canPlay: boolean;
  duration: number;
  currentTime: number;
  fps: number;
  mediaMetadata: MediaMetadata | null;
  stageSize: { width: number; height: number };
  aspectRatio: number;
  isDragging: boolean;
  onTimeUpdate: () => void;
  onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onTogglePlay: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDropzoneClick: () => void;
}

export const VideoViewport: React.FC<VideoViewportProps> = ({
  selectedFile,
  videoRef,
  directVideoSrc,
  firstFramePoster,
  headThumb,
  tailThumb,
  isAudioMode,
  isPlaying,
  isMuted,
  canPlay,
  duration,
  currentTime,
  fps,
  mediaMetadata,
  stageSize,
  aspectRatio,
  isDragging,
  onTimeUpdate,
  onLoadedMetadata,
  onTogglePlay,
  onDragOver,
  onDragLeave,
  onDrop,
  onDropzoneClick,
}) => {
  const filmRibbonStyle = React.useMemo(() => {
    const pad = 12;
    const rebateH = 40;
    const borderChrome = 4;
    const interframeGap = 6;

    // Calculate height so it fits comfortably in the stage
    const ribbonH = Math.max(160, stageSize.height - pad);
    const innerH = ribbonH - rebateH * 2 - borderChrome;
    const frameW = Math.round(innerH * (aspectRatio || 16 / 9));

    // The ribbon contains exactly 3 frames: Head (Left), Live Video (Center), Tail (Right)
    const totalRibbonW = frameW * 3 + interframeGap * 2 + borderChrome;

    return {
      ribbonH: `${Math.round(ribbonH)}px`,
      innerH: `${Math.round(innerH)}px`,
      frameW: `${frameW}px`,
      frameWNum: frameW,
      totalRibbonW: `${totalRibbonW}px`,
    };
  }, [stageSize, aspectRatio]);

  if (!selectedFile) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-8 select-none overflow-hidden bg-[var(--well-inset)]">
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:28px_28px]" />
        <CurvedFilmBackground />
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: 'radial-gradient(circle at 50% 50%, transparent 25%, rgba(5,6,8,0.4) 100%)' }}
        />
        <EmptyDropzone
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={onDropzoneClick}
        />
      </div>
    );
  }

  if (isAudioMode) {
    return (
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          src={directVideoSrc}
          crossOrigin="anonymous"
          preload="auto"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          muted={isMuted}
          className="absolute inset-0 opacity-0 pointer-events-none z-0"
          playsInline
        />
        <AudioStage
          isPlaying={isPlaying}
          selectedFile={selectedFile}
          mediaMetadata={mediaMetadata}
          currentTime={currentTime}
          duration={duration}
          fps={fps}
          onTogglePlay={onTogglePlay}
          canPlay={canPlay}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden relative select-none">
      {/* 35mm Master Film Chassis — Centered so Center Frame is dead-center */}
      <div
        className="flex flex-col relative rounded-[6px] bg-[var(--film-leader-bg)] border-2 border-[var(--film-leader-border)] shadow-panel-bevel overflow-hidden shrink-0 select-none z-20"
        style={{
          width: filmRibbonStyle.totalRibbonW,
          height: filmRibbonStyle.ribbonH,
        }}
      >
        {/* Top Rebate Rail (3 Aligned Frame Sections) */}
        <div
          className="h-[40px] w-full flex items-center justify-center relative overflow-hidden select-none shrink-0 border-b-2 border-[var(--film-leader-border)]"
          style={{
            background: 'linear-gradient(180deg, #3d1c0a 0%, #291206 50%, #150702 100%)',
            boxShadow: 'inset 0 1.5px 2px rgba(255, 230, 180, 0.28), inset 0 -1.5px 3px rgba(0, 0, 0, 0.95)',
          }}
        >
          {/* Frame 1 Top: Head */}
          <div style={{ width: filmRibbonStyle.frameW }} className="h-full flex items-center justify-between px-4 shrink-0 relative">
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
            <span className="font-mono text-[8.5px] font-bold tracking-[0.25em] text-[var(--film-perforation-amber)]/75 select-none uppercase">
              HEAD · IN 00:00:00
            </span>
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
          </div>

          <div className="w-[6px] h-full shrink-0" />

          {/* Frame 2 Top: Center Live Video */}
          <div style={{ width: filmRibbonStyle.frameW }} className="h-full flex items-center justify-between px-4 shrink-0 relative">
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
            <span className="font-mono text-[8.5px] font-bold tracking-[0.3em] text-[var(--film-perforation-amber)]/90 select-none uppercase">
              SAFETY FILM · 35mm
            </span>
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
          </div>

          <div className="w-[6px] h-full shrink-0" />

          {/* Frame 3 Top: Tail */}
          <div style={{ width: filmRibbonStyle.frameW }} className="h-full flex items-center justify-between px-4 shrink-0 relative">
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
            <span className="font-mono text-[8.5px] font-bold tracking-[0.25em] text-[var(--film-perforation-amber)]/75 select-none uppercase">
              TAIL · OUT {formatTimecode(Math.max(0, duration - 1), fps)}
            </span>
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
          </div>
        </div>

        {/* Middle Stage: 3 Continuous 35mm Frames */}
        <div className="flex items-center justify-center relative z-10 w-full overflow-hidden shrink-0">
          {/* 1. Left Frame: Head 00:00 Thumbnail */}
          <div
            style={{ width: filmRibbonStyle.frameW, height: filmRibbonStyle.innerH }}
            className="relative overflow-hidden bg-[var(--film-well)] flex items-center justify-center shrink-0"
          >
            {headThumb ? (
              <img
                src={headThumb}
                alt="Head Frame"
                className="w-full h-full object-contain filter sepia-[0.3] brightness-60 opacity-50 select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-amber-500/30 gap-1 bg-gradient-to-b from-[var(--film-leader-bg)] to-[var(--film-placeholder-deep)]">
                <Film className="w-6 h-6 animate-pulse opacity-40" />
                <span className="text-[8px] font-mono font-bold text-amber-500/40">HEAD 00:00</span>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none shadow-inset-deep" />
          </div>

          <div className="w-[6px] h-full bg-[var(--film-gutter)] border-l border-r border-black/90 shadow-sprocket-edge shrink-0" />

          {/* 2. Center Frame: LIVE ACTIVE VIDEO (Dead-Center!) */}
          <div
            style={{ width: filmRibbonStyle.frameW, height: filmRibbonStyle.innerH }}
            className="relative overflow-hidden bg-black flex items-center justify-center shrink-0 group shadow-panel-bevel"
          >
            <video
              ref={videoRef}
              src={directVideoSrc}
              crossOrigin="anonymous"
              poster={firstFramePoster || undefined}
              preload="auto"
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMetadata}
              muted={isMuted}
              className="w-full h-full block object-contain select-none cursor-pointer"
              onClick={canPlay ? onTogglePlay : undefined}
              playsInline
              style={{ backgroundColor: '#000000' }}
            />
            {!isPlaying && canPlay && (
              <div
                onClick={onTogglePlay}
                className="absolute inset-0 bg-black/40 hover:bg-black/30 cursor-pointer transition-colors z-20"
                title="Click to Play (Space)"
              />
            )}
          </div>

          <div className="w-[6px] h-full bg-[var(--film-gutter)] border-l border-r border-black/90 shadow-sprocket-edge shrink-0" />

          {/* 3. Right Frame: Tail Thumbnail (Duration - 1s) */}
          <div
            style={{ width: filmRibbonStyle.frameW, height: filmRibbonStyle.innerH }}
            className="relative overflow-hidden bg-[var(--film-well)] flex items-center justify-center shrink-0"
          >
            {tailThumb ? (
              <img
                src={tailThumb}
                alt="Tail Frame"
                className="w-full h-full object-contain filter sepia-[0.3] brightness-60 opacity-50 select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-amber-500/30 gap-1 bg-gradient-to-b from-[var(--film-leader-bg)] to-[var(--film-placeholder-deep)]">
                <Film className="w-6 h-6 animate-pulse opacity-40" />
                <span className="text-[8px] font-mono font-bold text-amber-500/40">TAIL END</span>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none shadow-inset-deep" />
          </div>
        </div>

        {/* Bottom Rebate Rail (3 Aligned Frame Sections) */}
        <div
          className="h-[40px] w-full flex items-center justify-center relative overflow-hidden select-none shrink-0 border-t-2 border-[var(--film-leader-border)]"
          style={{
            background: 'linear-gradient(180deg, #150702 0%, #291206 50%, #3d1c0a 100%)',
            boxShadow: 'inset 0 1.5px 3px rgba(0, 0, 0, 0.95), inset 0 -1.5px 2px rgba(255, 230, 180, 0.28)',
          }}
        >
          <div style={{ width: filmRibbonStyle.frameW }} className="h-full flex items-center justify-between px-4 shrink-0 relative">
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
            <span className="font-mono text-[8px] font-semibold text-amber-500/60 select-none">
              35mm 500T
            </span>
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
          </div>

          <div className="w-[6px] h-full shrink-0" />

          <div style={{ width: filmRibbonStyle.frameW }} className="h-full flex items-center justify-between px-4 shrink-0 relative">
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
            <span className="font-mono text-[8px] font-semibold text-amber-500/60 select-none">
              TRIMBIN V3 5219
            </span>
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
          </div>

          <div className="w-[6px] h-full shrink-0" />

          <div style={{ width: filmRibbonStyle.frameW }} className="h-full flex items-center justify-between px-4 shrink-0 relative">
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
            <span className="font-mono text-[8px] font-semibold text-amber-500/60 select-none">
              SMPTE TIMECODE
            </span>
            <div className="flex items-center gap-6">
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
              <div className="w-[17px] h-[12px] rounded-[3px] bg-[var(--sprocket-hole)] border border-[var(--sprocket-border)] shadow-sprocket-hole shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

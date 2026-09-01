import React, { useState, useEffect, useRef, useMemo } from 'react';
import { VideoViewport } from './stage/VideoViewport';
import { TransportBar } from './stage/TransportBar';

export interface TrimBinVideoStageProps {
  selectedFile: { name: string; path: string } | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  hasActiveClips?: boolean;
  onTogglePlay: () => void;
  onJumpPrevCut: () => void;
  onJumpNextCut: () => void;
  smartSkipOn: boolean;
  onToggleSmartSkip: () => void;
  currentTime: number;
  duration: number;
  fps: number;
  onTimeUpdate: () => void;
  onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onBrowseFile: () => void;
  onLoadFile?: (filePath: string, fileName?: string) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function safeSeekTime(targetTime: number, duration: number, fps: number = 30): number {
  if (!duration || duration <= 0 || isNaN(duration)) return 0.001;
  const frameDuration = Math.max(0.033, 1 / (fps || 30));
  return Math.max(0.001, Math.min(targetTime, duration - frameDuration));
}

export const TrimBinVideoStage: React.FC<TrimBinVideoStageProps> = ({
  selectedFile,
  videoRef,
  isPlaying,
  hasActiveClips = true,
  onTogglePlay,
  onJumpPrevCut,
  onJumpNextCut,
  smartSkipOn,
  onToggleSmartSkip,
  currentTime,
  duration,
  fps,
  onTimeUpdate,
  onLoadedMetadata,
  onBrowseFile,
  onLoadFile,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  isMuted,
  onToggleMute,
}) => {
  const [firstFramePoster, setFirstFramePoster] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [headThumb, setHeadThumb] = useState<string | null>(null);
  const [tailThumb, setTailThumb] = useState<string | null>(null);
  const [mediaMetadata, setMediaMetadata] = useState<import('@/global').MediaMetadata | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentLoadedSrcRef = useRef<string>('');
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 800, height: 450 });

  const directVideoSrc = useMemo(() => {
    if (mediaMetadata?.playbackUrl) {
      return mediaMetadata.playbackUrl;
    }
    if (!selectedFile?.path) return '';
    if (typeof window !== 'undefined' && window.electron && typeof window.electron.getMediaUrl === 'function') {
      return window.electron.getMediaUrl(selectedFile.path);
    }
    return `media://local/?path=${encodeURIComponent(selectedFile.path)}`;
  }, [selectedFile?.path, mediaMetadata?.playbackUrl]);

  useEffect(() => {
    if (videoRef?.current && directVideoSrc && currentLoadedSrcRef.current !== directVideoSrc) {
      currentLoadedSrcRef.current = directVideoSrc;
      videoRef.current.load();
    }
  }, [directVideoSrc, videoRef]);

  useEffect(() => {
    let isCancelled = false;
    if (selectedFile?.path && window.electron?.getMediaMetadata) {
      window.electron
        .getMediaMetadata(selectedFile.path)
        .then((meta) => {
          if (!isCancelled) {
            setMediaMetadata(meta);
            const ext = (selectedFile.name || '').toLowerCase();
            const isNonNative = !ext.endsWith('.mp4') && !ext.endsWith('.webm');
            if (isNonNative && !meta.isProxy && window.electron?.ensureMediaPreviewProxy) {
              window.electron.ensureMediaPreviewProxy(selectedFile.path).then((proxyRes) => {
                if (!isCancelled && proxyRes?.playbackPath) {
                  setMediaMetadata((prev) => prev ? {
                    ...prev,
                    playbackUrl: `media://local/?path=${encodeURIComponent(proxyRes.playbackPath)}`,
                    isProxy: proxyRes.isProxy,
                  } : null);
                }
              }).catch(() => {});
            }
          }
        })
        .catch((err) => {
          console.warn('Failed to load media metadata:', err);
        });
    } else {
      setMediaMetadata(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [selectedFile?.path, selectedFile?.name]);

  const isAudioMode = useMemo(() => {
    if (mediaMetadata?.isAudioOnly) return true;
    if (selectedFile?.name) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      return ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'aiff', 'wma', 'opus'].includes(ext || '');
    }
    return false;
  }, [mediaMetadata, selectedFile]);

  const canPlay = !!selectedFile && hasActiveClips;

  useEffect(() => {
    if (!selectedFile?.path) {
      setHeadThumb(null);
      setTailThumb(null);
      setFirstFramePoster(null);
      return;
    }

    let isCancelled = false;
    if (typeof window !== 'undefined' && window.electron?.extractFirstFrame) {
      window.electron.extractFirstFrame(selectedFile.path, 0.01).then((dataUrl) => {
        if (!isCancelled && dataUrl) {
          setFirstFramePoster(dataUrl);
          setHeadThumb(dataUrl);
        }
      }).catch(() => {});

      if (duration > 0) {
        const safeTail = Math.max(0.05, duration - 1.0);
        window.electron.extractFirstFrame(selectedFile.path, safeTail).then((dataUrl) => {
          if (!isCancelled && dataUrl) {
            setTailThumb(dataUrl);
          }
        }).catch(() => {});
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [selectedFile?.path, duration, fps]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!canPlay) return;
    if (!document.fullscreenElement) {
      if (videoRef.current) {
        if (videoRef.current.requestFullscreen) {
          videoRef.current.requestFullscreen();
        } else if ('webkitRequestFullscreen' in (videoRef.current || {})) {
          ((videoRef.current as unknown) as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
        }
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleLoadedMetadataInternal = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const { videoWidth, videoHeight, duration: videoDur } = video;
    if (videoWidth && videoHeight && videoHeight > 0) {
      setAspectRatio(videoWidth / videoHeight);
    }
    if (videoDur > 0 && selectedFile?.path && window.electron?.extractFirstFrame) {
      const safeTail = Math.max(0.05, videoDur - 0.5);
      window.electron.extractFirstFrame(selectedFile.path, safeTail).then((dataUrl) => {
        if (dataUrl) setTailThumb(dataUrl);
      }).catch(() => {});
    }
    if (video.currentTime === 0) {
      video.currentTime = 0.001;
    }
    if (onLoadedMetadata) {
      onLoadedMetadata(e);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const filePath = (file as File & { path?: string }).path || file.name;
      if (onLoadFile) {
        onLoadFile(filePath, file.name);
      }
    }
    e.target.value = '';
  };

  const handleDropzoneClick = () => {
    if (window.electron) {
      onBrowseFile();
    } else {
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageSize({ width, height });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[var(--chassis-base)] overflow-hidden min-h-0 min-w-0 relative p-2 select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.mp4,.mov,.mkv,.avi,.webm,.wav,.mp3"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center min-h-0 min-w-0 relative w-full h-full overflow-hidden select-none"
      >
        <VideoViewport
          selectedFile={selectedFile}
          videoRef={videoRef}
          directVideoSrc={directVideoSrc}
          firstFramePoster={firstFramePoster}
          headThumb={headThumb}
          tailThumb={tailThumb}
          isAudioMode={isAudioMode}
          isPlaying={isPlaying}
          isMuted={isMuted}
          canPlay={canPlay}
          duration={duration}
          currentTime={currentTime}
          fps={fps}
          mediaMetadata={mediaMetadata}
          stageSize={stageSize}
          aspectRatio={aspectRatio}
          isDragging={isDragging}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={handleLoadedMetadataInternal}
          onTogglePlay={onTogglePlay}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDropzoneClick={handleDropzoneClick}
        />
      </div>

      <TransportBar
        canPlay={canPlay}
        isPlaying={isPlaying}
        isMuted={isMuted}
        smartSkipOn={smartSkipOn}
        isFullscreen={isFullscreen}
        currentTime={currentTime}
        fps={fps}
        onTogglePlay={onTogglePlay}
        onJumpPrevCut={onJumpPrevCut}
        onJumpNextCut={onJumpNextCut}
        onToggleSmartSkip={onToggleSmartSkip}
        onToggleMute={onToggleMute}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </div>
  );
};

import React, { useEffect } from 'react';
import { ComputedTimelineClip } from '../../../types/timeline';
import { TIMELINE_CANVAS_THEME } from './timelineTheme';

export interface VideoClipsTrackProps {
  videoCanvasRef: React.RefObject<HTMLCanvasElement>;
  totalTimelineWidth: number;
  projectDuration: number;
  hasMedia: boolean;
  effectiveClips: ComputedTimelineClip[];
  selectedClipId: string | null;
}

export const VideoClipsTrack: React.FC<VideoClipsTrackProps> = React.memo(({
  videoCanvasRef,
  totalTimelineWidth,
  projectDuration,
  hasMedia,
  effectiveClips,
  selectedClipId,
}) => {
  useEffect(() => {
    const canvas = videoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = totalTimelineWidth;
    const height = 42;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!hasMedia || projectDuration <= 0) {
      return;
    }

    effectiveClips.forEach((clip) => {
      const clipX = (clip.timelineStart / projectDuration) * width;
      const clipW = Math.max(4, (clip.duration / projectDuration) * width);
      const isSelected = selectedClipId === clip.id;

      const clipTop = 1;
      const clipHeight = 40;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(clipX, clipTop, clipW, clipHeight, 2);
      ctx.clip();

      const baseGrad = ctx.createLinearGradient(clipX, clipTop, clipX, clipTop + clipHeight);
      baseGrad.addColorStop(0, TIMELINE_CANVAS_THEME.filmStripGrad0);
      baseGrad.addColorStop(0.35, TIMELINE_CANVAS_THEME.filmStripGrad35);
      baseGrad.addColorStop(0.7, TIMELINE_CANVAS_THEME.filmStripGrad70);
      baseGrad.addColorStop(1, TIMELINE_CANVAS_THEME.filmStripGrad100);
      ctx.fillStyle = baseGrad;
      ctx.fillRect(clipX, clipTop, clipW, clipHeight);

      const frameWidth = 60;
      const topLabels = ['500T', '35mm', 'KODAK', 'SAFETY', 'VISION3', '8542'];
      const startGridIdx = Math.floor(clipX / frameWidth);
      const endGridIdx = Math.ceil((clipX + clipW) / frameWidth);

      for (let f = startGridIdx; f <= endGridIdx; f++) {
        const fx = f * frameWidth;
        const frameNum = (Math.abs(f) % 99) + 1;

        const radialVignette = ctx.createRadialGradient(
          fx + frameWidth / 2,
          clipTop + clipHeight / 2,
          4,
          fx + frameWidth / 2,
          clipTop + clipHeight / 2,
          26
        );
        radialVignette.addColorStop(0, 'rgba(217, 119, 6, 0.22)');
        radialVignette.addColorStop(0.7, 'rgba(120, 45, 10, 0.15)');
        radialVignette.addColorStop(1, 'rgba(10, 4, 1, 0.45)');
        ctx.fillStyle = radialVignette;
        ctx.fillRect(Math.max(clipX, fx), clipTop, Math.min(clipX + clipW - Math.max(clipX, fx), frameWidth), clipHeight);

        const holeW = 5.5;
        const holeH = 4;
        const topHoleY = clipTop + 2;
        const botHoleY = clipTop + clipHeight - 6;
        const holeXs = [fx + 3, fx + 12, fx + 42.5, fx + 51.5];

        ctx.fillStyle = TIMELINE_CANVAS_THEME.filmPerforation;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;

        holeXs.forEach((hx) => {
          if (hx >= clipX - 1 && hx + holeW <= clipX + clipW + 1) {
            ctx.beginPath();
            ctx.roundRect(hx, topHoleY, holeW, holeH, 1);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.roundRect(hx, botHoleY, holeW, holeH, 1);
            ctx.fill();
          }
        });

        if (Math.abs(f) % 3 === 0 && fx + 18 >= clipX && fx + 42 <= clipX + clipW) {
          const topText = topLabels[(Math.abs(f) / 3) % topLabels.length];
          ctx.save();
          ctx.fillStyle = TIMELINE_CANVAS_THEME.filmLabel;
          ctx.font = 'bold 6px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 2;
          ctx.fillText(topText, fx + 30, topHoleY + holeH / 2);

          const botCenterX = fx + 30;
          ctx.fillStyle = TIMELINE_CANVAS_THEME.filmFrameNum;
          ctx.font = 'bold 6px "IBM Plex Mono", monospace';
          ctx.fillText(`▶ ${frameNum}`, botCenterX - 4.5, botHoleY + holeH / 2);

          ctx.fillStyle = TIMELINE_CANVAS_THEME.filmLabel;
          const barX = botCenterX + 3.5;
          [1, 0.6, 1.2, 0.6, 1.5, 0.6].forEach((bw, bi) => {
            ctx.fillRect(barX + bi * 1.3, botHoleY + 0.5, bw, holeH - 1);
          });
          ctx.restore();
        }

        const frameDivX = fx + frameWidth - 1.5;
        if (frameDivX > clipX && frameDivX < clipX + clipW - 1.5) {
          ctx.fillStyle = TIMELINE_CANVAS_THEME.filmFrameHole;
          ctx.fillRect(frameDivX, clipTop, 1.5, clipHeight);
          ctx.fillStyle = 'rgba(255, 230, 180, 0.08)';
          ctx.fillRect(frameDivX + 1.5, clipTop, 0.5, clipHeight);
        }
      }

      if (clipW > 50) {
        const badgeW = Math.min(clipW - 12, 140);
        ctx.fillStyle = 'rgba(10, 6, 3, 0.85)';
        ctx.beginPath();
        ctx.roundRect(clipX + 6, clipTop + 10, badgeW, clipHeight - 20, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX + 9, clipTop + 10, badgeW - 6, clipHeight - 20);
        ctx.clip();
        ctx.fillStyle = TIMELINE_CANVAS_THEME.filmTextLight;
        ctx.font = 'bold 8px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 2;
        ctx.fillText(clip.name, clipX + 11, clipTop + clipHeight / 2);
        ctx.restore();
      }

      ctx.restore();

      ctx.fillStyle = TIMELINE_CANVAS_THEME.filmEdgeBorder;
      ctx.fillRect(clipX, clipTop, 1.5, clipHeight);
      ctx.fillRect(clipX + clipW - 1.5, clipTop, 1.5, clipHeight);

      ctx.fillStyle = TIMELINE_CANVAS_THEME.filmFrameNum;
      ctx.fillRect(clipX, clipTop, 1.5, 4);
      ctx.fillRect(clipX + clipW - 1.5, clipTop, 1.5, 4);
      ctx.fillRect(clipX, clipTop + clipHeight - 4, 1.5, 4);
      ctx.fillRect(clipX + clipW - 1.5, clipTop + clipHeight - 4, 1.5, 4);

      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = TIMELINE_CANVAS_THEME.filmSelectionStroke;
        ctx.lineWidth = 2;
        ctx.shadowColor = TIMELINE_CANVAS_THEME.filmSelectionGlow;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(clipX + 0.5, clipTop + 0.5, clipW - 1, clipHeight - 1, 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(clipX + 0.5, clipTop + 0.5, clipW - 1, clipHeight - 1, 2);
        ctx.stroke();
      }
    });
  }, [hasMedia, effectiveClips, projectDuration, totalTimelineWidth, selectedClipId, videoCanvasRef]);

  return (
    <div className="h-[42px] relative flex items-center overflow-hidden shrink-0 border-b border-black/80 box-border">
      <canvas
        ref={videoCanvasRef}
        height={42}
        style={{ width: `${totalTimelineWidth}px`, height: '42px' }}
        className="block"
      />
    </div>
  );
});

VideoClipsTrack.displayName = 'VideoClipsTrack';

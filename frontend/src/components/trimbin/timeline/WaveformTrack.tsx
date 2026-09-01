import React, { useEffect } from 'react';
import { ComputedTimelineClip, SilenceSlice } from '../../../types/timeline';
import { TIMELINE_CANVAS_THEME } from './timelineTheme';
import { RenderedSilenceCut } from './useTimelineGestures';

export interface WaveformTrackProps {
  waveformCanvasRef: React.RefObject<HTMLCanvasElement>;
  totalTimelineWidth: number;
  projectDuration: number;
  hasMedia: boolean;
  effectiveClips: ComputedTimelineClip[];
  silenceSlices: SilenceSlice[];
  renderedSilenceCuts: RenderedSilenceCut[];
}

export const WaveformTrack: React.FC<WaveformTrackProps> = React.memo(({
  waveformCanvasRef,
  totalTimelineWidth,
  projectDuration,
  hasMedia,
  effectiveClips,
  silenceSlices,
  renderedSilenceCuts,
}) => {
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = totalTimelineWidth;
    const height = 90;
    const midY = height / 2;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!hasMedia || projectDuration <= 0) {
      return;
    }

    ctx.fillStyle = TIMELINE_CANVAS_THEME.waveformBg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, 1);
    ctx.fillRect(0, height - 1, width, 1);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    renderedSilenceCuts.forEach((cut) => {
      if (cut.pixelWidth < 1.0) return;

      if (cut.isKept) {
        ctx.fillStyle = 'rgba(5, 150, 105, 0.45)';
      } else {
        ctx.fillStyle = 'rgba(190, 24, 93, 0.45)';
      }
      ctx.fillRect(cut.pixelStart, 0, cut.pixelWidth, height);

      if (cut.isKept) {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.7)';
      } else {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.55)';
      }
      ctx.fillRect(cut.pixelStart, 0, 1, height);
      ctx.fillRect(cut.pixelStart + cut.pixelWidth - 1, 0, 1, height);

      if (cut.isSelected) {
        ctx.save();
        ctx.strokeStyle = cut.isKept ? TIMELINE_CANVAS_THEME.waveformCutKeptStroke : TIMELINE_CANVAS_THEME.waveformCutCutStroke;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = cut.isKept ? TIMELINE_CANVAS_THEME.waveformCutKeptGlow : TIMELINE_CANVAS_THEME.waveformCutCutGlow;
        ctx.shadowBlur = 10;
        ctx.strokeRect(cut.pixelStart + 0.5, 1, Math.max(3, cut.pixelWidth - 1), height - 2);

        ctx.fillStyle = cut.isKept ? 'rgba(16, 185, 129, 0.28)' : 'rgba(245, 158, 11, 0.28)';
        ctx.fillRect(cut.pixelStart + 0.5, 1, Math.max(3, cut.pixelWidth - 1), height - 2);
        ctx.restore();
      }
    });

    const maxAmplitude = (height / 2) * 0.78;
    const waveGrad = ctx.createLinearGradient(0, midY - maxAmplitude, 0, midY + maxAmplitude);
    waveGrad.addColorStop(0, TIMELINE_CANVAS_THEME.waveformGradTop);
    waveGrad.addColorStop(0.25, TIMELINE_CANVAS_THEME.waveformGradMid);
    waveGrad.addColorStop(0.5, TIMELINE_CANVAS_THEME.waveformGradDeep);
    waveGrad.addColorStop(0.75, TIMELINE_CANVAS_THEME.waveformGradMid);
    waveGrad.addColorStop(1, TIMELINE_CANVAS_THEME.waveformGradTop);

    effectiveClips.forEach((clip) => {
      const clipX = (clip.timelineStart / projectDuration) * width;
      const clipW = (clip.duration / projectDuration) * width;
      if (clipW <= 0) return;

      const clipSlices = silenceSlices.filter(
        (s) => s.end > clip.sourceStart && s.start < clip.sourceEnd
      );
      let sliceIdx = 0;

      const pixelStep = 1;
      const numPoints = Math.max(2, Math.ceil(clipW / pixelStep));
      const xs = new Float32Array(numPoints + 1);
      const topYs = new Float32Array(numPoints + 1);
      const botYs = new Float32Array(numPoints + 1);

      for (let i = 0; i <= numPoints; i++) {
        const px = Math.min(clipX + clipW, clipX + i * pixelStep);
        const ratio = (px - clipX) / clipW;
        const sourceTime = clip.sourceStart + ratio * clip.duration;

        while (sliceIdx < clipSlices.length && clipSlices[sliceIdx].end < sourceTime) {
          sliceIdx++;
        }
        const curSlice = clipSlices[sliceIdx];
        const isSilent = curSlice && sourceTime >= curSlice.start && sourceTime <= curSlice.end ? curSlice.isSilent : false;

        const rawEnvelope =
          Math.abs(Math.sin(sourceTime * 3.5)) * 0.35 +
          Math.abs(Math.sin(sourceTime * 7.2)) * 0.3 +
          Math.abs(Math.sin(sourceTime * 14.1)) * 0.2 +
          Math.abs(Math.sin(sourceTime * 0.8)) * 0.15;

        const amp = isSilent
          ? Math.max(0.02, rawEnvelope * 0.08)
          : Math.max(0.08, rawEnvelope);

        xs[i] = px;
        topYs[i] = midY - amp * maxAmplitude;
        botYs[i] = midY + amp * maxAmplitude;
      }

      if (numPoints > 0) {
        ctx.beginPath();
        ctx.moveTo(xs[0], midY);

        for (let i = 0; i <= numPoints; i++) {
          ctx.lineTo(xs[i], topYs[i]);
        }
        for (let i = numPoints; i >= 0; i--) {
          ctx.lineTo(xs[i], botYs[i]);
        }
        ctx.closePath();

        ctx.fillStyle = waveGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }

      const clipX_boundary = (clip.timelineStart / projectDuration) * width;
      const clipW_boundary = (clip.duration / projectDuration) * width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(clipX_boundary, 0, 1, height);
      ctx.fillRect(clipX_boundary + clipW_boundary - 1, 0, 1, height);
    });
  }, [hasMedia, effectiveClips, silenceSlices, renderedSilenceCuts, projectDuration, totalTimelineWidth, waveformCanvasRef]);

  return (
    <div className="h-[90px] relative flex items-center overflow-hidden shrink-0 box-border">
      <canvas
        ref={waveformCanvasRef}
        height={90}
        style={{ width: `${totalTimelineWidth}px`, height: '90px' }}
        className="block"
      />
    </div>
  );
});

WaveformTrack.displayName = 'WaveformTrack';

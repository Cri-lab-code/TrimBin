import React, { useEffect } from 'react';
import { TIMELINE_CANVAS_THEME } from './timelineTheme';

export interface TimelineRulerProps {
  rulerCanvasRef: React.RefObject<HTMLCanvasElement>;
  totalTimelineWidth: number;
  projectDuration: number;
  hasMedia: boolean;
}

const TIME_STEPS = [
  0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30,
  60, 120, 300, 600, 900, 1800,
  3600, 7200, 14400, 28800,
];

export function getDynamicTimeStep(duration: number, pixelWidth: number, minPixelDistance: number = 100): number {
  if (duration <= 0 || pixelWidth <= 0) return 60;
  const maxLabels = Math.max(2, Math.floor(pixelWidth / minPixelDistance));
  const rawStep = duration / maxLabels;

  for (const step of TIME_STEPS) {
    if (step >= rawStep) {
      return step;
    }
  }
  return 3600;
}

export function formatRulerTime(seconds: number): string {
  if (seconds === 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  if (hrs > 0) {
    if (mins === 0 && secs === 0) return `${hrs}h`;
    return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
  }
  if (mins > 0) {
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  }
  if (seconds < 10 && ms > 0) {
    return `${secs}.${String(Math.floor(ms)).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = React.memo(({
  rulerCanvasRef,
  totalTimelineWidth,
  projectDuration,
  hasMedia,
}) => {
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = totalTimelineWidth;
    const height = 26;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, TIMELINE_CANVAS_THEME.rulerBgTop);
    bgGrad.addColorStop(1, TIMELINE_CANVAS_THEME.rulerBgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    if (!hasMedia || projectDuration <= 0) {
      ctx.fillStyle = TIMELINE_CANVAS_THEME.rulerMajorTick;
      ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('0:00', 12, height / 2);
      return;
    }

    const majorStep = getDynamicTimeStep(projectDuration, totalTimelineWidth, 100);
    const numMajorTicks = Math.floor(projectDuration / majorStep);

    ctx.fillStyle = TIMELINE_CANVAS_THEME.rulerMinorTick;
    for (let i = 0; i <= numMajorTicks; i++) {
      const t = i * majorStep;
      for (let m = 1; m < 5; m++) {
        const minorT = t + (m * majorStep) / 5;
        if (minorT < projectDuration) {
          const minorX = Math.round((minorT / projectDuration) * width);
          ctx.fillRect(minorX, height - 6, 1, 6);
        }
      }
    }

    ctx.font = '800 9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= numMajorTicks; i++) {
      const t = i * majorStep;
      const majorX = Math.round((t / projectDuration) * width);

      ctx.fillStyle = TIMELINE_CANVAS_THEME.rulerMinorLabel;
      ctx.fillRect(majorX, height - 10, 1, 10);

      const label = formatRulerTime(t);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText(label, majorX + 0.5, 9);
      ctx.fillStyle = TIMELINE_CANVAS_THEME.rulerMajorLabel;
      ctx.fillText(label, majorX, 8);
    }

    if (Math.abs(numMajorTicks * majorStep - projectDuration) > majorStep * 0.25) {
      const endX = Math.round(width);
      ctx.fillStyle = TIMELINE_CANVAS_THEME.rulerMinorLabel;
      ctx.fillRect(endX - 1, height - 10, 1, 10);
      const label = formatRulerTime(projectDuration);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillText(label, endX - 14, 9);
      ctx.fillStyle = TIMELINE_CANVAS_THEME.rulerMajorLabel;
      ctx.fillText(label, endX - 14.5, 8);
    }
  }, [hasMedia, projectDuration, totalTimelineWidth, rulerCanvasRef]);

  return (
    <div className="h-[26px] bg-gradient-to-b from-[var(--timeline-ruler-top)] to-[var(--timeline-ruler-bot)] border-b border-black/80 relative shrink-0 overflow-hidden shadow-inset-well box-border">
      <canvas
        ref={rulerCanvasRef}
        height={26}
        style={{ width: `${totalTimelineWidth}px`, height: '26px' }}
        className="block"
      />
    </div>
  );
});

TimelineRuler.displayName = 'TimelineRuler';

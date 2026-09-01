export interface VisualCutRegion {
  x: number;
  width: number;
}

export interface SilenceSliceInput {
  startTime: number;
  duration: number;
  isSilent: boolean;
}

/**
 * Merges adjacent or overlapping silence regions strictly when gap <= 0.
 * Never jumps or bridges over active speech segments.
 */
export function getClusteredSilenceRegions(
  slices: SilenceSliceInput[],
  pxPerSec: number
): VisualCutRegion[] {
  const silentSlices = slices.filter((s) => s.isSilent && s.duration > 0);
  if (silentSlices.length === 0) return [];

  // Ensure slices are ordered chronologically
  const sorted = [...silentSlices].sort((a, b) => a.startTime - b.startTime);

  const regions: VisualCutRegion[] = [];

  for (const s of sorted) {
    const x = s.startTime * pxPerSec;
    // Guaranteed minimum visibility of 1 pixel without stretching over speech
    const width = Math.max(1, s.duration * pxPerSec);

    if (regions.length === 0) {
      regions.push({ x, width });
      continue;
    }

    const last = regions[regions.length - 1];
    const lastEnd = last.x + last.width;

    // Merge ONLY if slices overlap or touch (x <= lastEnd)
    if (x <= lastEnd) {
      const newEnd = Math.max(lastEnd, x + width);
      last.width = newEnd - last.x;
    } else {
      regions.push({ x, width });
    }
  }

  return regions;
}

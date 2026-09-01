export interface CutSegment {
  id?: string;
  inFrame: number;
  outFrame: number;
  inSec: number;
  outSec: number;
  durationSec: number;
  isCut?: boolean;
}

export interface SilenceCut {
  inSec: number;
  outSec: number;
  durationSec: number;
}

export interface CutTimelineData {
  fps: number;
  segments: CutSegment[];
  silenceCuts: SilenceCut[];
  totalCutDuration: number;
  originalDuration: number;
  savedDuration: number;
  savedPercentage: number;
  cutsCount: number;
}

export function parseCutXml(xmlContent: string, totalFileDuration?: number): CutTimelineData {
    const timebaseMatch = xmlContent.match(/<timebase>(\d+(?:\.\d+)?)/);
  const isNtsc = /<ntsc>\s*TRUE\s*<\/ntsc>/i.test(xmlContent);
  const rawTimebase = timebaseMatch ? parseFloat(timebaseMatch[1]) : 30.0;
  
    const fps = isNtsc ? (rawTimebase * 1000) / 1001 : rawTimebase;

  const rawSegments: CutSegment[] = [];

    const videoTrackMatch = xmlContent.match(/<video>[\s\S]*?<track>([\s\S]*?)<\/track>/);
  const audioTrackMatch = xmlContent.match(/<audio>[\s\S]*?<track[^>]*>([\s\S]*?)<\/track>/);
  const trackXml = videoTrackMatch ? videoTrackMatch[1] : (audioTrackMatch ? audioTrackMatch[1] : xmlContent);

    const clipRegex = /<clipitem[^>]*>([\s\S]*?)<\/clipitem>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = clipRegex.exec(trackXml)) !== null) {
    const itemContent = itemMatch[1];
    const inMatch = itemContent.match(/<in>(\d+)<\/in>/);
    const outMatch = itemContent.match(/<out>(\d+)<\/out>/);

    if (inMatch && outMatch) {
      const inFrame = parseInt(inMatch[1], 10);
      const outFrame = parseInt(outMatch[1], 10);
      const inSec = inFrame / fps;
      const outSec = outFrame / fps;
      const durationSec = Math.max(0, outSec - inSec);

      if (durationSec > 0) {
        rawSegments.push({
          inFrame,
          outFrame,
          inSec: parseFloat(inSec.toFixed(3)),
          outSec: parseFloat(outSec.toFixed(3)),
          durationSec: parseFloat(durationSec.toFixed(3)),
        });
      }
    }
  }

  const mergedSegments: CutSegment[] = [];
  for (const seg of rawSegments) {
    if (mergedSegments.length === 0) {
      mergedSegments.push({ ...seg });
    } else {
      const prev = mergedSegments[mergedSegments.length - 1];
      if (seg.inSec <= prev.outSec + 0.001) {
        prev.outSec = Math.max(prev.outSec, seg.outSec);
        prev.outFrame = Math.max(prev.outFrame, seg.outFrame);
        prev.durationSec = parseFloat((prev.outSec - prev.inSec).toFixed(3));
      } else {
        mergedSegments.push({ ...seg });
      }
    }
  }

  const silenceCuts: SilenceCut[] = [];
  
  if (mergedSegments.length > 0) {
    const firstIn = mergedSegments[0].inSec;
    if (firstIn > 0.01) {
      silenceCuts.push({
        inSec: 0,
        outSec: firstIn,
        durationSec: parseFloat(firstIn.toFixed(3)),
      });
    }

    for (let i = 0; i < mergedSegments.length - 1; i++) {
      const gapIn = mergedSegments[i].outSec;
      const gapOut = mergedSegments[i + 1].inSec;
      const gapDuration = parseFloat((gapOut - gapIn).toFixed(3));
      if (gapDuration > 0.01) {
        silenceCuts.push({
          inSec: gapIn,
          outSec: gapOut,
          durationSec: gapDuration,
        });
      }
    }

    const lastOut = mergedSegments[mergedSegments.length - 1].outSec;
    if (totalFileDuration && totalFileDuration > lastOut + 0.01) {
      silenceCuts.push({
        inSec: lastOut,
        outSec: totalFileDuration,
        durationSec: parseFloat((totalFileDuration - lastOut).toFixed(3)),
      });
    }
  }

  let totalKeptDuration = 0;
  for (const seg of mergedSegments) {
    totalKeptDuration += seg.durationSec;
  }
  totalKeptDuration = parseFloat(totalKeptDuration.toFixed(3));

  const originalDuration = totalFileDuration && totalFileDuration > 0
    ? totalFileDuration
    : (mergedSegments.length > 0 ? mergedSegments[mergedSegments.length - 1].outSec : 0);

  let totalSilenceDuration = 0;
  for (const cut of silenceCuts) {
    totalSilenceDuration += cut.durationSec;
  }
  const savedDuration = parseFloat(totalSilenceDuration.toFixed(3));
  const savedPercentage = originalDuration > 0
    ? Math.round((savedDuration / originalDuration) * 100)
    : 0;

  return {
    fps,
    segments: mergedSegments,
    silenceCuts,
    totalCutDuration: totalKeptDuration,
    originalDuration,
    savedDuration,
    savedPercentage,
    cutsCount: silenceCuts.length,
  };
}

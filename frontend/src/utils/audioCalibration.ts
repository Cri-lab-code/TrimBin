/**
 * Audio level auto-calibration using Otsu bimodal segmentation on RMS windows.
 */

export interface CalibrationResult {
  db: number;
  linear: number;
  meanVolume?: number;
  maxVolume?: number;
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

export function linearToDb(linear: number): number {
  return linear > 0.000001 ? 20 * Math.log10(linear) : -90;
}

export function formatLinearAmplitude(db: number): string {
  const lin = dbToLinear(db);
  if (lin < 0.001) return lin.toFixed(4);
  if (lin < 0.1) return lin.toFixed(3);
  return lin.toFixed(2);
}

export function calculateOptimalSilenceThreshold(
  audioSource: AudioBuffer | { getChannelData: (ch: number) => Float32Array; sampleRate: number } | Float32Array,
  sampleRate: number = 44100,
  windowSizeMs: number = 50
): CalibrationResult {
  let channelData: Float32Array;
  let sRate = sampleRate;

  if (audioSource instanceof Float32Array) {
    channelData = audioSource;
  } else if ('getChannelData' in audioSource) {
    channelData = audioSource.getChannelData(0);
    sRate = audioSource.sampleRate || sampleRate;
  } else {
    return { db: -34, linear: 0.02 };
  }

  const windowSamples = Math.floor((sRate * windowSizeMs) / 1000);
  if (windowSamples <= 0) return { db: -34, linear: 0.02 };

  const totalWindows = Math.floor(channelData.length / windowSamples);
  if (totalWindows === 0) return { db: -34, linear: 0.02 };

  const dbMin = -70;
  const dbMax = 0;
  const numBins = 140;
  const histogram = new Array(numBins).fill(0);

  let validWindows = 0;

  for (let w = 0; w < totalWindows; w++) {
    let sumSquares = 0;
    const offset = w * windowSamples;

    for (let i = 0; i < windowSamples; i++) {
      const sample = channelData[offset + i];
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / windowSamples);
    const db = rms > 0.000001 ? 20 * Math.log10(rms) : -90;

    if (db >= dbMin && db <= dbMax) {
      const binIdx = Math.min(
        numBins - 1,
        Math.max(0, Math.floor(((db - dbMin) / (dbMax - dbMin)) * numBins))
      );
      histogram[binIdx]++;
      validWindows++;
    }
  }

  if (validWindows === 0) return { db: -34, linear: 0.02 };

  let sumTotal = 0;
  for (let i = 0; i < numBins; i++) {
    sumTotal += i * (histogram[i] / validWindows);
  }

  let weightBackground = 0;
  let sumBackground = 0;
  let maxVariance = 0;
  let bestBin = Math.floor(numBins * 0.35); // fallback ~-45dB

  for (let t = 0; t < numBins; t++) {
    const p_t = histogram[t] / validWindows;
    weightBackground += p_t;
    if (weightBackground === 0) continue;

    const weightForeground = 1 - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * p_t;
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumTotal - sumBackground) / weightForeground;

    const varianceBetween =
      weightBackground *
      weightForeground *
      Math.pow(meanBackground - meanForeground, 2);

    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      bestBin = t;
    }
  }

  const rawOtsuDb = dbMin + (bestBin / numBins) * (dbMax - dbMin);

  const optimalDb = Math.max(-50, Math.min(-15, Math.round(rawOtsuDb + 5)));
  const optimalLinear = parseFloat(dbToLinear(optimalDb).toFixed(4));

  return {
    db: optimalDb,
    linear: optimalLinear,
  };
}

export async function calibrateAudioSilence(
  mediaSource: string | File | AudioBuffer | Float32Array,
  audioContext?: AudioContext
): Promise<CalibrationResult> {
  if (mediaSource instanceof Float32Array) {
    return calculateOptimalSilenceThreshold(mediaSource);
  }

  if (typeof AudioBuffer !== 'undefined' && mediaSource instanceof AudioBuffer) {
    return calculateOptimalSilenceThreshold(mediaSource);
  }

  if (typeof mediaSource === 'string' && typeof window !== 'undefined' && window.electron?.analyzeAudioLevels) {
    try {
      const res = await window.electron.analyzeAudioLevels(mediaSource);
      if (res && res.success && res.suggestedThreshold !== undefined) {
        return {
          db: res.suggestedThreshold,
          linear: parseFloat(dbToLinear(res.suggestedThreshold).toFixed(4)),
          meanVolume: res.meanVolume,
          maxVolume: res.maxVolume,
        };
      }
    } catch (err) {
      console.warn('Native audio analysis failed, falling back to Web Audio decoding:', err);
    }
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext || AudioContext;
  const ctx = audioContext || new AudioContextClass();

  try {
    let arrayBuffer: ArrayBuffer;

    if (typeof mediaSource === 'string') {
      const resp = await fetch(mediaSource);
      arrayBuffer = await resp.arrayBuffer();
    } else if (mediaSource instanceof File) {
      arrayBuffer = await mediaSource.arrayBuffer();
    } else {
      return { db: -34, linear: 0.02 };
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return calculateOptimalSilenceThreshold(audioBuffer);
  } catch (err) {
    console.warn('Web Audio decode failed:', err);
    return { db: -34, linear: 0.02 };
  } finally {
    if (!audioContext && ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  }
}

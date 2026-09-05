import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { findAutoEditorBinary, findAutoEditorBinaryAsync, getAugmentedEnv, loadEnginePaths } from './binaryFinder';
import { parseCutXml, CutTimelineData } from './cutParser';
import { sanitizeAudioForAutoEditor, getMediaMetadata } from './ffmpegService';
import { normalizePathForSystem } from './pathUtils';
import { getTrackedTempPath, deleteTempFile, deleteTempFileSync } from './tempFileManager';
import { getExportExtension, openTargetNLE, fixXmlForDaVinciAndPremiere, fixKdenliveProject, fixShotcutProject } from './nlePatcher';

export interface AnalyzeCutsPayload {
  inputFile: string;
  duration?: number;
  loudness?: number;
  margin?: number;
  paddingLeft?: number;
  paddingRight?: number;
  isPaddingLinked?: boolean;
  minSilenceDuration?: number;
  minClipDuration?: number;
  isAutoThreshold?: boolean;
}

export interface RunCommandOptions {
  inputFile?: string;
  exportFormat?: string;
  loudness?: number;
  margin?: number;
  paddingLeft?: number;
  paddingRight?: number;
  isPaddingLinked?: boolean;
  minSilenceDuration?: number;
  minClipDuration?: number;
  isAutoThreshold?: boolean;
  outputFolder?: string;
  outputFilePath?: string;
  videoCodec?: string;
  audioCodec?: string;
  openWhenDone?: boolean;
  customArgs?: string[];
  cutRanges?: { start: number; end: number }[];
  duration?: number;
}

export async function analyzeCuts(
  payload: AnalyzeCutsPayload,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; timeline: CutTimelineData }> {
  if (payload.inputFile) payload.inputFile = normalizePathForSystem(payload.inputFile);
  const binaryInfo = await findAutoEditorBinaryAsync();
  if (!binaryInfo.available || !binaryInfo.path) {
    throw new Error(binaryInfo.error || 'Export failed: auto-editor binary missing.');
  }

  const {
    inputFile,
    duration,
    loudness = -25,
    margin = 0.2,
    paddingLeft = margin,
    paddingRight = margin,
    isPaddingLinked = true,
    isAutoThreshold = false,
  } = payload;

  if (!fs.existsSync(inputFile)) {
    throw new Error(`File not found: ${inputFile}`);
  }

  const { targetPath: sanitizedInputFile, isTemp: isSanitizedTemp } = await sanitizeAudioForAutoEditor(inputFile);
  const tempXmlPath = getTrackedTempPath('cuts', 'xml', 'trimbin_previews');

  const finalArgs: string[] = [
    sanitizedInputFile,
    '--export', 'premiere',
    '--no-open',
    '-o', tempXmlPath,
  ];

  if (isPaddingLinked || paddingLeft === paddingRight) {
    finalArgs.push('--margin', `${paddingLeft}s`);
  } else {
    finalArgs.push('--margin', `${paddingLeft}s,${paddingRight}s`);
  }

  // minSilenceDuration handled in timeline post-processing
  // minClipDuration handled in timeline post-processing
  if (isAutoThreshold && loudness === undefined) {
    finalArgs.push('--edit', 'audio');
  } else {
    finalArgs.push('--edit', `audio:threshold=${loudness}dB`);
  }

  let executable = binaryInfo.path;
  if (executable.includes(' -m auto_editor')) {
    executable = executable.split(' ')[0];
    finalArgs.unshift('-m', 'auto_editor');
  }

  const env = getAugmentedEnv();
  onProgress?.(5);

  return new Promise((resolve, reject) => {
    let outputBuffer = '';
    const child = spawn(executable, finalArgs, { env });

    child.stdout.on('data', (d: Buffer) => {
      const text = d.toString();
      outputBuffer += text;
      const match = text.match(/(\d{1,3}(?:\.\d+)?)%/);
      if (match && match[1]) {
        const percent = parseFloat(match[1]);
        if (!isNaN(percent)) onProgress?.(percent);
      }
    });

    child.stderr.on('data', (d: Buffer) => {
      outputBuffer += d.toString();
    });

    child.on('error', async (err) => {
      await deleteTempFile(tempXmlPath);
      if (isSanitizedTemp) {
        await deleteTempFile(sanitizedInputFile);
      }
      reject(err);
    });

    child.on('close', async (code) => {
      try {
        if (code === 0 && fs.existsSync(tempXmlPath)) {
          try {
            const xmlData = fs.readFileSync(tempXmlPath, 'utf8');
            const timeline = parseCutXml(xmlData, duration);
            onProgress?.(100);
            resolve({ success: true, timeline });
          } catch (parseErr: unknown) {
            const errMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
            reject(new Error(`Failed to parse timeline XML: ${errMessage}`));
          }
        } else {
          const fullErr = outputBuffer.trim();
          let msg = `Cut analysis failed with code ${code}`;
          if (fullErr.includes('Timeline is empty')) {
            msg = `Nessun audio rilevato con la soglia a ${loudness} dB: tutto il video è considerato silenzio (Timeline is empty). Imposta una soglia più bassa (es. -25 dB o -20 dB) oppure attiva l'Auto-Calibration.`;
          } else if (fullErr.includes('Could not open input file') || fullErr.includes('Invalid')) {
            msg = `Impossibile aprire il file per l'analisi: file non supportato o corrotto.`;
          } else if (fullErr) {
            const lastLine = fullErr.split('\n').filter(l => l.trim().length > 0).pop() || '';
            if (lastLine) msg = `Cut analysis failed (${lastLine})`;
          }
          reject(new Error(msg));
        }
      } finally {
        await deleteTempFile(tempXmlPath);
        if (isSanitizedTemp) {
          await deleteTempFile(sanitizedInputFile);
        }
      }
    });
  });
}

export async function generatePreview(
  payload: { inputFile: string; loudness: number; margin: number },
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; previewPath: string; mediaUrl: string }> {
  const binaryInfo = await findAutoEditorBinaryAsync();
  if (!binaryInfo.available || !binaryInfo.path) {
    throw new Error(binaryInfo.error || 'Export failed: auto-editor binary missing.');
  }

  const { inputFile, loudness = -25, margin = 0.2 } = payload;
  if (!fs.existsSync(inputFile)) {
    throw new Error(`File not found: ${inputFile}`);
  }

  const previewFilePath = getTrackedTempPath('preview', 'mp4', 'trimbin_previews');

  const finalArgs: string[] = [
    inputFile,
    '-res', '256,144',
    '--export', 'default',
    '--margin', `${margin}s`,
    '--edit', `audio:threshold=${loudness}dB`,
    '--no-open',
    '-o', previewFilePath,
  ];

  let executable = binaryInfo.path;
  if (executable.includes(' -m auto_editor')) {
    executable = executable.split(' ')[0];
    finalArgs.unshift('-m', 'auto_editor');
  }

  const env = getAugmentedEnv();
  onProgress?.(0);

  return new Promise((resolve, reject) => {
    let outputBuffer = '';
    const child = spawn(executable, finalArgs, { env });

    child.stdout.on('data', (d: Buffer) => {
      const text = d.toString();
      outputBuffer += text;
      const match = text.match(/(\d{1,3}(?:\.\d+)?)%/);
      if (match && match[1]) {
        const percent = parseFloat(match[1]);
        if (!isNaN(percent)) onProgress?.(percent);
      }
    });

    child.stderr.on('data', (d: Buffer) => {
      outputBuffer += d.toString();
    });

    child.on('error', (err) => reject(err));

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(previewFilePath)) {
        onProgress?.(100);
        resolve({
          success: true,
          previewPath: previewFilePath,
          mediaUrl: `media://local/?path=${encodeURIComponent(previewFilePath)}`,
        });
      } else {
        const fullErr = outputBuffer.trim();
        let msg = `Preview generation failed with code ${code}`;
        if (fullErr.includes('Timeline is empty')) {
          msg = `Nessun audio rilevato con la soglia a ${loudness} dB (Timeline is empty).`;
        } else if (fullErr.includes('Could not open input file') || fullErr.includes('Invalid')) {
          msg = `Impossibile aprire il file per la preview: file corrotto o non supportato.`;
        }
        reject(new Error(msg));
      }
    });
  });
}

/**
 * Creates an auto-editor v1 timeline file from an array of cut ranges.
 * This completely avoids the Windows CreateProcess 32,767 character limit (spawn ENAMETOOLONG)
 * and works identically and stably across Windows, macOS, and Linux.
 */
export async function createV1TimelineFromCuts(
  inputFile: string,
  cuts: { start: number; end: number }[],
  knownDuration?: number
): Promise<string> {
  let duration = knownDuration;
  if (!duration || duration <= 0) {
    try {
      const meta = await getMediaMetadata(inputFile);
      duration = meta.duration;
    } catch {}
  }

  // If duration is still unknown, estimate from the last cut + 1 second
  if (!duration || duration <= 0) {
    duration = cuts.reduce((max, c) => Math.max(max, c.end), 0) + 1.0;
  }

  // Sort and merge cuts to ensure clean contiguous timeline
  const sortedCuts = [...cuts]
    .filter((c) => !isNaN(c.start) && !isNaN(c.end) && c.end > c.start)
    .sort((a, b) => a.start - b.start);

  const mergedCuts: { start: number; end: number }[] = [];
  for (const cut of sortedCuts) {
    if (mergedCuts.length === 0) {
      mergedCuts.push({ ...cut });
    } else {
      const prev = mergedCuts[mergedCuts.length - 1];
      if (cut.start <= prev.end) {
        prev.end = Math.max(prev.end, cut.end);
      } else {
        mergedCuts.push({ ...cut });
      }
    }
  }

  const totalMs = Math.round(duration * 1000);
  const chunks: [number, number, number][] = [];
  let currentMs = 0;

  for (const cut of mergedCuts) {
    const cutStartMs = Math.min(totalMs, Math.max(0, Math.round(cut.start * 1000)));
    const cutEndMs = Math.min(totalMs, Math.max(cutStartMs, Math.round(cut.end * 1000)));

    if (cutStartMs > currentMs) {
      // Kept section (normal speed 1.0)
      chunks.push([currentMs, cutStartMs, 1.0]);
    }
    if (cutEndMs > cutStartMs) {
      // Cut section (99999.0 speed = cut)
      chunks.push([cutStartMs, cutEndMs, 99999.0]);
    }
    currentMs = Math.max(currentMs, cutEndMs);
  }

  if (currentMs < totalMs) {
    // Kept section until the end of the video
    chunks.push([currentMs, totalMs, 1.0]);
  }

  const v1Data = {
    version: '1',
    source: path.resolve(inputFile),
    timebase: '1000/1',
    chunks,
  };

  const tempV1Path = getTrackedTempPath('timeline', 'v1', 'trimbin_timelines');
  fs.writeFileSync(tempV1Path, JSON.stringify(v1Data, null, 2), 'utf8');

  return tempV1Path;
}

export async function runAutoEditorCommand(
  payload: string[] | RunCommandOptions,
  defaultOutputDir: string,
  callbacks: {
    onOutput: (text: string) => void;
    onProgress: (percent: number) => void;
  }
): Promise<{ success: boolean; message: string; output: string }> {
  const binaryInfo = await findAutoEditorBinaryAsync();
  if (!binaryInfo.available || !binaryInfo.path) {
    throw new Error(binaryInfo.error || 'auto-editor binary not found. Please install auto-editor v29+.');
  }

  let finalArgs: string[] = [];
  let executable = binaryInfo.path;
  let tempTimelineFile: string | null = null;

  // Strict binary whitelist security check
  const baseExec = path.basename(executable).toLowerCase();
  const configuredAutoEditor = loadEnginePaths().autoEditorPath;
  const isAllowedExec =
    baseExec === 'auto-editor' ||
    baseExec === 'auto-editor.exe' ||
    baseExec.startsWith('python') ||
    (configuredAutoEditor && path.resolve(executable) === path.resolve(configuredAutoEditor));

  if (!isAllowedExec) {
    throw new Error(`Security violation: unauthorized executable "${executable}".`);
  }

  if (Array.isArray(payload)) {
    for (const arg of payload) {
      if (typeof arg !== 'string' || /[\x00-\x1f\x7f]/.test(arg)) {
        throw new Error('Security violation: invalid character in argument.');
      }
    }
  }

  if (executable.includes(' -m auto_editor')) {
    const parts = executable.split(' ');
    executable = parts[0];
    finalArgs.push('-m', 'auto_editor');
  }

  let openWhenDone = false;
  let activeExportFormat = 'premiere';
  let destinationPath: string | undefined = undefined;

  if (Array.isArray(payload)) {
    let rawArgs = [...payload];
    if (rawArgs.length > 0 && (rawArgs[0] === 'auto_editor' || rawArgs[0] === 'auto-editor')) {
      rawArgs.shift();
    }
    const cutOutCount = rawArgs.filter((a) => a === '--cut-out').length;
    if (cutOutCount > 10) {
      let inputFileFromArgs: string | null = null;
      const extractedCuts: { start: number; end: number }[] = [];
      const nonCutArgs: string[] = [];

      for (let i = 0; i < rawArgs.length; i++) {
        if (rawArgs[i] === '--cut-out' && i + 1 < rawArgs.length) {
          const val = rawArgs[i + 1].replace(/s/g, '').trim();
          const [sStr, eStr] = val.split(',');
          const s = parseFloat(sStr);
          const e = parseFloat(eStr);
          if (!isNaN(s) && !isNaN(e)) {
            extractedCuts.push({ start: s, end: e });
          }
          i++;
        } else if (rawArgs[i] === '--edit' && i + 1 < rawArgs.length && rawArgs[i + 1] === 'none') {
          i++;
        } else if (!inputFileFromArgs && !rawArgs[i].startsWith('-') && fs.existsSync(rawArgs[i])) {
          inputFileFromArgs = rawArgs[i];
        } else {
          nonCutArgs.push(rawArgs[i]);
        }
      }

      if (inputFileFromArgs && extractedCuts.length > 0) {
        tempTimelineFile = await createV1TimelineFromCuts(inputFileFromArgs, extractedCuts);
        finalArgs.push(tempTimelineFile, ...nonCutArgs);
      } else {
        finalArgs.push(...rawArgs);
      }
    } else {
      finalArgs.push(...rawArgs);
    }
  } else {
    const {
      inputFile,
      exportFormat = 'premiere',
      loudness = -25,
      margin = 0.2,
      paddingLeft = margin,
      paddingRight = margin,
      isPaddingLinked = true,
      minSilenceDuration = 0,
      minClipDuration = 0,
      isAutoThreshold = false,
      outputFolder,
      outputFilePath,
      videoCodec,
      audioCodec,
      openWhenDone: userOpenWhenDone = false,
      customArgs = [],
      cutRanges = [],
      duration: payloadDuration,
    } = payload;

    let mappedExport = exportFormat;
    if (exportFormat === 'davinci' || exportFormat === 'davinci-xml' || exportFormat === 'resolve-xml') {
      mappedExport = 'premiere';
    } else if (exportFormat === 'davinci-fcpxml' || exportFormat === 'resolve-fcpxml' || exportFormat === 'resolve') {
      mappedExport = 'resolve';
    }

    openWhenDone = Boolean(userOpenWhenDone);
    activeExportFormat = exportFormat;

    if (!inputFile) {
      throw new Error('No input file provided.');
    }

    const hasCustomCuts = (cutRanges && cutRanges.length > 0) ||
      (customArgs && customArgs.some((a: string) => a === '--cut-out'));

    if (hasCustomCuts) {
      const extractedCuts: { start: number; end: number }[] = [];
      const nonCutArgs: string[] = [];

      if (cutRanges && cutRanges.length > 0) {
        extractedCuts.push(...cutRanges);
      }

      for (let i = 0; i < customArgs.length; i++) {
        if (customArgs[i] === '--cut-out' && i + 1 < customArgs.length) {
          if (!cutRanges || cutRanges.length === 0) {
            const val = customArgs[i + 1].replace(/s/g, '').trim();
            const [sStr, eStr] = val.split(',');
            const s = parseFloat(sStr);
            const e = parseFloat(eStr);
            if (!isNaN(s) && !isNaN(e)) {
              extractedCuts.push({ start: s, end: e });
            }
          }
          i++; // Skip cut-out value
        } else {
          nonCutArgs.push(customArgs[i]);
        }
      }

      if (extractedCuts.length > 0) {
        tempTimelineFile = await createV1TimelineFromCuts(inputFile, extractedCuts, payloadDuration);
        finalArgs.push(tempTimelineFile);
      } else {
        finalArgs.push(inputFile);
      }

      finalArgs.push('--export', mappedExport);

      if (videoCodec && videoCodec !== 'auto') {
        finalArgs.push('--video-codec', videoCodec);
      }
      if (audioCodec && audioCodec !== 'auto') {
        finalArgs.push('--audio-codec', audioCodec);
      }

      if (nonCutArgs.length > 0) {
        finalArgs.push(...nonCutArgs);
      }
    } else {
      finalArgs.push(inputFile);
      finalArgs.push('--export', mappedExport);

      if (isPaddingLinked || paddingLeft === paddingRight) {
        finalArgs.push('--margin', `${paddingLeft}s`);
      } else {
        finalArgs.push('--margin', `${paddingLeft}s,${paddingRight}s`);
      }
      if (isAutoThreshold) {
        finalArgs.push('--edit', 'audio');
      } else {
        finalArgs.push('--edit', `audio:threshold=${loudness}dB`);
      }

      if (videoCodec && videoCodec !== 'auto') {
        finalArgs.push('--video-codec', videoCodec);
      }
      if (audioCodec && audioCodec !== 'auto') {
        finalArgs.push('--audio-codec', audioCodec);
      }

      if (customArgs && Array.isArray(customArgs) && customArgs.length > 0) {
        finalArgs.push(...customArgs);
      }
    }

    if (!finalArgs.includes('--no-open')) {
      finalArgs.push('--no-open');
    }

    destinationPath = outputFilePath;
    if (!destinationPath) {
      const targetDir = outputFolder || defaultOutputDir;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const baseName = path.basename(inputFile, path.extname(inputFile));
      const ext = getExportExtension(exportFormat, inputFile);
      destinationPath = path.join(targetDir, `${baseName}_edited${ext}`);
    }

    finalArgs.push('-o', destinationPath);
  }

  const env = getAugmentedEnv();
  const displayCommand = `${binaryInfo.path} ${finalArgs.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
  callbacks.onOutput(`[START] ${displayCommand}\n`);
  callbacks.onProgress(0);

  const cleanupTempTimeline = () => {
    if (tempTimelineFile) {
      deleteTempFileSync(tempTimelineFile);
    }
  };

  return new Promise((resolve, reject) => {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const child = spawn(executable, finalArgs, { env, windowsHide: true });

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdoutBuffer += text;
      callbacks.onOutput(text);

      const match = text.match(/(\d{1,3}(?:\.\d+)?)%/);
      if (match && match[1]) {
        const percent = parseFloat(match[1]);
        if (!isNaN(percent)) {
          callbacks.onProgress(percent);
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrBuffer += text;
      callbacks.onOutput(text);
    });

    child.on('error', (err) => {
      cleanupTempTimeline();
      callbacks.onOutput(`\n[ERROR] Failed to start process: ${err.message}\n`);
      reject(err);
    });

    child.on('close', (code) => {
      cleanupTempTimeline();
      if (code === 0) {
        callbacks.onProgress(100);
        callbacks.onOutput(`\n[SUCCESS] Process completed successfully with code 0\n`);

        if (destinationPath && fs.existsSync(destinationPath)) {
          if (destinationPath.endsWith('.xml') || destinationPath.endsWith('.fcpxml')) {
            fixXmlForDaVinciAndPremiere(destinationPath);
          } else if (destinationPath.endsWith('.kdenlive')) {
            fixKdenliveProject(destinationPath);
          } else if (destinationPath.endsWith('.mlt')) {
            fixShotcutProject(destinationPath);
          }
        }

        if (openWhenDone && destinationPath && fs.existsSync(destinationPath)) {
          openTargetNLE(activeExportFormat, destinationPath);
        }

        resolve({
          success: true,
          message: 'Process completed successfully with code 0',
          output: stdoutBuffer,
        });
      } else {
        const fullOutput = `${stderrBuffer}\n${stdoutBuffer}`.trim();
        let userMessage = `Process exited with code ${code}`;
        if (fullOutput.includes('Could not open input file') || fullOutput.includes('Invalid')) {
          userMessage = `Impossibile aprire il file: il file selezionato risulta corrotto o incompleto. Seleziona il file video sorgente originale.`;
        }
        callbacks.onOutput(`\n[FAILED] ${userMessage}\n`);
        reject(new Error(userMessage));
      }
    });
  });
}

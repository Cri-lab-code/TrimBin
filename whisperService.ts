import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { findWhisperPythonBinaryAsync, getAugmentedEnv } from './binaryFinder';
import { getTrackedTempPath, deleteTempFile, registerTempFile } from './tempFileManager';

let appInstance: { getAppPath?: () => string } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron: any = require('electron');
  appInstance = electron?.app || electron?.default?.app || null;
} catch {}

export interface TranscribeProgressData {
  progress: number;
  status: string;
  step: 'extracting' | 'transcribing' | 'completed' | 'error';
}

export interface TranscribePayload {
  inputFile: string;
  model?: string;
  language?: string;
  duration?: number;
}

export interface WhisperTranscriptSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface WhisperTranscribeResult {
  success: boolean;
  segments?: WhisperTranscriptSegment[];
  text?: string;
  error?: string;
}

export async function transcribeAudioWithWhisper(
  payload: TranscribePayload,
  onProgress?: (data: TranscribeProgressData) => void
): Promise<WhisperTranscribeResult> {
  const { inputFile, model = 'base', language = 'auto' } = payload;
  if (!inputFile || !fs.existsSync(inputFile)) {
    throw new Error(`Media file not found: ${inputFile}`);
  }

  onProgress?.({
    progress: 10,
    status: 'Initializing Whisper AI engine...',
    step: 'extracting',
  });

  const pythonBin = await findWhisperPythonBinaryAsync();
  if (!pythonBin || (path.isAbsolute(pythonBin) && !fs.existsSync(pythonBin))) {
    throw new Error('Python 3 executable not found for Whisper AI. Run Auto-Setup in settings.');
  }

  const env = getAugmentedEnv();
  const resultJsonPath = getTrackedTempPath('transcript', 'json', 'trimbin_transcriptions');
  const tempTranscribeDir = path.dirname(resultJsonPath);
  const diskHelperPath = path.join(tempTranscribeDir, 'transcribe_helper.py');

  const possibleScriptPaths = [
    path.join(process.resourcesPath || '', 'transcribe_helper.py'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'transcribe_helper.py'),
    path.join(__dirname, 'transcribe_helper.py'),
    path.join(__dirname, '..', 'transcribe_helper.py'),
  ];
  try {
    if (appInstance && typeof appInstance.getAppPath === 'function') {
      possibleScriptPaths.push(path.join(appInstance.getAppPath(), 'transcribe_helper.py'));
    }
  } catch {}

  let helperPath = possibleScriptPaths.find((p) => fs.existsSync(p) && !p.includes('.asar'));

  if (!helperPath) {
    const asarCandidate = possibleScriptPaths.find((p) => fs.existsSync(p));
    if (asarCandidate) {
      try {
        fs.writeFileSync(diskHelperPath, fs.readFileSync(asarCandidate, 'utf-8'), 'utf-8');
        registerTempFile(diskHelperPath);
        helperPath = diskHelperPath;
      } catch (err) {
        console.warn('[whisperService] Could not extract transcribe_helper.py from bundle:', err);
      }
    }
  }

  if (!helperPath || !fs.existsSync(helperPath)) {
    const rootHelper = path.join(__dirname, '..', 'transcribe_helper.py');
    if (fs.existsSync(rootHelper)) {
      try {
        fs.writeFileSync(diskHelperPath, fs.readFileSync(rootHelper, 'utf-8'), 'utf-8');
        registerTempFile(diskHelperPath);
        helperPath = diskHelperPath;
      } catch {}
    }
  }

  if (!helperPath || !fs.existsSync(helperPath)) {
    throw new Error('transcribe_helper.py could not be located.');
  }

  const scriptPath = helperPath;

  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonBin,
      [scriptPath, '--input', inputFile, '--model', model, '--language', language, '--output', resultJsonPath],
      { env, windowsHide: true }
    );

    let jsonPayload: WhisperTranscribeResult | null = null;
    let stderrBuffer = '';

    child.stdout.on('data', (d: Buffer) => {
      const lines = d.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('PROGRESS:')) {
          const parts = trimmed.split(':');
          const pct = parseInt(parts[1], 10);
          const msg = parts.slice(2).join(':');
          if (!isNaN(pct)) {
            onProgress?.({
              progress: pct,
              status: msg,
              step: 'transcribing',
            });
          }
        } else if (trimmed.startsWith('RESULT_FILE:')) {
          const filePath = trimmed.replace('RESULT_FILE:', '').trim();
          if (fs.existsSync(filePath)) {
            try {
              jsonPayload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (e) {
              console.debug('[whisperService] Result file parse error:', e);
            }
          }
        }
      }
    });

    child.stderr.on('data', (d: Buffer) => {
      stderrBuffer += d.toString();
    });

    child.on('error', async (err: Error) => {
      await deleteTempFile(resultJsonPath);
      console.error('[whisperService] Whisper runtime error:', err);
      reject(err);
    });

    child.on('close', async (code: number | null) => {
      try {
        if (!jsonPayload && fs.existsSync(resultJsonPath)) {
          try {
            jsonPayload = JSON.parse(fs.readFileSync(resultJsonPath, 'utf-8'));
          } catch (e) {
            console.debug('[whisperService] Final read resultJsonPath error:', e);
          }
        }
      } finally {
        await deleteTempFile(resultJsonPath);
      }

      if (jsonPayload && jsonPayload.success) {
        onProgress?.({
          progress: 100,
          status: `Transcription completed (${jsonPayload.segments?.length || 0} segments)`,
          step: 'completed',
        });
        resolve(jsonPayload);
      } else if (jsonPayload && jsonPayload.error) {
        reject(new Error(jsonPayload.error));
      } else {
        const err = stderrBuffer.trim() || `Whisper process exited with code ${code}`;
        reject(new Error(err));
      }
    });
  });
}

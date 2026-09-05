import { spawn } from 'child_process';
import { loadEnginePaths, invalidateBinaryCaches } from './engineConfig';
import { getAugmentedEnv, runCommandQuick } from './envManager';
import { checkFFmpeg, findPythonBinaryAsync, checkAllDependencies } from './dependencyScanner';

export function runCommandWithProgress(
  cmd: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; cwd?: string },
  onProgress?: (chunk: string) => void
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const isWin = process.platform === 'win32';
    const child = spawn(cmd, args, {
      ...options,
      windowsHide: true,
      shell: isWin,
    });

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      onProgress?.(text);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      onProgress?.(text);
    });

    child.on('error', (err: Error) => {
      const errText = `\n[ERROR] Command "${cmd}" failed to start: ${err.message}\n`;
      stderr += errText;
      onProgress?.(errText);
      resolve({ code: -1, stdout, stderr });
    });

    child.on('close', (code: number | null) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

export async function isWingetAvailableAsync(env: NodeJS.ProcessEnv): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const res = await runCommandQuick('winget', ['--version'], { env });
  return res.success;
}

export async function isBrewAvailableAsync(env: NodeJS.ProcessEnv): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  const res = await runCommandQuick('brew', ['--version'], { env });
  return res.success;
}

export async function autoInstallDependencies(
  onProgress?: (chunk: string) => void
): Promise<{ success: boolean; error?: string }> {
  let env = getAugmentedEnv();
  const customPaths = loadEnginePaths();

  onProgress?.(`\n========================================\n`);
  onProgress?.(`[TRIMBIN AUTO-SETUP] Starting system dependency check & setup...\n`);
  onProgress?.(`========================================\n`);

  // PHASE 1: FFmpeg Engine
  let ffmpegItem = await checkFFmpeg(customPaths.ffmpegPath);
  if (ffmpegItem.available) {
    onProgress?.(`[STEP 1/3] FFmpeg Core: READY (found at ${ffmpegItem.path || 'system PATH'})\n`);
  } else {
    onProgress?.(`\n[STEP 1/3] FFmpeg is missing. Installing via system package manager...\n`);
    if (process.platform === 'win32') {
      if (await isWingetAvailableAsync(env)) {
        onProgress?.(`> Executing: winget install Gyan.FFmpeg --accept-package-agreements\n`);
        const res = await runCommandWithProgress(
          'winget',
          [
            'install',
            '--id',
            'Gyan.FFmpeg',
            '-e',
            '--accept-package-agreements',
            '--accept-source-agreements',
            '--disable-interactivity',
          ],
          { env },
          onProgress
        );
        if (res.code !== 0) {
          onProgress?.(`> Gyan.FFmpeg returned code ${res.code}. Trying yt-dlp.FFmpeg fallback...\n`);
          await runCommandWithProgress(
            'winget',
            [
              'install',
              '--id',
              'yt-dlp.FFmpeg',
              '-e',
              '--accept-package-agreements',
              '--accept-source-agreements',
              '--disable-interactivity',
            ],
            { env },
            onProgress
          );
        }
      } else {
        onProgress?.(`[WARN] 'winget' was not detected. Please install FFmpeg from https://ffmpeg.org\n`);
      }
    } else if (process.platform === 'darwin') {
      if (await isBrewAvailableAsync(env)) {
        onProgress?.(`> Executing: brew install ffmpeg\n`);
        await runCommandWithProgress('brew', ['install', 'ffmpeg'], { env }, onProgress);
      } else {
        onProgress?.(`[WARN] Homebrew not detected. Please install FFmpeg via 'brew install ffmpeg'\n`);
      }
    }

    env = getAugmentedEnv();
    ffmpegItem = await checkFFmpeg(customPaths.ffmpegPath);
    if (ffmpegItem.available) {
      onProgress?.(`[OK] FFmpeg verified: ${ffmpegItem.path}\n`);
    } else {
      onProgress?.(`[INFO] If FFmpeg was just installed, its path will activate on next launch.\n`);
    }
  }

  // PHASE 2: Python 3 Runtime
  let pythonCmd = await findPythonBinaryAsync();
  if (pythonCmd) {
    onProgress?.(`[STEP 2/3] Python 3 Runtime: READY (found at ${pythonCmd})\n`);
  } else {
    onProgress?.(`\n[STEP 2/3] Python 3 is missing. Installing via system package manager...\n`);
    if (process.platform === 'win32') {
      if (await isWingetAvailableAsync(env)) {
        onProgress?.(`> Executing: winget install Python.Python.3.11 --scope user\n`);
        const pyRes = await runCommandWithProgress(
          'winget',
          [
            'install',
            '--id',
            'Python.Python.3.11',
            '-e',
            '--scope',
            'user',
            '--accept-package-agreements',
            '--accept-source-agreements',
            '--disable-interactivity',
          ],
          { env },
          onProgress
        );
        if (pyRes.code !== 0) {
          onProgress?.(`> User scope returned code ${pyRes.code}. Retrying default scope...\n`);
          await runCommandWithProgress(
            'winget',
            [
              'install',
              '--id',
              'Python.Python.3.11',
              '-e',
              '--accept-package-agreements',
              '--accept-source-agreements',
              '--disable-interactivity',
            ],
            { env },
            onProgress
          );
        }
      } else {
        onProgress?.(
          `[ERROR] 'winget' not detected. Please install Python 3.11 from https://www.python.org/downloads/\n`
        );
      }
    } else if (process.platform === 'darwin') {
      if (await isBrewAvailableAsync(env)) {
        onProgress?.(`> Executing: brew install python@3.11\n`);
        await runCommandWithProgress('brew', ['install', 'python@3.11'], { env }, onProgress);
      }
    }

    env = getAugmentedEnv();
    pythonCmd = await findPythonBinaryAsync();
    if (pythonCmd) {
      onProgress?.(`[OK] Python 3 verified: ${pythonCmd}\n`);
    } else {
      return {
        success: false,
        error:
          'Python 3 installation could not be completed automatically. Please install Python from https://www.python.org/downloads/ and try Auto-Setup again.',
      };
    }
  }

  // PHASE 3: Python ML & Editorial Packages
  onProgress?.(`\n[STEP 3/3] Installing Auto-Editor, OpenAI Whisper & Neural ML packages...\n`);
  onProgress?.(`> Target Python: ${pythonCmd}\n`);
  onProgress?.(`> Running: pip install --user --upgrade auto-editor openai-whisper numpy\n\n`);

  const pipRes = await runCommandWithProgress(
    pythonCmd,
    ['-m', 'pip', 'install', '--user', '--upgrade', 'auto-editor', 'openai-whisper', 'numpy'],
    { env },
    onProgress
  );

  if (pipRes.code !== 0) {
    onProgress?.(`\n[WARN] User install returned code ${pipRes.code}. Retrying without --user...\n`);
    const fallbackRes = await runCommandWithProgress(
      pythonCmd,
      ['-m', 'pip', 'install', '--upgrade', 'auto-editor', 'openai-whisper', 'numpy'],
      { env },
      onProgress
    );

    if (fallbackRes.code !== 0) {
      return {
        success: false,
        error: `Python pip package installation failed (code ${fallbackRes.code}). Please review log details.`,
      };
    }
  }

  // Invalidate in-memory caches and re-verify all dependencies
  invalidateBinaryCaches();
  const finalStatus = await checkAllDependencies(true);

  onProgress?.(`\n========================================\n`);
  onProgress?.(`[COMPLETED] TrimBin environment setup finished successfully!\n`);
  onProgress?.(`- FFmpeg: ${finalStatus.ffmpeg.available ? 'READY' : 'Pending'}\n`);
  onProgress?.(`- Auto-Editor: ${finalStatus.autoEditor.available ? 'READY' : 'Pending'}\n`);
  onProgress?.(`- Whisper AI: ${finalStatus.whisper.available ? 'READY' : 'Pending'}\n`);
  onProgress?.(`========================================\n`);

  return { success: true };
}

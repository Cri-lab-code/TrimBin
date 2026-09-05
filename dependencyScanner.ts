import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadEnginePaths,
  cacheStore,
  DependencyItem,
  DependencyStatus,
  AutoEditorInfo,
} from './engineConfig';
import {
  getAugmentedEnv,
  isExecutable,
  sortPythonDirsDescending,
  runCommandQuick,
} from './envManager';

export async function findAutoEditorBinaryAsync(forceRefresh = false): Promise<AutoEditorInfo> {
  if (cacheStore.autoEditorInfo && !forceRefresh) {
    return cacheStore.autoEditorInfo;
  }

  const customPaths = loadEnginePaths();
  const homedir = os.homedir();
  const platform = process.platform;
  const candidates: string[] = [];

  if (customPaths.autoEditorPath && isExecutable(customPaths.autoEditorPath)) {
    candidates.push(customPaths.autoEditorPath);
  }

  const env = getAugmentedEnv();
  const whichRes = await runCommandQuick(platform === 'win32' ? 'where' : 'which', ['auto-editor'], { env });
  if (whichRes.success && whichRes.stdout) {
    const firstLine = whichRes.stdout.split(/\r?\n/)[0].trim();
    if (firstLine && isExecutable(firstLine)) {
      candidates.push(firstLine);
    }
  }

  if (platform === 'darwin') {
    const macPythonDir = path.join(homedir, 'Library', 'Python');
    if (fs.existsSync(macPythonDir)) {
      try {
        for (const ver of fs.readdirSync(macPythonDir)) {
          const binPath = path.join(macPythonDir, ver, 'bin', 'auto-editor');
          if (isExecutable(binPath)) candidates.push(binPath);
        }
      } catch (e) {
        console.debug('[dependencyScanner] Mac python scan error:', e);
      }
    }
    candidates.push(
      '/opt/homebrew/bin/auto-editor',
      '/usr/local/bin/auto-editor',
      path.join(homedir, '.local/bin/auto-editor'),
      '/usr/bin/auto-editor'
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const localPrograms = path.join(localAppData, 'Programs', 'Python');
    if (fs.existsSync(localPrograms)) {
      try {
        for (const pyDir of fs.readdirSync(localPrograms)) {
          const exePath = path.join(localPrograms, pyDir, 'Scripts', 'auto-editor.exe');
          if (isExecutable(exePath)) candidates.push(exePath);
        }
      } catch (e) {
        console.debug('[dependencyScanner] Win python scan error:', e);
      }
    }
  } else {
    candidates.push(
      path.join(homedir, '.local/bin/auto-editor'),
      path.join(homedir, '.config/trimbin/env/bin/auto-editor'),
      '/usr/local/bin/auto-editor',
      '/usr/bin/auto-editor',
      '/snap/bin/auto-editor'
    );
  }

  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      const verRes = await runCommandQuick(candidate, ['--version'], { env });
      if (verRes.success && verRes.stdout) {
        const rawVer = verRes.stdout.replace(/^auto-editor\s*(?:version\s*)?/i, '').trim();
        const semverMatch = rawVer.match(/(\d+\.\d+(?:\.\d+)?)/);
        cacheStore.autoEditorInfo = {
          available: true,
          path: candidate,
          version: semverMatch ? semverMatch[1] : rawVer,
        };
        return cacheStore.autoEditorInfo;
      }
    }
  }

  const pythonCmds = platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
  for (const py of pythonCmds) {
    const pyVerRes = await runCommandQuick(py, ['-m', 'auto_editor', '--version'], { env });
    if (pyVerRes.success && pyVerRes.stdout) {
      const rawVer = pyVerRes.stdout.replace(/^auto-editor\s*(?:version\s*)?/i, '').trim();
      const semverMatch = rawVer.match(/(\d+\.\d+(?:\.\d+)?)/);
      cacheStore.autoEditorInfo = {
        available: true,
        path: `${py} -m auto_editor`,
        version: semverMatch ? semverMatch[1] : rawVer,
      };
      return cacheStore.autoEditorInfo;
    }
  }

  cacheStore.autoEditorInfo = {
    available: false,
    error: 'auto-editor >= 31.5.0 executable not found. Please install it using `pip install "auto-editor>=31.5.0"` or click Auto-Setup.',
  };
  return cacheStore.autoEditorInfo;
}

export function findAutoEditorBinary(forceRefresh = false): AutoEditorInfo {
  if (cacheStore.autoEditorInfo && !forceRefresh) {
    return cacheStore.autoEditorInfo;
  }
  const custom = loadEnginePaths();
  if (custom.autoEditorPath && isExecutable(custom.autoEditorPath)) {
    return { available: true, path: custom.autoEditorPath, version: 'Configured' };
  }
  findAutoEditorBinaryAsync(forceRefresh).catch((err) => {
    console.debug('[dependencyScanner] Async findAutoEditorBinary notice:', err);
  });
  return (
    cacheStore.autoEditorInfo || {
      available: false,
      error: 'Checking auto-editor binary...',
    }
  );
}

export async function checkWhisper(customPath?: string): Promise<DependencyItem> {
  const env = getAugmentedEnv();
  const platform = process.platform;
  const homedir = os.homedir();

  if (customPath && isExecutable(customPath)) {
    const verRes = await runCommandQuick(customPath, ['--version'], { env });
    return {
      name: 'whisper',
      displayName: 'Whisper AI',
      available: true,
      path: customPath,
      version: verRes.stdout || 'Custom Whisper Engine',
      required: true,
      description: 'Neural speech-to-text engine for timeline transcription and text cuts.',
    };
  }

  const whichRes = await runCommandQuick(platform === 'win32' ? 'where' : 'which', ['whisper'], { env });
  if (whichRes.success && whichRes.stdout) {
    const first = whichRes.stdout.split(/\r?\n/)[0].trim();
    if (first && isExecutable(first)) {
      return {
        name: 'whisper',
        displayName: 'Whisper AI',
        available: true,
        path: first,
        version: 'OpenAI Whisper CLI',
        required: true,
        description: 'Neural speech-to-text engine for timeline transcription and text cuts.',
      };
    }
  }

  const whisperPy = await findWhisperPythonBinaryAsync();
  if (whisperPy) {
    const pyVerRes = await runCommandQuick(
      whisperPy,
      ['-c', "import whisper; print(getattr(whisper, '__version__', 'Installed'))"],
      { env }
    );
    if (pyVerRes.success && pyVerRes.stdout) {
      const out = pyVerRes.stdout;
      return {
        name: 'whisper',
        displayName: 'Whisper AI',
        available: true,
        path: whisperPy,
        version: `OpenAI Whisper (${out})`,
        required: true,
        description: 'Neural speech-to-text engine for timeline transcription and text cuts.',
      };
    }
  }

  return {
    name: 'whisper',
    displayName: 'Whisper AI',
    available: false,
    required: true,
    description: 'Neural speech-to-text engine for timeline transcription and text cuts.',
    error: 'OpenAI Whisper library or CLI not detected in Python environment.',
  };
}

export async function checkFFmpeg(customPath?: string): Promise<DependencyItem> {
  const env = getAugmentedEnv();
  const platform = process.platform;
  const homedir = os.homedir();

  const candidates: string[] = [];
  if (customPath && isExecutable(customPath)) {
    candidates.push(customPath);
  }

  const whichRes = await runCommandQuick(platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { env });
  if (whichRes.success && whichRes.stdout) {
    const first = whichRes.stdout.split(/\r?\n/)[0].trim();
    if (first && isExecutable(first)) candidates.push(first);
  }

  if (platform === 'darwin') {
    candidates.push(
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      path.join(homedir, '.local/bin/ffmpeg'),
      '/usr/bin/ffmpeg'
    );
  } else if (platform === 'win32') {
    candidates.push(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe'
    );
  } else {
    candidates.push(
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/snap/bin/ffmpeg'
    );
  }

  for (const cand of candidates) {
    if (isExecutable(cand)) {
      const verRes = await runCommandQuick(cand, ['-version'], { env });
      if (verRes.success && verRes.stdout) {
        const match = verRes.stdout.match(/ffmpeg\s+version\s+([^\s]+)/i);
        return {
          name: 'ffmpeg',
          displayName: 'FFmpeg Core',
          available: true,
          path: cand,
          version: match ? match[1] : 'FFmpeg Installed',
          required: true,
          description: 'Core audio/video demuxing and volume analysis backend.',
        };
      }
    }
  }

  return {
    name: 'ffmpeg',
    displayName: 'FFmpeg Core',
    available: false,
    required: true,
    description: 'Core audio/video demuxing and volume analysis backend.',
    error: 'FFmpeg executable not found. Please install FFmpeg on your system.',
  };
}

export async function checkAllDependencies(forceRefresh = false): Promise<DependencyStatus> {
  const customPaths = loadEnginePaths();

  // Run all dependency verifications in parallel asynchronously
  const [autoEditor, whisper, ffmpeg] = await Promise.all([
    findAutoEditorBinaryAsync(forceRefresh),
    checkWhisper(customPaths.whisperPath),
    checkFFmpeg(customPaths.ffmpegPath),
  ]);

  const autoEditorItem: DependencyItem = {
    name: 'auto-editor',
    displayName: 'Auto-Editor Engine',
    available: autoEditor.available,
    path: autoEditor.path,
    version: autoEditor.version,
    required: true,
    description: 'Core audio-energy cut analysis and timeline export engine.',
    error: autoEditor.error,
  };

  cacheStore.lastChecked = Date.now();

  return {
    autoEditor: autoEditorItem,
    whisper,
    ffmpeg,
    allReady: autoEditorItem.available && whisper.available && ffmpeg.available,
    customPaths,
  };
}

export async function findPythonBinaryAsync(): Promise<string | null> {
  if (cacheStore.pythonBinary) {
    return cacheStore.pythonBinary;
  }

  const env = getAugmentedEnv();
  const homedir = os.homedir();
  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const localPrograms = path.join(localAppData, 'Programs', 'Python');
    if (fs.existsSync(localPrograms)) {
      try {
        const entries = sortPythonDirsDescending(fs.readdirSync(localPrograms));
        for (const pyDir of entries) {
          const exePath = path.join(localPrograms, pyDir, 'python.exe');
          if (isExecutable(exePath)) candidates.push(path.resolve(exePath));
        }
      } catch (e) {
        console.debug('[dependencyScanner] Error reading win python dirs:', e);
      }
    }

    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    if (fs.existsSync(programFiles)) {
      try {
        const entries = sortPythonDirsDescending(
          fs.readdirSync(programFiles).filter((e) => e.toLowerCase().startsWith('python3'))
        );
        for (const dir of entries) {
          const exePath = path.join(programFiles, dir, 'python.exe');
          if (isExecutable(exePath)) candidates.push(path.resolve(exePath));
        }
      } catch (e) {
        console.debug('[dependencyScanner] Error reading progfiles python:', e);
      }
    }

    const whereRes = await runCommandQuick('where', ['python'], { env });
    if (whereRes.success && whereRes.stdout) {
      for (const line of whereRes.stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.toLowerCase().includes('windowsapps') && isExecutable(trimmed)) {
          candidates.push(path.resolve(trimmed));
        }
      }
    }

    const pyRes = await runCommandQuick('py', ['-c', 'import sys; print(sys.executable)'], { env });
    if (pyRes.success && pyRes.stdout && !pyRes.stdout.toLowerCase().includes('windowsapps')) {
      if (isExecutable(pyRes.stdout)) {
        candidates.push(path.resolve(pyRes.stdout));
      }
    }
  } else {
    candidates.push(
      path.join(homedir, '.config', 'trimbin', 'env', 'bin', 'python3'),
      '/opt/homebrew/bin/python3',
      '/usr/local/bin/python3',
      '/usr/bin/python3',
      path.join(homedir, '.local', 'bin', 'python3')
    );

    const macPythonDir = path.join(homedir, 'Library', 'Python');
    if (fs.existsSync(macPythonDir)) {
      try {
        const entries = sortPythonDirsDescending(fs.readdirSync(macPythonDir));
        for (const ver of entries) {
          const p = path.join(macPythonDir, ver, 'bin', 'python3');
          if (isExecutable(p)) candidates.push(path.resolve(p));
        }
      } catch (e) {
        console.debug('[dependencyScanner] Mac python scan error:', e);
      }
    }

    const whichPy3 = await runCommandQuick('which', ['python3'], { env });
    if (whichPy3.success && whichPy3.stdout && isExecutable(whichPy3.stdout)) {
      candidates.push(path.resolve(whichPy3.stdout));
    }
  }

  const uniqueCandidates = Array.from(new Set(candidates));
  for (const py of uniqueCandidates) {
    const testRes = await runCommandQuick(py, ['-c', 'import sys; print(sys.version_info[0])'], { env });
    if (testRes.success && testRes.stdout === '3') {
      cacheStore.pythonBinary = py;
      return py;
    }
  }

  return null;
}

export function findPythonBinary(): string | null {
  if (cacheStore.pythonBinary) return cacheStore.pythonBinary;
  findPythonBinaryAsync().catch(() => {});
  return null;
}

export async function findWhisperPythonBinaryAsync(forceRefresh = false): Promise<string | null> {
  if (cacheStore.whisperPython && !forceRefresh) {
    return cacheStore.whisperPython;
  }

  const customPaths = loadEnginePaths();
  const env = getAugmentedEnv();
  const platform = process.platform;
  const homedir = os.homedir();

  // 1. Custom configured path
  if (customPaths.whisperPath && isExecutable(customPaths.whisperPath)) {
    const testRes = await runCommandQuick(customPaths.whisperPath, ['-c', 'import whisper'], { env });
    if (testRes.success) {
      cacheStore.whisperPython = path.resolve(customPaths.whisperPath);
      return cacheStore.whisperPython;
    }
  }

  const candidates: string[] = [];

  // 2. Discover Python interpreter associated with installed whisper CLI
  if (platform === 'win32') {
    const whereW = await runCommandQuick('where', ['whisper'], { env });
    if (whereW.success && whereW.stdout) {
      for (const line of whereW.stdout.split(/\r?\n/)) {
        const wExe = line.trim();
        if (wExe && isExecutable(wExe)) {
          const parentPy = path.resolve(path.dirname(wExe), '..', 'python.exe');
          if (isExecutable(parentPy)) candidates.push(parentPy);
        }
      }
    }

    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const localPrograms = path.join(localAppData, 'Programs', 'Python');
    if (fs.existsSync(localPrograms)) {
      try {
        const entries = sortPythonDirsDescending(fs.readdirSync(localPrograms));
        for (const pyDir of entries) {
          const exePath = path.join(localPrograms, pyDir, 'python.exe');
          if (isExecutable(exePath)) candidates.push(path.resolve(exePath));
        }
      } catch (e) {
        console.debug('[dependencyScanner] Error reading win local python:', e);
      }
    }

    const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
    if (fs.existsSync(progFiles)) {
      try {
        const entries = sortPythonDirsDescending(
          fs.readdirSync(progFiles).filter((e) => e.toLowerCase().startsWith('python3'))
        );
        for (const dir of entries) {
          const exePath = path.join(progFiles, dir, 'python.exe');
          if (isExecutable(exePath)) candidates.push(path.resolve(exePath));
        }
      } catch (e) {
        console.debug('[dependencyScanner] Error reading progfiles python:', e);
      }
    }

    const pyW = await runCommandQuick('py', ['-c', 'import whisper; import sys; print(sys.executable)'], { env });
    if (pyW.success && pyW.stdout && !pyW.stdout.toLowerCase().includes('windowsapps')) {
      if (isExecutable(pyW.stdout)) candidates.push(path.resolve(pyW.stdout));
    }
  } else {
    const whichW = await runCommandQuick('which', ['whisper'], { env });
    if (whichW.success && whichW.stdout && isExecutable(whichW.stdout)) {
      const parentPy = path.resolve(path.dirname(whichW.stdout), 'python3');
      if (isExecutable(parentPy)) candidates.push(parentPy);
    }

    candidates.push(
      path.join(homedir, '.config', 'trimbin', 'env', 'bin', 'python3'),
      '/opt/homebrew/bin/python3',
      '/usr/local/bin/python3',
      '/usr/bin/python3',
      path.join(homedir, '.local', 'bin', 'python3')
    );

    const macPythonDir = path.join(homedir, 'Library', 'Python');
    if (fs.existsSync(macPythonDir)) {
      try {
        const entries = fs.readdirSync(macPythonDir).sort().reverse();
        for (const ver of entries) {
          const p = path.join(macPythonDir, ver, 'bin', 'python3');
          if (isExecutable(p)) candidates.push(path.resolve(p));
        }
      } catch (e) {
        console.debug('[dependencyScanner] Mac python scan error:', e);
      }
    }
  }

  const generalPy = await findPythonBinaryAsync();
  if (generalPy) candidates.push(generalPy);

  const uniqueCandidates = Array.from(new Set(candidates));
  for (const py of uniqueCandidates) {
    const testRes = await runCommandQuick(py, ['-c', 'import whisper'], { env });
    if (testRes.success) {
      cacheStore.whisperPython = py;
      return py;
    }
  }

  cacheStore.whisperPython = generalPy;
  return generalPy;
}

export function findWhisperPythonBinary(): string | null {
  if (cacheStore.whisperPython) return cacheStore.whisperPython;
  findWhisperPythonBinaryAsync().catch(() => {});
  return null;
}

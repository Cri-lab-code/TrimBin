import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import type { App } from 'electron';

let electronApp: App | null = null;
try {
  const electron = require('electron');
  electronApp = (electron && electron.app) || null;
} catch {}


export interface EnginePaths {
  autoEditorPath?: string;
  whisperPath?: string;
  ffmpegPath?: string;
}

export interface DependencyItem {
  name: 'auto-editor' | 'whisper' | 'ffmpeg';
  displayName: string;
  available: boolean;
  path?: string;
  version?: string;
  required: boolean;
  description: string;
  error?: string;
}

export interface DependencyStatus {
  autoEditor: DependencyItem;
  whisper: DependencyItem;
  ffmpeg: DependencyItem;
  allReady: boolean;
  customPaths: EnginePaths;
}

export interface AutoEditorInfo {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}

function getConfigPath(): string {
  try {
    let userData = '';
    if (electronApp && typeof electronApp.getPath === 'function') {
      userData = electronApp.getPath('userData');
    } else {
      userData = path.join(os.homedir(), '.trimbin');
    }
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return path.join(userData, 'engine_config.json');
  } catch {
    return path.join(os.homedir(), '.trimbin_engine_config.json');
  }
}

export function loadEnginePaths(): EnginePaths {
  try {
    const cfgPath = getConfigPath();
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
  } catch (err) {
    console.warn('Failed to load engine config:', err);
  }
  return {};
}

export function saveEnginePaths(paths: EnginePaths): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(paths, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save engine config:', err);
  }
}

export function isExecutable(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (process.platform !== 'win32') {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

export function getAugmentedEnv(): NodeJS.ProcessEnv {
  const homedir = os.homedir();
  const platform = process.platform;
  const delimiter = platform === 'win32' ? ';' : ':';

  const extraPaths: string[] = [
    process.env.PATH || '',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    '/snap/bin',
    path.join(homedir, '.local', 'bin'),
    path.join(homedir, '.config', 'trimbin', 'env', 'bin'),
    path.join(homedir, 'Library', 'Python', '3.10', 'bin'),
    path.join(homedir, 'Library', 'Python', '3.11', 'bin'),
    path.join(homedir, 'Library', 'Python', '3.12', 'bin'),
    path.join(homedir, 'Library', 'Python', '3.13', 'bin'),
  ];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');

    // Dynamically detect all Python versions in LocalAppData\Programs\Python
    const localPythonDir = path.join(localAppData, 'Programs', 'Python');
    if (fs.existsSync(localPythonDir)) {
      try {
        for (const pyVer of fs.readdirSync(localPythonDir)) {
          extraPaths.push(
            path.join(localPythonDir, pyVer),
            path.join(localPythonDir, pyVer, 'Scripts')
          );
        }
      } catch {}
    }

    // WinGet package links and packages
    extraPaths.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links'));
    const winGetPackagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(winGetPackagesDir)) {
      try {
        for (const pkg of fs.readdirSync(winGetPackagesDir)) {
          const pkgDir = path.join(winGetPackagesDir, pkg);
          extraPaths.push(pkgDir);
          // Check for subdirectories or bin
          try {
            for (const sub of fs.readdirSync(pkgDir)) {
              const subPath = path.join(pkgDir, sub);
              if (fs.statSync(subPath).isDirectory()) {
                extraPaths.push(subPath);
                if (fs.existsSync(path.join(subPath, 'bin'))) {
                  extraPaths.push(path.join(subPath, 'bin'));
                }
              }
            }
          } catch {}
        }
      } catch {}
    }

    extraPaths.push(
      'C:\\ffmpeg\\bin',
      'C:\\Program Files\\ffmpeg\\bin',
      'C:\\ProgramData\\chocolatey\\bin',
      'C:\\tools\\ffmpeg\\bin'
    );
  }

  return {
    ...process.env,
    PATH: extraPaths.filter(Boolean).join(delimiter),
  };
}

let cachedInfo: AutoEditorInfo | null = null;

export function findAutoEditorBinary(forceRefresh = false): AutoEditorInfo {
  if (cachedInfo && !forceRefresh) {
    return cachedInfo;
  }

  const customPaths = loadEnginePaths();
  const homedir = os.homedir();
  const platform = process.platform;
  const candidates: string[] = [];

  if (customPaths.autoEditorPath && isExecutable(customPaths.autoEditorPath)) {
    candidates.push(customPaths.autoEditorPath);
  }

  const env = getAugmentedEnv();
  try {
    const whichCmd = platform === 'win32' ? 'where auto-editor' : 'which auto-editor';
    const whichOutput = execSync(whichCmd, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (whichOutput) {
      const firstLine = whichOutput.split(/\r?\n/)[0].trim();
      if (firstLine && isExecutable(firstLine)) {
        candidates.push(firstLine);
      }
    }
  } catch {}

  if (platform === 'darwin') {
    const macPythonDir = path.join(homedir, 'Library', 'Python');
    if (fs.existsSync(macPythonDir)) {
      try {
        for (const ver of fs.readdirSync(macPythonDir)) {
          const binPath = path.join(macPythonDir, ver, 'bin', 'auto-editor');
          if (isExecutable(binPath)) candidates.push(binPath);
        }
      } catch {}
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
      } catch {}
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
      try {
        const versionOutput = execSync(`"${candidate}" --version`, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (versionOutput) {
          const rawVer = versionOutput.replace(/^auto-editor\s*(?:version\s*)?/i, '').trim();
          const semverMatch = rawVer.match(/(\d+\.\d+(?:\.\d+)?)/);
          cachedInfo = {
            available: true,
            path: candidate,
            version: semverMatch ? semverMatch[1] : rawVer,
          };
          return cachedInfo;
        }
      } catch {}
    }
  }

  const pythonCmds = platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
  for (const py of pythonCmds) {
    try {
      const versionOutput = execSync(`${py} -m auto_editor --version`, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (versionOutput) {
        const rawVer = versionOutput.replace(/^auto-editor\s*(?:version\s*)?/i, '').trim();
        const semverMatch = rawVer.match(/(\d+\.\d+(?:\.\d+)?)/);
        cachedInfo = {
          available: true,
          path: `${py} -m auto_editor`,
          version: semverMatch ? semverMatch[1] : rawVer,
        };
        return cachedInfo;
      }
    } catch {}
  }

  cachedInfo = {
    available: false,
    error: 'auto-editor >= 31.5.0 executable not found. Please install it using `pip install "auto-editor>=31.5.0"` or click Auto-Setup.',
  };
  return cachedInfo;
}

export async function checkWhisper(customPath?: string): Promise<DependencyItem> {
  const env = getAugmentedEnv();
  const platform = process.platform;
  const homedir = os.homedir();

  if (customPath && isExecutable(customPath)) {
    try {
      const ver = execSync(`"${customPath}" --version`, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      return {
        name: 'whisper',
        displayName: 'Whisper AI',
        available: true,
        path: customPath,
        version: ver || 'Custom Whisper Engine',
        required: true,
        description: 'Neural speech-to-text engine for timeline transcription and text cuts.',
      };
    } catch {}
  }

  try {
    const whichCmd = platform === 'win32' ? 'where whisper' : 'which whisper';
    const out = execSync(whichCmd, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (out) {
      const first = out.split(/\r?\n/)[0].trim();
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
  } catch {}

  const extraWhispers = [
    path.join(homedir, '.local/bin/whisper'),
    path.join(homedir, '.config/trimbin/env/bin/whisper'),
    '/usr/local/bin/whisper',
    '/usr/bin/whisper',
  ];
  for (const w of extraWhispers) {
    if (isExecutable(w)) {
      try {
        const ver = execSync(`"${w}" --version`, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        return {
          name: 'whisper',
          displayName: 'Whisper AI',
          available: true,
          path: w,
          version: ver || 'OpenAI Whisper CLI',
          required: true,
          description: 'Neural speech-to-text engine for timeline transcription and text cuts.',
        };
      } catch {}
    }
  }

  const pyCandidates = platform === 'win32'
    ? ['py', 'python', 'python3']
    : [
        path.join(homedir, '.config/trimbin/env/bin/python3'),
        '/opt/homebrew/bin/python3',
        '/usr/local/bin/python3',
        '/usr/bin/python3',
        'python3',
        'python',
      ];

  for (const py of pyCandidates) {
    try {
      const out = execSync(`${py} -c "import whisper; print(getattr(whisper, '__version__', 'Installed'))"`, {
        env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      if (out) {
        return {
          name: 'whisper',
          displayName: 'Whisper AI',
          available: true,
          path: py,
          version: `OpenAI Whisper (${out})`,
          required: true,
          description: 'Neural speech-to-text engine for timeline transcription and text cuts.',
        };
      }
    } catch {}
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

  try {
    const whichCmd = platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
    const whichOut = execSync(whichCmd, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (whichOut) {
      const first = whichOut.split(/\r?\n/)[0].trim();
      if (first && isExecutable(first)) candidates.push(first);
    }
  } catch {}

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
      try {
        const out = execSync(`"${cand}" -version`, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (out) {
          const match = out.match(/ffmpeg\s+version\s+([^\s]+)/i);
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
      } catch {}
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
  const autoEditor = findAutoEditorBinary(forceRefresh);
  const whisper = await checkWhisper(customPaths.whisperPath);
  const ffmpeg = await checkFFmpeg(customPaths.ffmpegPath);

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

  return {
    autoEditor: autoEditorItem,
    whisper,
    ffmpeg,
    allReady: autoEditorItem.available && whisper.available && ffmpeg.available,
    customPaths,
  };
}

export function findPythonBinary(): string | null {
  const env = getAugmentedEnv();
  const homedir = os.homedir();
  const platform = process.platform;

  const candidates: string[] = [];

  if (platform === 'win32') {
    candidates.push('py', 'python', 'python3');
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const localPrograms = path.join(localAppData, 'Programs', 'Python');
    if (fs.existsSync(localPrograms)) {
      try {
        for (const pyDir of fs.readdirSync(localPrograms)) {
          const exePath = path.join(localPrograms, pyDir, 'python.exe');
          if (isExecutable(exePath)) candidates.push(exePath);
        }
      } catch {}
    }

    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    if (fs.existsSync(programFiles)) {
      try {
        for (const dir of fs.readdirSync(programFiles)) {
          if (dir.toLowerCase().startsWith('python3')) {
            const exePath = path.join(programFiles, dir, 'python.exe');
            if (isExecutable(exePath)) candidates.push(exePath);
          }
        }
      } catch {}
    }

    const winApps = path.join(localAppData, 'Microsoft', 'WindowsApps', 'python.exe');
    if (isExecutable(winApps)) candidates.push(winApps);
  } else {
    candidates.push(
      path.join(homedir, '.config/trimbin/env/bin/python3'),
      '/opt/homebrew/bin/python3',
      '/usr/local/bin/python3',
      '/usr/bin/python3',
      'python3',
      'python'
    );
  }

  for (const py of candidates) {
    try {
      const cmd = py.includes(' ') || py.includes('\\') ? `"${py}" --version` : `${py} --version`;
      const out = execSync(cmd, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (out.includes('Python 3')) {
        return py;
      }
    } catch {}
  }
  return null;
}

export function findWhisperPythonBinary(): string | null {
  const customPaths = loadEnginePaths();
  const env = getAugmentedEnv();
  const platform = process.platform;
  const homedir = os.homedir();

  if (customPaths.whisperPath && isExecutable(customPaths.whisperPath)) {
    try {
      execSync(`"${customPaths.whisperPath}" -c "import whisper"`, { env, stdio: ['pipe', 'pipe', 'ignore'] });
      return customPaths.whisperPath;
    } catch {}
  }

  const pyCandidates = platform === 'win32'
    ? ['py', 'python', 'python3']
    : [
        path.join(homedir, '.config/trimbin/env/bin/python3'),
        '/opt/homebrew/bin/python3',
        '/usr/local/bin/python3',
        '/usr/bin/python3',
        'python3',
        'python',
      ];

  for (const py of pyCandidates) {
    try {
      execSync(`${py} -c "import whisper"`, {
        env,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return py;
    } catch {}
  }

  return findPythonBinary();
}

export async function autoInstallDependencies(onProgress?: (chunk: string) => void): Promise<{ success: boolean; error?: string }> {
  const pythonCmd = findPythonBinary();
  if (!pythonCmd) {
    return {
      success: false,
      error: 'Python 3 is required but was not found on your system. Please install Python 3.',
    };
  }

  return new Promise((resolve) => {
    const env = getAugmentedEnv();
    const pyExe = pythonCmd;

    const child = spawn(
      pyExe,
      ['-m', 'pip', 'install', '--user', '--upgrade', 'auto-editor', 'openai-whisper', 'numpy'],
      { env }
    );

    child.stdout.on('data', (data) => {
      onProgress?.(data.toString());
    });

    child.stderr.on('data', (data) => {
      onProgress?.(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        findAutoEditorBinary(true);
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: `Installation failed with exit code ${code}. Check logs for details.`,
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
      });
    });
  });
}

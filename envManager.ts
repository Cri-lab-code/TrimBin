import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function sortPythonDirsDescending(dirs: string[]): string[] {
  return [...dirs].sort((a, b) => {
    const matchA = a.match(/\d+/);
    const matchB = b.match(/\d+/);
    const numA = matchA ? parseInt(matchA[0], 10) : 0;
    const numB = matchB ? parseInt(matchB[0], 10) : 0;
    return numB - numA;
  });
}

export function isExecutable(filePath: string): boolean {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
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

  const priorityPaths: string[] = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');

    // Dynamically detect all Python versions in LocalAppData\Programs\Python
    const localPythonDir = path.join(localAppData, 'Programs', 'Python');
    if (fs.existsSync(localPythonDir)) {
      try {
        const entries = sortPythonDirsDescending(fs.readdirSync(localPythonDir));
        for (const pyVer of entries) {
          priorityPaths.push(
            path.join(localPythonDir, pyVer),
            path.join(localPythonDir, pyVer, 'Scripts')
          );
        }
      } catch (e) {
        console.debug('[envManager] Could not read localPythonDir:', e);
      }
    }

    const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
    if (fs.existsSync(progFiles)) {
      try {
        const entries = sortPythonDirsDescending(
          fs.readdirSync(progFiles).filter((e) => e.toLowerCase().startsWith('python3'))
        );
        for (const entry of entries) {
          priorityPaths.push(
            path.join(progFiles, entry),
            path.join(progFiles, entry, 'Scripts')
          );
        }
      } catch (e) {
        console.debug('[envManager] Could not read ProgramFiles Python:', e);
      }
    }

    // WinGet package links and packages
    priorityPaths.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links'));
    const winGetPackagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(winGetPackagesDir)) {
      try {
        for (const pkg of fs.readdirSync(winGetPackagesDir)) {
          const pkgDir = path.join(winGetPackagesDir, pkg);
          priorityPaths.push(pkgDir);
          try {
            for (const sub of fs.readdirSync(pkgDir)) {
              const subPath = path.join(pkgDir, sub);
              if (fs.statSync(subPath).isDirectory()) {
                priorityPaths.push(subPath);
                if (fs.existsSync(path.join(subPath, 'bin'))) {
                  priorityPaths.push(path.join(subPath, 'bin'));
                }
              }
            }
          } catch (subErr) {
            console.debug('[envManager] Error reading winget pkg subfolder:', subErr);
          }
        }
      } catch (pkgErr) {
        console.debug('[envManager] Error reading winget packages dir:', pkgErr);
      }
    }

    priorityPaths.push(
      'C:\\ffmpeg\\bin',
      'C:\\Program Files\\ffmpeg\\bin',
      'C:\\ProgramData\\chocolatey\\bin',
      'C:\\tools\\ffmpeg\\bin'
    );
  } else {
    priorityPaths.push(
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
      path.join(homedir, 'Library', 'Python', '3.9', 'bin'),
      path.join(homedir, 'Library', 'Python', '3.10', 'bin'),
      path.join(homedir, 'Library', 'Python', '3.11', 'bin'),
      path.join(homedir, 'Library', 'Python', '3.12', 'bin'),
      path.join(homedir, 'Library', 'Python', '3.13', 'bin')
    );
  }

  const existingPathSegments = (process.env.PATH || '')
    .split(delimiter)
    .filter(Boolean);

  const finalPaths = [...priorityPaths, ...existingPathSegments];

  return {
    ...process.env,
    PATH: Array.from(new Set(finalPaths.filter(Boolean))).join(delimiter),
  };
}

export async function runCommandQuick(
  cmd: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; timeoutMs?: number }
): Promise<{ success: boolean; stdout: string; stderr: string; code: number }> {
  const env = options?.env || getAugmentedEnv();
  const timeout = options?.timeoutMs ?? 3500;
  const isWin = process.platform === 'win32';

  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      env,
      timeout,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
      shell: isWin && (cmd === 'where' || cmd === 'py'),
    });
    return {
      success: true,
      stdout: (stdout || '').trim(),
      stderr: (stderr || '').trim(),
      code: 0,
    };
  } catch (err: any) {
    const stdout = (err?.stdout || '').toString().trim();
    const stderr = (err?.stderr || '').toString().trim();
    const code = typeof err?.code === 'number' ? err.code : (err?.killed ? -1 : 1);
    return {
      success: false,
      stdout,
      stderr,
      code,
    };
  }
}

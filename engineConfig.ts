import fs from 'fs';
import path from 'path';
import os from 'os';
import type { App } from 'electron';

let electronApp: App | null = null;
try {
  const electron = require('electron');
  electronApp = (electron && electron.app) || null;
} catch (e) {
  console.debug('[engineConfig] Electron app reference not available in current scope:', e);
}

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

export interface CacheStore {
  autoEditorInfo: AutoEditorInfo | null;
  whisperPython: string | null;
  pythonBinary: string | null;
  ffmpegItem: DependencyItem | null;
  whisperItem: DependencyItem | null;
  lastChecked: number;
}

export const cacheStore: CacheStore = {
  autoEditorInfo: null,
  whisperPython: null,
  pythonBinary: null,
  ffmpegItem: null,
  whisperItem: null,
  lastChecked: 0,
};

export function invalidateBinaryCaches(): void {
  cacheStore.autoEditorInfo = null;
  cacheStore.whisperPython = null;
  cacheStore.pythonBinary = null;
  cacheStore.ffmpegItem = null;
  cacheStore.whisperItem = null;
  cacheStore.lastChecked = 0;
}

export function getConfigPath(): string {
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
  } catch (err) {
    console.debug('[engineConfig] Fallback config path used:', err);
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
    console.warn('[engineConfig] Failed to load engine config:', err);
  }
  return {};
}

export function saveEnginePaths(paths: EnginePaths): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(paths, null, 2), 'utf8');
    invalidateBinaryCaches();
  } catch (err) {
    console.error('[engineConfig] Failed to save engine config:', err);
  }
}

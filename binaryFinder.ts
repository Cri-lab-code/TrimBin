/**
 * TrimBin Binary Discovery, Environment Augmentation & Auto-Installer Facade.
 *
 * This module delegates responsibilities to focused submodules:
 * - engineConfig: Configuration persistence, interfaces, and cache management
 * - envManager: Cross-platform PATH manipulation and async CLI execution
 * - dependencyScanner: Asynchronous, parallel detection of auto-editor, ffmpeg, python, whisper
 * - autoInstaller: WinGet / Homebrew / Pip automated dependency installation
 */

export * from './engineConfig';
export * from './envManager';
export * from './dependencyScanner';
export * from './autoInstaller';

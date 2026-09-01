import { SilenceSettings } from '../types/timeline';

export interface BuildAutoEditorOptions {
  inputPath: string;
  outputPath: string;
  thresholdDb?: number;
  marginSec?: number;
  settings?: SilenceSettings;
  exportFormat?: 'premiere' | 'resolve' | 'final-cut-pro' | 'kdenlive' | 'json' | 'direct' | string;
}


export function buildAutoEditorArgs(options: BuildAutoEditorOptions): string[] {
  const threshold = options.thresholdDb ?? options.settings?.threshold ?? -25;
  const margin = options.marginSec ?? options.settings?.paddingLeft ?? 0.2;

  const args: string[] = [
    options.inputPath,
    '--edit', `audio:threshold=${threshold}dB`,
    '--margin', `${margin}s`,
    '--no-open',
  ];

  if (options.exportFormat && options.exportFormat !== 'direct' && options.exportFormat !== 'default') {
    args.push('--export', options.exportFormat);
  }

  args.push('-o', options.outputPath);
  return args;
}

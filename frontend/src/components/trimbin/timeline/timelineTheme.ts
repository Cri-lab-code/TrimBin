/**
 * Design tokens and canvas color palette for TrimBin Magnetic Timeline.
 * All RGB/hex values are centralized here to maintain visual parity with index.css.
 */

export const TIMELINE_CANVAS_THEME = {
  // Minimap track
  minimapBg: '#06080d',
  minimapClip: '#f59e0b',
  minimapSilenceKept: 'rgba(16, 185, 129, 0.85)',
  minimapSilenceCut: 'rgba(239, 68, 68, 0.75)',

  // 35mm Filmstrip video track
  filmStripGrad0: '#c25e2e',
  filmStripGrad35: '#a44c24',
  filmStripGrad70: '#8f3a14',
  filmStripGrad100: '#6e2b0e',
  filmPerforation: '#07080b',
  filmLabel: '#fef08a',
  filmFrameNum: '#fde047',
  filmBarcodes: '#fef08a',
  filmEdgeBorder: '#260e04',
  filmSelectionStroke: '#fde047',
  filmSelectionGlow: '#f59e0b',
  filmFrameHole: '#140803',
  filmTextLight: '#fffbeb',

  // Audio Waveform & Speech/Silence slices track
  waveformBg: '#0a0d14',
  waveformCutKeptStroke: '#6ee7b7',
  waveformCutCutStroke: '#fef08a',
  waveformCutKeptGlow: '#10b981',
  waveformCutCutGlow: '#f59e0b',
  waveformGradTop: '#93c5fd',
  waveformGradMid: '#3b82f6',
  waveformGradDeep: '#1d4ed8',

  // SMPTE Timecode Ruler track
  rulerBgTop: '#181c26',
  rulerBgBottom: '#0e111a',
  rulerMajorTick: '#475569',
  rulerMinorTick: '#3b4760',
  rulerMajorLabel: '#cbd5e1',
  rulerMinorLabel: '#5b6e94',
} as const;

import { Scissors, Loader2 } from 'lucide-react';
import React from 'react';
import { SilenceSettings } from '../../types/timeline';
import { formatLinearAmplitude } from '../../utils/audioCalibration';
import { KnurledKnob } from './KnurledKnob';
import { PresetBar } from './PresetBar';

const THRESHOLD_STEPS = [-40, -30, -25, -20, -15];
const MIN_CUT_STEPS = [0.0, 0.2, 0.5, 1.0];
const MIN_CLIP_STEPS = [0.0, 0.05, 0.1, 0.25];

export interface SilenceTabProps {
  settings: SilenceSettings;
  onSettingsChange: (newSettings: SilenceSettings) => void;
  isAnalyzing: boolean;
  analysisProgress: number;
  onAnalyzeCuts: () => void;
  onAutoCalibrate?: () => void;
  isCalibrating?: boolean;
}

export const SilenceTab: React.FC<SilenceTabProps> = ({
  settings,
  onSettingsChange,
  isAnalyzing,
  analysisProgress,
  onAnalyzeCuts,
  onAutoCalibrate,
  isCalibrating = false,
}) => {
  const {
    isAdvancedMode,
    threshold,
    isAutoThreshold,
    minSilenceDuration,
    paddingLeft,
    paddingRight,
    isPaddingLinked,
    minClipDuration,
  } = settings;

  const handleTriggerAutoCalibrate = () => {
    if (isAutoThreshold) {
      onSettingsChange({
        ...settings,
        isAutoThreshold: false,
      });
    } else {
      if (onAutoCalibrate) {
        onAutoCalibrate();
      } else {
        onSettingsChange({
          ...settings,
          isAutoThreshold: true,
        });
        onAnalyzeCuts();
      }
    }
  };

  const handlePaddingLeftChange = (val: number) => {
    const clamped = Math.max(0, Math.min(2.0, parseFloat(val.toFixed(2))));
    if (isPaddingLinked) {
      onSettingsChange({
        ...settings,
        paddingLeft: clamped,
        paddingRight: clamped,
      });
    } else {
      onSettingsChange({
        ...settings,
        paddingLeft: clamped,
      });
    }
  };

  return (
    <div className="space-y-2 select-none">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--text-accent-bright)] uppercase tracking-widest">
          <span>{isAdvancedMode ? 'ADVANCED RACK' : 'SILENCE DETECTOR'}</span>
        </div>
        <button
          type="button"
          onClick={() => onSettingsChange({ ...settings, isAdvancedMode: !isAdvancedMode })}
          className="btn-tactile px-2 py-0.5 text-[9px] font-mono cursor-pointer rounded-[2px]"
        >
          {isAdvancedMode ? 'SIMPLE' : 'ADVANCED'}
        </button>
      </div>

      {/* Acoustic Scanner Master Trigger */}
      <div className="p-2 rounded-[3px] panel-surface space-y-1.5">
        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-[var(--timeline-track-label)] uppercase tracking-wider">
          <span>ACOUSTIC SCANNER</span>
          <span className="text-[8px] text-amber-300 font-mono font-bold bg-[var(--well-inset)] px-1.5 py-0.5 rounded-[2px] border border-[var(--border-subtle)]">
            AUTO-EDITOR
          </span>
        </div>

        <div className="panel-inset p-1">
          <button
            type="button"
            onClick={onAnalyzeCuts}
            disabled={isAnalyzing || isCalibrating}
            className={`btn-actuator ${isAnalyzing ? 'is-engaged' : ''}`}
          >
            <div className="flex items-center justify-center gap-2">
    {isAnalyzing ? (
      <>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
        <span className="font-sans font-bold text-xs">ANALYZING AUDIO CUTS ({analysisProgress}%)...</span>
      </>
    ) : (
      <>
        <Scissors className="w-4 h-4 text-amber-400" />
        <span className="font-sans font-bold text-xs tracking-wide">SCAN SILENCE & GENERATE CUTS</span>
      </>
    )}
  </div>
          </button>
        </div>
      </div>

      {!isAdvancedMode ? (
        <div className="p-2.5 rounded-[5px] bg-[var(--timeline-track-lane)] border border-[var(--border-panel-groove)] shadow-panel-bevel space-y-2">
          {/* Linear Digital Level Meter */}
          <div className="space-y-1 pb-1.5 border-b border-[var(--border-panel-groove)]">
            <div className="flex justify-between items-center text-[8.5px] font-mono font-bold text-amber-200/90 uppercase">
              <span>THRESHOLD LEVEL:</span>
              <span className="text-amber-400 font-mono font-black">
                {threshold} dB <span className="text-amber-300/60 font-normal">({formatLinearAmplitude(threshold)})</span>
              </span>
            </div>

            <div className="h-[10px] w-full bg-[var(--timeline-readout-bg)] border border-black/80 rounded-[3px] p-[1.5px] shadow-inset-well relative flex items-center gap-[2px] overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => {
                const ratio = i / 23;
                const minDb = -60;
                const maxDb = 0;
                const currentRatio = Math.max(0, Math.min(1, (threshold - minDb) / (maxDb - minDb)));
                const isActive = ratio <= currentRatio;
                const isOverload = ratio > 0.85;
                const isCaution = ratio > 0.65 && ratio <= 0.85;

                let activeColor = 'bg-amber-400 shadow-amber-bloom';
                if (isOverload) activeColor = 'bg-red-500 shadow-laser-glow';
                else if (isCaution) activeColor = 'bg-amber-500 shadow-amber-bloom';

                return (
                  <div
                    key={i}
                    className={`flex-1 h-full rounded-[1px] transition-colors ${
                      isActive ? activeColor : 'bg-[var(--bg-panel-sub)]'
                    }`}
                  />
                );
              })}

              <div
                className="absolute top-0 bottom-0 w-[2.5px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 rounded-[1px] shadow-amber-bloom pointer-events-none z-10 -translate-x-1/2"
                style={{
                  left: `${Math.max(2, Math.min(98, ((threshold - (-60)) / (0 - (-60))) * 100))}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[7.5px] font-mono text-amber-400/50 font-bold px-0.5">
              <span>-60 dB</span>
              <span>-30 dB</span>
              <span>0 dB</span>
            </div>
          </div>

          {/* Dual Knurled Knobs */}
          <div className="grid grid-cols-2 gap-2 pt-0 pb-1.5 border-b border-[var(--border-panel-groove)]">
            <KnurledKnob
              label="THRESHOLD"
              value={threshold}
              min={-60}
              max={0}
              step={1}
              unit=" dB"
              onChange={(val) => {
                onSettingsChange({
                  ...settings,
                  threshold: Math.round(val),
                  isAutoThreshold: false,
                });
              }}
            />
            <KnurledKnob
              label="PADDING"
              value={paddingLeft}
              min={0}
              max={2.0}
              step={0.05}
              unit="s"
              onChange={handlePaddingLeftChange}
            />
          </div>

          {/* Modular Preset Threshold Bar */}
          <PresetBar
            currentThreshold={threshold}
            onSelectThreshold={(val: number) => {
              onSettingsChange({
                ...settings,
                threshold: val,
                isAutoThreshold: false,
              });
            }}
          />

          {/* Auto-Calibrate Noise Floor Toggle */}
          <div className="pt-1.5 border-t border-[var(--border-panel-groove)] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[8.5px] font-mono font-bold text-[var(--timeline-track-label)] uppercase">
                AUTO-CALIBRATE NOISE FLOOR:
              </span>
              <button
                type="button"
                onClick={handleTriggerAutoCalibrate}
                disabled={isCalibrating}
                className={`btn-tactile px-2 py-0.5 text-[8.5px] gap-1 ${
                  isAutoThreshold ? 'active' : ''
                }`}
              >
                <span className={isAutoThreshold ? 'led-amber' : 'w-1.5 h-1.5 rounded-full bg-slate-600'} />
                <span>{isCalibrating ? 'CALIBRATING...' : isAutoThreshold ? 'ENGAGED' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Advanced Mode Controls */
        <div className="p-2.5 rounded-[5px] bg-[var(--timeline-track-lane)] border border-[var(--border-panel-groove)] shadow-panel-bevel space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono font-bold text-slate-300 uppercase">
              <span>MANUAL THRESHOLD:</span>
              <span className="text-amber-400 font-bold">{threshold} dB</span>
            </div>
            <input
              type="range"
              min="-60"
              max="0"
              step="1"
              value={threshold}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  threshold: parseInt(e.target.value, 10),
                  isAutoThreshold: false,
                })
              }
              className="skeuo-slider w-full"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono font-bold text-slate-300 uppercase">
              <span>MIN SILENCE DURATION:</span>
              <span className="text-amber-400 font-bold">{minSilenceDuration.toFixed(2)}s</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MIN_CUT_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, minSilenceDuration: s })}
                  className={`btn-tactile text-[8.5px] h-6 ${minSilenceDuration === s ? 'active' : ''}`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono font-bold text-slate-300 uppercase">
              <span>MIN SPEECH DURATION:</span>
              <span className="text-amber-400 font-bold">{minClipDuration.toFixed(2)}s</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MIN_CLIP_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, minClipDuration: s })}
                  className={`btn-tactile text-[8.5px] h-6 ${minClipDuration === s ? 'active' : ''}`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

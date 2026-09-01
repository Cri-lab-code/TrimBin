import React from 'react';
import { FolderOpen, Check, Download, Video, Music, Settings2, Loader2 } from 'lucide-react';

interface ExportTabProps {
  exportAs: string;
  onExportAsChange: (format: string) => void;
  videoCodec: string;
  onVideoCodecChange: (codec: string) => void;
  audioCodec: string;
  onAudioCodecChange: (codec: string) => void;
  videoQualityCrf?: number;
  onVideoQualityCrfChange?: (val: number) => void;
  audioTrackMode?: 'mix' | 'separate';
  onAudioTrackModeChange?: (mode: 'mix' | 'separate') => void;
  openWhenDone: boolean;
  onToggleOpenWhenDone: () => void;
  exportPath: string;
  onExportPathChange: (path: string) => void;
  onBrowseFolder: () => void;
  onRunExport: () => void;
  isProcessing: boolean;
  exportProgress: number;
}

export const ExportTab: React.FC<ExportTabProps> = ({
  exportAs,
  onExportAsChange,
  videoCodec,
  onVideoCodecChange,
  audioCodec,
  onAudioCodecChange,
  videoQualityCrf = 21,
  onVideoQualityCrfChange,
  audioTrackMode = 'mix',
  onAudioTrackModeChange,
  openWhenDone,
  onToggleOpenWhenDone,
  exportPath,
  onExportPathChange,
  onBrowseFolder,
  onRunExport,
  isProcessing,
  exportProgress,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-2.5 pr-0.5 pb-2">
      {/* High-Density Format Selection */}
      <div className="panel-surface p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-sans font-bold text-slate-300 uppercase tracking-wider">
            Export Format & NLE Cartridge
          </span>
          <span className="text-[9px] font-mono text-amber-400 font-bold">XML / FCPXML / DIRECT</span>
        </div>

        <div className="space-y-1">
          {[
            { id: 'premiere', name: 'Adobe Premiere Pro', ext: '.xml', badge: 'PREMIERE' },
            { id: 'final-cut-pro', name: 'Final Cut Pro', ext: '.fcpxml', badge: 'FCPXML' },
            { id: 'davinci', name: 'DaVinci Resolve', ext: '.xml', badge: 'RESOLVE' },
            { id: 'kdenlive', name: 'Kdenlive Project', ext: '.kdenlive', badge: 'KDEN' },
            { id: 'default', name: 'Direct Rendered Video', ext: '.mp4', badge: 'RENDER' },
            { id: 'audio', name: 'WAV Audio Track', ext: '.wav', badge: 'PCM' },
            { id: 'json', name: 'Cut Data JSON', ext: '.json', badge: 'DATA' },
          ].map((fmt) => (
            <label
              key={fmt.id}
              onClick={() => onExportAsChange(fmt.id)}
              className={`px-2.5 py-1.5 rounded-[3px] border flex items-center justify-between cursor-pointer transition-colors ${
                exportAs === fmt.id
                  ? 'bg-[var(--accent-amber-subtle)] border-amber-500/80 text-[var(--text-primary)] shadow-sm'
                  : 'bg-[var(--bg-panel-sub)] border-[var(--border-default)] text-slate-300 hover:border-slate-600 hover:bg-[var(--bg-panel-hover)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    exportAs === fmt.id
                      ? 'border-amber-400 bg-amber-500'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {exportAs === fmt.id && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3.5} />}
                </div>
                <span className="text-[11px] font-sans font-semibold">{fmt.name}</span>
                <span className="text-[10px] font-mono text-slate-500">{fmt.ext}</span>
              </div>
              <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                exportAs === fmt.id
                  ? 'chip-badge-accent'
                  : 'chip-badge'
              }`}>
                {fmt.badge}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Video Codec Settings */}
      <div className="panel-surface p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-sans font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-amber-400" />
            Video Render Setup
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[9px] font-sans font-semibold text-slate-400 uppercase block">
              Codec Engine
            </label>
            <select
              value={videoCodec}
              onChange={(e) => onVideoCodecChange(e.target.value)}
              className="w-full bg-[var(--well-inset)] border border-[var(--border-default)] rounded-[3px] px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
            >
              <option value="auto">Auto (Source)</option>
              <option value="h264">H.264 / AVC</option>
              <option value="hevc">H.265 / HEVC</option>
              <option value="prores">Apple ProRes</option>
              <option value="dnxhd">Avid DNxHD</option>
              <option value="copy">Stream Copy (Fast)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-sans font-semibold text-slate-400 uppercase block">
              Audio Codec
            </label>
            <select
              value={audioCodec}
              onChange={(e) => onAudioCodecChange(e.target.value)}
              className="w-full bg-[var(--well-inset)] border border-[var(--border-default)] rounded-[3px] px-2 py-1 text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-none"
            >
              <option value="auto">Auto (Match)</option>
              <option value="aac">AAC Stereo</option>
              <option value="pcm_s16le">PCM 16-bit Uncompressed</option>
              <option value="pcm_s24le">PCM 24-bit Studio</option>
              <option value="flac">FLAC Lossless</option>
              <option value="copy">Stream Copy</option>
            </select>
          </div>
        </div>

        {onAudioTrackModeChange && (
          <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <span className="text-[10px] font-sans font-medium text-slate-400">Audio Track Routing</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onAudioTrackModeChange('mix')}
                className={`px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-[2px] border transition-colors ${
                  audioTrackMode === 'mix'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                    : 'bg-[var(--bg-inset)] text-slate-400 border-[var(--border-default)]'
                }`}
              >
                MIX ALL
              </button>
              <button
                type="button"
                onClick={() => onAudioTrackModeChange('separate')}
                className={`px-2 py-0.5 text-[9.5px] font-mono font-bold rounded-[2px] border transition-colors ${
                  audioTrackMode === 'separate'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                    : 'bg-[var(--bg-inset)] text-slate-400 border-[var(--border-default)]'
                }`}
              >
                KEEP TRACKS
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Output Destination Folder */}
      <div className="panel-surface p-2.5 space-y-2">
        <span className="text-[10px] font-sans font-bold text-slate-300 uppercase tracking-wider block">
          Destination Folder
        </span>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={exportPath}
            onChange={(e) => onExportPathChange(e.target.value)}
            placeholder="/path/to/exported/project"
            className="flex-1 bg-[var(--well-inset)] border border-[var(--border-default)] rounded-[3px] px-2.5 py-1 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none truncate"
          />
          <button
            type="button"
            onClick={onBrowseFolder}
            className="btn-tactile px-2.5 flex items-center gap-1 shrink-0"
            title="Browse Directory"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px]">BROWSE</span>
          </button>
        </div>

        <label className="flex items-center gap-2 cursor-pointer pt-0.5">
          <input
            type="checkbox"
            checked={openWhenDone}
            onChange={onToggleOpenWhenDone}
            className="rounded border-[var(--border-default)] text-amber-500 focus:ring-0 focus:ring-offset-0 bg-[var(--bg-inset)]"
          />
          <span className="text-[11px] font-sans text-slate-300">
            Open in NLE / Reveal in Finder when completed
          </span>
        </label>
      </div>

      {/* Execute Export Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onRunExport}
          disabled={isProcessing}
          className="btn-actuator py-2 text-xs font-sans font-bold tracking-wider"
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>RENDERING TIMELINE ({exportProgress}%)...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Download className="w-4 h-4 text-amber-400" />
              <span>RUN EXPORT PIPELINE</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

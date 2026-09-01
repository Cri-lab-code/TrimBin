import React from 'react';
import { AutoEditorInfo, DependencyStatus } from '@/global';

interface TrimBinHeaderProps {
  projectName: string;
  autoEditorInfo?: AutoEditorInfo | null;
  dependencyStatus?: DependencyStatus | null;
  onToggleConsole: () => void;
  isConsoleOpen: boolean;
  onOpenAbout?: () => void;
  onOpenDependencies?: () => void;
  cutsCount?: number;
  savedPercentage?: number;
  isProcessing?: boolean;
  progress?: number;
}

export const TrimBinHeader: React.FC<TrimBinHeaderProps> = ({
  projectName,
  dependencyStatus,
  onToggleConsole,
  isConsoleOpen,
  onOpenAbout,
  onOpenDependencies,
  cutsCount,
  savedPercentage,
}) => {
  const isEngineReady = dependencyStatus ? dependencyStatus.allReady : true;

  return (
    <header className="h-8 px-2.5 flex items-center justify-between select-none z-30 shrink-0 border-b border-black/95 bg-[var(--bg-panel)] shadow-panel-bevel relative">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[var(--bg-inset)] border border-[var(--border-subtle)] shadow-inset-well max-w-xs">
          <span className="text-[8.5px] font-mono font-bold tracking-widest text-amber-500/90 uppercase">
            BIN:
          </span>
          <span className="text-[10.5px] font-mono font-bold text-[var(--text-accent-bright)] truncate tracking-tight glow-amber-text">
            {projectName || 'Untitled_Bin.mp4'}
          </span>
        </div>
        {cutsCount !== undefined && cutsCount > 0 && (
          <div className="hidden sm:flex items-center gap-1">
            <div className="px-1.5 py-0.5 rounded-[2px] bg-[var(--bg-inset)] border border-[var(--border-subtle)] shadow-inset-well text-[8.5px] font-mono font-bold text-amber-300">
              <span className="glow-amber-text">{cutsCount.toLocaleString()} CUTS</span>
            </div>

            <div className="px-1.5 py-0.5 rounded-[2px] bg-[var(--bg-inset)] border border-[var(--border-subtle)] shadow-inset-well text-[8.5px] font-mono font-bold text-amber-300">
              <span className="glow-amber-text">{savedPercentage}% SAVED</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        {/* Engines Button */}
        {onOpenDependencies && (
          <button
            type="button"
            onClick={onOpenDependencies}
            className={`console-btn-tactile h-6 px-2 text-[9px] gap-1.5 font-mono uppercase tracking-wider rounded-[2px] ${
              !isEngineReady ? 'border-amber-500/70 text-amber-200 animate-pulse' : ''
            }`}
            title="Engines"
          >
            <span>ENGINES</span>
            </button>
        )}

        {/* About Button */}
        {onOpenAbout && (
          <button
            type="button"
            onClick={onOpenAbout}
            className="console-btn-tactile h-6 px-2 text-[9px] font-mono uppercase tracking-wider rounded-[2px]"
            title="About"
          >
            ABOUT
          </button>
        )}

        {/* Terminal Button */}
        <button
          type="button"
          onClick={onToggleConsole}
          className={`console-btn-tactile h-6 px-2 text-[9px] gap-1.5 font-mono uppercase tracking-wider rounded-[2px] ${
            isConsoleOpen ? 'is-active' : ''
          }`}
          title="Logs"
        >
          <span>LOGS</span>
          </button>

        
      </div>
    </header>
  );
};

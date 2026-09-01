import React, { useState } from 'react';
import { Terminal, Copy, Check, X, Trash2 } from 'lucide-react';

interface TrimBinConsoleDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  commandString: string;
  logs: string[];
  onClearLogs: () => void;
  progress: number;
  isProcessing: boolean;
}

export const TrimBinConsoleDrawer: React.FC<TrimBinConsoleDrawerProps> = ({
  isOpen,
  onToggle,
  commandString,
  logs,
  onClearLogs,
  progress,
  isProcessing,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(commandString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-2 mb-2 select-none shrink-0 z-40 rounded-[6px] overflow-hidden shadow-panel-bevel border border-[var(--border-default)] console-panel">
      {/* Console Drawer Header Bar */}
      <div className="h-7 px-3 flex items-center justify-between text-[var(--text-silkscreen-bright)] border-b border-[var(--border-subtle)] bg-gradient-to-r from-[var(--bg-panel-sub)] via-[var(--bg-panel)] to-[var(--bg-chassis)]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.4} />
          <span className="font-mono font-bold text-xs tracking-wider uppercase text-[var(--text-silkscreen-bright)] glow-amber-text">
            CLI TERMINAL & DIAGNOSTIC LOGS
          </span>
          {isProcessing && (
            <span className="text-amber-300 animate-pulse font-mono font-bold text-[9px] bg-amber-950/40 px-2 py-0.5 rounded-[3px] border border-amber-500/50 shadow-inner">
              [RUNNING: {Math.round(progress)}%]
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Clear Logs Button */}
          <button
            type="button"
            onClick={onClearLogs}
            className="console-btn-tactile px-2 py-0.5 text-[9.5px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            title="Clear Terminal Logs"
          >
            <Trash2 className="w-2.5 h-2.5 text-red-400" strokeWidth={2.4} />
            <span>CLEAR</span>
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onToggle}
            className="console-btn-tactile w-6 h-6 flex items-center justify-center rounded-[3px] cursor-pointer"
            title="Close Terminal (Esc)"
          >
            <X className="w-3 h-3 text-slate-300" strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* Console Drawer Body */}
      <div className="p-2.5 space-y-2 max-h-48 overflow-y-auto bg-[var(--bg-inset)]">
        {/* CLI Command Box */}
        <div className="flex items-center justify-between p-1.5 px-2.5 rounded-[4px] bg-[var(--bg-inset-sub)] border border-[var(--border-subtle)] shadow-inset-well">
          <code className="text-[10px] text-amber-300 font-mono font-bold tracking-wide truncate mr-2 select-text glow-amber-text">
            {commandString || 'auto-editor --version'}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="console-btn-tactile p-1 rounded-[3px] shrink-0 cursor-pointer"
            title="Copy CLI command"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" strokeWidth={2.4} /> : <Copy className="w-3 h-3 text-amber-300" strokeWidth={2.4} />}
          </button>
        </div>

        {/* Real-time CRT Phosphor Scanline Log Screen */}
        <div className="p-2.5 h-28 overflow-y-auto space-y-1 select-text rounded-[4px] bg-[var(--terminal-screen)] crt-screen-overlay border border-[var(--border-subtle)] shadow-inset-deep timeline-scroll-container">
          {logs.length > 0 ? (
            logs.map((line, idx) => (
              <div
                key={idx}
                className={
                  "text-[9.5px] font-mono leading-relaxed whitespace-pre-wrap " +
                  (line.includes('Error') || line.includes('FAILED')
                    ? 'text-red-400 font-bold'
                    : line.includes('SUCCESS') || line.includes('Completed')
                    ? 'text-emerald-400 font-bold'
                    : line.includes('[START]') || line.includes('Running')
                    ? 'text-amber-300 font-semibold'
                    : 'text-slate-300')
                }
              >
                {line}
              </div>
            ))
          ) : (
            <div className="text-[10px] font-mono text-slate-600 italic">
              Terminal ready. Waiting for tasks...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

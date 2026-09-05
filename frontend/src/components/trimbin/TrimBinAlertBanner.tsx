import React from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FolderOpen } from 'lucide-react';

export interface AlertData {
  message: string;
  type: 'error' | 'success';
  filePath?: string;
}

interface TrimBinAlertBannerProps {
  alert: AlertData | null;
  isProcessing: boolean;
  onDismiss: () => void;
}

export const TrimBinAlertBanner: React.FC<TrimBinAlertBannerProps> = ({
  alert,
  isProcessing,
  onDismiss,
}) => {
  if (!alert || isProcessing) return null;

  return (
    <div
      className={`mx-2 my-1.5 px-3.5 py-2 rounded-[6px] flex items-center justify-between z-40 text-xs font-mono font-bold shadow-panel-bevel border ${
        alert.type === 'error'
          ? 'bg-gradient-to-b from-red-900 via-red-800 to-red-950 text-red-100 border-red-500'
          : 'bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 text-emerald-100 border-emerald-500'
      }`}
    >
      <div className="flex items-center gap-2 truncate mr-2">
        {alert.type === 'error' ? (
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={2.4} />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2.4} />
        )}
        <span className="truncate font-extrabold text-white">
          {alert.message}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {alert.filePath && (
          <>
            <button
              type="button"
              onClick={() => {
                if (window.electron && alert.filePath) {
                  window.electron.openPath(alert.filePath);
                }
              }}
              className="px-2.5 py-1 text-[10px] font-mono font-black text-amber-200 bg-[var(--accent-amber-subtle)] border border-[var(--accent-amber-border)] rounded-[4px] hover:text-white flex items-center gap-1 cursor-pointer"
              title="Open directly in default application (DaVinci, Final Cut, Premiere)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.4} />
              OPEN IN APPLICATION
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.electron && alert.filePath) {
                  window.electron.showItemInFolder(alert.filePath);
                }
              }}
              className="px-2.5 py-1 text-[10px] font-mono font-black text-slate-200 bg-[var(--bg-panel-sub)] border border-[var(--border-default)] rounded-[4px] hover:text-white flex items-center gap-1 cursor-pointer"
              title="Reveal file in Finder"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" strokeWidth={2.4} />
              REVEAL IN FINDER
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1 text-[10px] font-mono font-bold text-slate-300 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-[4px] hover:text-white cursor-pointer"
        >
          DISMISS
        </button>
      </div>
    </div>
  );
};

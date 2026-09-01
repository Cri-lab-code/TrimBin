import React, { useEffect, useRef } from 'react';
import { X, Code2, ExternalLink } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenLink = (url: string) => {
    if (window.electron?.openExternal) {
      window.electron.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="absolute top-9 right-2.5 z-50 select-none animate-in fade-in zoom-in-95 duration-100">
      <div
        ref={panelRef}
        className="w-80 panel-surface rounded-[4px] shadow-modal-elevation border border-[var(--modal-border)] overflow-hidden text-slate-200"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)] bg-gradient-to-r from-[var(--bg-panel-sub)] via-[var(--bg-panel)] to-[var(--bg-chassis)]">
          <span className="text-[10.5px] font-sans font-bold tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-amber-400" />
            TrimBin Studio
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-4 h-4 flex items-center justify-center rounded-[2px] text-slate-400 hover:text-white hover:bg-slate-700/50 cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3 space-y-2.5 bg-[var(--bg-inset)]">
          <div className="p-2 rounded-[3px] text-center space-y-1 border border-[var(--border-subtle)] bg-[var(--bg-inset-sub)]">
            <div className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-[9.5px] font-mono font-bold tracking-wider text-amber-300 bg-amber-950/40 border border-amber-500/40">
              TRIMBIN v1.0.0
            </div>
            <p className="text-[11px] text-slate-300 leading-tight font-sans">
              Tactile, professional silence removal and speech rough-cutting GUI.
            </p>
          </div>

          <div className="space-y-1 bg-[var(--bg-inset-sub)] p-2 rounded-[3px] border border-[var(--border-subtle)]">
            <span className="text-[9px] font-sans font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Core Processing Engines
            </span>

            <div
              onClick={() => handleOpenLink('https://github.com/wyattblue/auto-editor')}
              className="flex items-center justify-between py-1 px-1.5 rounded-[2px] hover:bg-[var(--bg-panel)] cursor-pointer transition-colors text-[11px]"
            >
              <span className="font-semibold text-amber-200">auto-editor</span>
              <span className="text-[9.5px] font-mono text-slate-500">by WyattBlue</span>
            </div>

            <div
              onClick={() => handleOpenLink('https://github.com/sashminea/auto-editor-gui')}
              className="flex items-center justify-between py-1 px-1.5 rounded-[2px] hover:bg-[var(--bg-panel)] cursor-pointer transition-colors text-[11px]"
            >
              <span className="font-semibold text-amber-200">auto-editor-gui</span>
              <span className="text-[9.5px] font-mono text-slate-500">by sashminea</span>
            </div>

            <div
              onClick={() => handleOpenLink('https://github.com/openai/whisper')}
              className="flex items-center justify-between py-1 px-1.5 rounded-[2px] hover:bg-[var(--bg-panel)] cursor-pointer transition-colors text-[11px]"
            >
              <span className="font-semibold text-amber-200">Whisper AI</span>
              <span className="text-[9.5px] font-mono text-slate-500">by OpenAI</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[9.5px] font-sans text-slate-400 px-0.5">
            <span>Crafted by <strong className="text-slate-200">Cri-Lab-code</strong></span>
            <span className="text-amber-400/90 font-mono font-bold">MIT LICENSE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

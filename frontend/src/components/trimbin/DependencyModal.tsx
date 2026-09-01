import React, { useState, useEffect, useRef } from 'react';
import { DependencyStatus, DependencyItem } from '@/global';
import { RefreshCw, X, CheckCircle2, AlertCircle, Cpu, FolderOpen } from 'lucide-react';

interface DependencyModalProps {
  isOpen: boolean;
  status: DependencyStatus | null;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export const DependencyModal: React.FC<DependencyModalProps> = ({
  isOpen,
  status,
  onRefresh,
  onClose,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManualPaths, setShowManualPaths] = useState(false);
  const [customPaths, setCustomPaths] = useState<{
    autoEditorPath?: string;
    whisperPath?: string;
    ffmpegPath?: string;
  }>({});

  const panelRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (window.electron?.onDependencyInstallLog) {
      const unsub = window.electron.onDependencyInstallLog((log: string) => {
        setInstallLogs((prev) => [...prev, log]);
        setShowLogs(true);
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [installLogs, showLogs]);

  if (!isOpen) return null;

  const defaultItem = (name: 'auto-editor' | 'whisper' | 'ffmpeg', displayName: string): DependencyItem => ({
    name,
    displayName,
    available: false,
    required: true,
    description: '',
  });

  const autoEditor = status?.autoEditor || defaultItem('auto-editor', 'auto-editor');
  const whisper = status?.whisper || defaultItem('whisper', 'whisper');
  const ffmpeg = status?.ffmpeg || defaultItem('ffmpeg', 'ffmpeg');
  const allReady = status?.allReady || false;

  const handleManualRefresh = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      await onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error checking dependencies');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAutoInstall = async () => {
    if (!window.electron?.autoInstallDependencies) return;
    setIsInstalling(true);
    setErrorMsg(null);
    setInstallLogs(['[START] Initializing environment setup...\n']);
    setShowLogs(true);

    try {
      const res = await window.electron.autoInstallDependencies();
      if (res?.success) {
        setInstallLogs((prev) => [...prev, '\n[SUCCESS] Environment installed successfully!\n']);
        await onRefresh();
      } else {
        setErrorMsg(res?.error || 'Installation error');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Installation error');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleBrowse = async (tool: 'autoEditor' | 'whisper' | 'ffmpeg') => {
    if (!window.electron?.browseBinaryPath) return;
    try {
      const filePath = await window.electron.browseBinaryPath(tool);
      if (filePath) {
        const key = `${tool}Path` as keyof typeof customPaths;
        setCustomPaths((prev) => ({ ...prev, [key]: filePath }));
        await window.electron.setBinaryPath({ tool, binaryPath: filePath });
        await onRefresh();
      }
    } catch (err) {
      console.error('Browse binary path error:', err);
    }
  };

  const renderEngineRow = (item: DependencyItem, toolKey: 'autoEditor' | 'whisper' | 'ffmpeg') => (
    <div className="p-2 rounded-[3px] bg-[var(--bg-inset)] border border-[var(--border-subtle)] space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {item.available ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.4} />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-red-400" strokeWidth={2.4} />
          )}
          <span className="font-mono text-xs font-bold text-slate-200">{item.displayName}</span>
          {item.version && <span className="font-mono text-[9px] text-slate-500">v{item.version}</span>}
        </div>
        <span
          className={`px-1.5 py-0.2 text-[8.5px] font-mono font-bold rounded border ${
            item.available
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}
        >
          {item.available ? 'READY' : 'MISSING'}
        </span>
      </div>

      {showManualPaths && (
        <div className="flex items-center gap-1 pt-1">
          <input
            type="text"
            readOnly
            value={item.path || customPaths[`${toolKey}Path` as keyof typeof customPaths] || ''}
            placeholder="Automatic environment path"
            className="flex-1 bg-[var(--well-inset)] border border-[var(--border-default)] text-[10px] font-mono text-slate-300 px-2 py-0.5 rounded truncate"
          />
          <button
            type="button"
            onClick={() => handleBrowse(toolKey)}
            className="px-1.5 py-0.5 text-[9px] font-mono bg-[var(--bg-panel-sub)] border border-slate-700 hover:border-amber-500 rounded text-slate-300 flex items-center gap-1"
          >
            <FolderOpen className="w-2.5 h-2.5" />
            <span>PATH</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="absolute top-9 right-2.5 z-50 select-none animate-in fade-in zoom-in-95 duration-100">
      <div
        ref={panelRef}
        className="w-96 panel-surface rounded-[4px] shadow-modal-elevation border border-[var(--modal-border)] overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-panel-sub)]">
          <span className="text-[10.5px] font-sans font-bold tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            Engine Diagnostics & Status
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isVerifying}
              className="w-5 h-5 flex items-center justify-center rounded-[2px] text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-3 h-3 ${isVerifying ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded-[2px] text-slate-400 hover:text-white hover:bg-slate-700/50 cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2 bg-[var(--bg-panel)]">
          {errorMsg && (
            <div className="p-2 rounded bg-red-950/40 border border-red-500/40 text-[10.5px] text-red-200 font-sans">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            {renderEngineRow(autoEditor, 'autoEditor')}
            {renderEngineRow(whisper, 'whisper')}
            {renderEngineRow(ffmpeg, 'ffmpeg')}
          </div>

          <div className="pt-1 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowManualPaths((v) => !v)}
              className="text-[9.5px] font-mono text-slate-400 hover:text-amber-300 underline cursor-pointer"
            >
              {showManualPaths ? 'Hide Path Configuration' : 'Configure Custom Paths'}
            </button>

            {!allReady && (
              <button
                type="button"
                onClick={handleAutoInstall}
                disabled={isInstalling}
                className="btn-tactile px-2 py-0.5 text-[9.5px] font-mono font-bold text-amber-300"
              >
                {isInstalling ? 'INSTALLING...' : 'AUTO-SETUP'}
              </button>
            )}
          </div>

          {showLogs && (
            <div className="mt-2 p-2 rounded bg-[var(--bg-inset)] border border-[var(--border-subtle)] max-h-28 overflow-y-auto font-mono text-[9px] text-slate-400 space-y-0.5">
              {installLogs.map((log, i) => (
                <div key={i} className="leading-tight">{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

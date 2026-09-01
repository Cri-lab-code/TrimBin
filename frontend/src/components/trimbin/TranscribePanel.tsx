import React, { useState, useEffect, useMemo, useRef, useCallback, Component, ErrorInfo } from 'react';
import {
  Mic,
  Search,
  Download,
  Copy,
  Check,
  Loader2,
  FileText,
  Clock,
  SlidersHorizontal,
  Trash2,
  FileAudio,
  AlertTriangle,
} from 'lucide-react';
import { TranscriptSegment, TranscribeProgressData } from '@/global';

class TranscribeErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TranscribePanel ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center space-y-3 skeuo-well-dark rounded-[6px] m-1 border border-red-500/50">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-red-400 text-xs font-mono font-bold uppercase">TRANSCRIPT MODULE RECOVERED</p>
          <p className="text-slate-400 text-[10px] font-mono">
            {this.state.error?.message || 'A rendering exception occurred in the transcription panel.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="skeuo-btn-cyan px-3 py-1.5 text-xs font-bold font-mono rounded uppercase cursor-pointer"
          >
            RELOAD TRANSCRIPT PANEL
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface TranscribePanelProps {
  selectedFile: { name: string; path: string } | null;
  currentTime: number;
  duration: number;
  onSeekToTime: (timeSec: number) => void;
  transcriptSegments?: TranscriptSegment[];
  onTranscriptSegmentsChange: (segments: TranscriptSegment[]) => void;
  transcriptModel: 'tiny' | 'base' | 'turbo';
  onTranscriptModelChange: (model: 'tiny' | 'base' | 'turbo') => void;
  transcriptLanguage: string;
  onTranscriptLanguageChange: (lang: string) => void;
  transcriptStatusText: string;
  onTranscriptStatusTextChange: (status: string) => void;
  transcriptProgress: number;
  onTranscriptProgressChange: (prog: number) => void;
  onResetTranscript: () => void;
}

const formatTimestamp = (seconds?: number): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
};

const formatSrtTime = (seconds?: number): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '00:00:00,000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
};

const formatVttTime = (seconds?: number): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '00:00:00.000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const buildSrtContent = (segments: TranscriptSegment[]): string => {
  if (!Array.isArray(segments)) return '';
  return segments
    .filter(Boolean)
    .map((seg, idx) => {
      return `${idx + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text || ''}\n`;
    })
    .join('\n');
};

const buildVttContent = (segments: TranscriptSegment[]): string => {
  if (!Array.isArray(segments)) return 'WEBVTT\n\n';
  const header = 'WEBVTT\n\n';
  const body = segments
    .filter(Boolean)
    .map((seg, idx) => {
      return `${idx + 1}\n${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n${seg.text || ''}\n`;
    })
    .join('\n');
  return header + body;
};

interface TranscriptSegmentRowProps {
  seg: TranscriptSegment;
  isCurrent: boolean;
  onSeekToTime: (timeSec: number) => void;
  activeRef?: React.Ref<HTMLDivElement>;
}

const TranscriptSegmentRow: React.FC<TranscriptSegmentRowProps> = React.memo(
  ({ seg, isCurrent, onSeekToTime, activeRef }) => {
    return (
      <div
        ref={activeRef}
        onClick={() => onSeekToTime(seg.start || 0)}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '40px' }}
        className={`p-2 rounded-[4px] text-xs cursor-pointer transition-all border ${
          isCurrent
            ? 'bg-[var(--segment-active-bg)] border-[var(--segment-active-border)] text-[var(--text-accent-bright)] shadow-sm'
            : 'bg-[var(--segment-idle-bg)] hover:bg-[var(--segment-idle-hover)] border-[var(--border-default)] text-[var(--text-primary)] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] text-amber-400 font-black flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" strokeWidth={2.4} />
            [{formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}]
          </span>
          {isCurrent && (
            <span className="text-[8px] bg-gradient-to-r from-amber-400 to-amber-500 text-black px-1.5 rounded-[2px] font-mono font-black uppercase shadow-sm">
              ACTIVE
            </span>
          )}
        </div>
        <p className="leading-snug text-slate-100 font-sans">{seg.text || ''}</p>
      </div>
    );
  }
);

const TranscribePanelInternal: React.FC<TranscribePanelProps> = ({
  selectedFile,
  currentTime,
  duration,
  onSeekToTime,
  transcriptSegments = [],
  onTranscriptSegmentsChange,
  transcriptModel,
  onTranscriptModelChange,
  transcriptLanguage,
  onTranscriptLanguageChange,
  transcriptStatusText,
  onTranscriptStatusTextChange,
  transcriptProgress,
  onTranscriptProgressChange,
  onResetTranscript,
}) => {
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  const safeSegments = useMemo(() => {
    return Array.isArray(transcriptSegments) ? transcriptSegments.filter(Boolean) : [];
  }, [transcriptSegments]);

  const activeSegmentId = useMemo(() => {
    if (!safeSegments.length) return null;
    const found = safeSegments.find((s) => currentTime >= (s.start || 0) && currentTime <= (s.end || 0));
    return found ? found.id : null;
  }, [currentTime, safeSegments]);

  const lastScrolledId = useRef<string | number | null>(null);

  useEffect(() => {
    if (activeSegmentId && activeSegmentId !== lastScrolledId.current && activeSegmentRef.current) {
      lastScrolledId.current = activeSegmentId;
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentId]);

  useEffect(() => {
    if (window.electron?.onTranscribeProgress) {
      const unsub = window.electron.onTranscribeProgress((data: TranscribeProgressData) => {
        if (typeof data?.progress === 'number') {
          onTranscriptProgressChange(data.progress);
        }
        if (data?.status) {
          onTranscriptStatusTextChange(data.status);
        }
      });
      return unsub;
    }
  }, [onTranscriptProgressChange, onTranscriptStatusTextChange]);

  const handleTranscribe = async () => {
    if (!selectedFile) return;
    setIsTranscribing(true);
    onTranscriptProgressChange(5);
    onTranscriptStatusTextChange('Starting speech recognition model...');
    setSavedNotice(null);

    try {
      if (window.electron?.transcribeAudio) {
        const res = await window.electron.transcribeAudio({
          inputFile: selectedFile.path,
          model: transcriptModel,
          language: transcriptLanguage,
          duration,
        });

        if (res?.success) {
          const rawSegs = Array.isArray(res.segments) ? res.segments : [];
          const segs = rawSegs.filter(
            (s) => s?.text && !/^[.\s,\-_!?:;'"…·•~]+$/.test(s.text.trim())
          );
          onTranscriptSegmentsChange(segs);
          onTranscriptStatusTextChange(`Completed (${segs.length} segments recognized)`);
          onTranscriptProgressChange(100);
        } else {
          onTranscriptStatusTextChange(res?.message || 'Transcription error');
        }
      }
    } catch (err: unknown) {
      console.error('Transcription error:', err);
      const rawMsg = err instanceof Error ? err.message : 'Transcription error';
      const msg = rawMsg.replace(/^Error invoking remote method '[^']+':\s*/, '');
      onTranscriptStatusTextChange(msg);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleReset = () => {
    onResetTranscript();
    setSearchQuery('');
    setSavedNotice(null);
  };

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return safeSegments;
    const q = searchQuery.toLowerCase();
    return safeSegments.filter((s) => (s?.text || '').toLowerCase().includes(q));
  }, [safeSegments, searchQuery]);

  const [visibleCount, setVisibleCount] = useState<number>(60);

  useEffect(() => {
    setVisibleCount(60);
  }, [searchQuery]);

  useEffect(() => {
    if (activeSegmentId) {
      const idx = filteredSegments.findIndex((s) => s.id === activeSegmentId);
      if (idx >= 0 && idx + 20 > visibleCount) {
        setVisibleCount((prev) => Math.max(prev, Math.min(filteredSegments.length, idx + 60)));
      }
    }
  }, [activeSegmentId, filteredSegments, visibleCount]);

  const handleTranscriptScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 250) {
      setVisibleCount((prev) => Math.min(filteredSegments.length, prev + 60));
    }
  }, [filteredSegments.length]);

  const displayedSegments = useMemo(() => {
    return filteredSegments.slice(0, visibleCount);
  }, [filteredSegments, visibleCount]);

  const handleCopyText = async () => {
    if (safeSegments.length === 0) return;
    const full = safeSegments
      .map((s) => `[${formatTimestamp(s.start)}] ${s.text || ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy text', e);
    }
  };

  const handleExportSrt = async () => {
    if (safeSegments.length === 0 || !selectedFile) return;
    const srt = buildSrtContent(safeSegments);
    const base = selectedFile.name.replace(/\.[^/.]+$/, '');
    const defaultName = `${base}_subtitles.srt`;

    if (window.electron?.saveSubtitleFile) {
      const res = await window.electron.saveSubtitleFile({
        content: srt,
        defaultName,
        ext: 'srt',
      });
      if (res?.success) {
        setSavedNotice(`Subtitles saved as .SRT`);
        setTimeout(() => setSavedNotice(null), 3000);
      }
    }
  };

  const handleExportVtt = async () => {
    if (safeSegments.length === 0 || !selectedFile) return;
    const vtt = buildVttContent(safeSegments);
    const base = selectedFile.name.replace(/\.[^/.]+$/, '');
    const defaultName = `${base}_subtitles.vtt`;

    if (window.electron?.saveSubtitleFile) {
      const res = await window.electron.saveSubtitleFile({
        content: vtt,
        defaultName,
        ext: 'vtt',
      });
      if (res?.success) {
        setSavedNotice(`Subtitles saved as .VTT`);
        setTimeout(() => setSavedNotice(null), 3000);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3 pr-0.5 pb-2 select-none">
      {/* 1. Model & Language Configuration Plate with Master Engage Switch */}
      <div className="console-panel p-2.5 space-y-2.5">
        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            WHISPER AI ENGINE
          </span>
          <span className="text-[8px] text-amber-300 font-mono font-bold panel-inset px-1.5 py-0.2 rounded-[2px] border border-[var(--border-subtle)]">
            OPENAI
          </span>
        </div>

        {/* Model Segmented Group */}
        <div>
          <label className="text-[8.5px] font-mono font-bold text-[var(--text-secondary)] uppercase block mb-1">
            NEURAL MODEL
          </label>
          <div className="w-full grid grid-cols-3 gap-[1px] panel-inset p-[1px] rounded-[2px] border border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={isTranscribing}
              onClick={() => onTranscriptModelChange('tiny')}
              className={`h-5 text-[9px] font-mono font-bold transition-all cursor-pointer ${
                transcriptModel === 'tiny'
                  ? 'chip-badge-accent font-black'
                  : 'bg-[var(--bg-panel-sub)] text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              TINY (FAST)
            </button>
            <button
              type="button"
              disabled={isTranscribing}
              onClick={() => onTranscriptModelChange('base')}
              className={`h-5 text-[9px] font-mono font-bold transition-all cursor-pointer ${
                transcriptModel === 'base'
                  ? 'chip-badge-accent font-black'
                  : 'bg-[var(--bg-panel-sub)] text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              BASE (BALANCED)
            </button>
            <button
              type="button"
              disabled={isTranscribing}
              onClick={() => onTranscriptModelChange('turbo')}
              className={`h-5 text-[9px] font-mono font-bold transition-all cursor-pointer ${
                transcriptModel === 'turbo'
                  ? 'chip-badge-accent font-black'
                  : 'bg-[var(--bg-panel-sub)] text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              TURBO (STUDIO)
            </button>
          </div>
        </div>

        {/* Language Selector Dropdown */}
        <div>
          <label className="text-[8.5px] font-mono font-bold text-[var(--text-secondary)] uppercase block mb-1">
            SPOKEN LANGUAGE
          </label>
          <select
            value={transcriptLanguage}
            disabled={isTranscribing}
            onChange={(e) => onTranscriptLanguageChange(e.target.value)}
            className="w-full panel-inset border border-[var(--border-subtle)] rounded-[2px] px-2 py-1 text-xs font-mono font-bold text-slate-200 outline-none shadow-inner"
          >
            <option value="auto">Auto-Detect Language</option>
            <option value="en">English (en)</option>
            <option value="it">Italian (it)</option>
            <option value="es">Spanish (es)</option>
            <option value="fr">French (fr)</option>
            <option value="de">German (de)</option>
            <option value="pt">Portuguese (pt)</option>
            <option value="ja">Japanese (ja)</option>
          </select>
        </div>

        {/* Master Engage Whisper Engine Push-Switch */}
        <div className="panel-inset p-1 mt-2">
          <button
            type="button"
            disabled={isTranscribing || !selectedFile}
            onClick={handleTranscribe}
            className={`btn-actuator ${isTranscribing ? 'is-active is-engaged opacity-90' : ''} ${!selectedFile ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-center gap-2">
              {isTranscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span className="font-sans font-bold text-xs tracking-wider">
                    TRANSCRIBING AUDIO ({Math.round(transcriptProgress)}%)...
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-sans font-bold text-xs tracking-wider text-amber-200 group-hover:text-white">
                    TRANSCRIBE VOICE (WHISPER)
                  </span>
                </>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 3. Real-time Status & Progress LCD */}
      <div className="panel-surface border border-[var(--border-default)] rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-400/90 uppercase tracking-wider">
          <span>PROCESSING STATUS</span>
          {isTranscribing && (
            <span className="text-amber-400 font-mono text-[9px] font-bold flex items-center gap-1">
              LIVE
            </span>
          )}
        </div>

        {/* Recessed Dark LCD Screen */}
        <div
          title={transcriptStatusText}
          className="panel-inset border border-[var(--border-default)] rounded-[4px] p-2.5 w-full flex items-center justify-between text-xs font-mono shadow-inner cursor-help"
        >
          <span
            className={`truncate mr-2 ${
              transcriptStatusText.toLowerCase().includes('error') ||
              transcriptStatusText.toLowerCase().includes('non trovat')
                ? 'text-rose-300 font-semibold'
                : 'text-slate-200'
            }`}
          >
            {transcriptStatusText}
          </span>
          <span
            className={`font-bold shrink-0 ${
              transcriptStatusText.toLowerCase().includes('error') ||
              transcriptStatusText.toLowerCase().includes('non trovat')
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}
          >
            {Math.round(transcriptProgress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="panel-inset h-2 p-0.5 rounded-[3px] border border-[var(--border-default)] overflow-hidden">
          <div
            className={`h-full rounded-[2px] transition-all duration-300 ${
              transcriptStatusText.toLowerCase().includes('error') ||
              transcriptStatusText.toLowerCase().includes('non trovat')
                ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 shadow-glow-rose'
                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 shadow-glow-amber'
            }`}
            style={{ width: `${Math.max(transcriptProgress > 0 ? 5 : 0, transcriptProgress)}%` }}
          />
        </div>
      </div>

      {/* 4. Subtitle Editor & Synchronized Transcript */}
      <div className="panel-surface border border-[var(--border-default)] rounded-lg p-3 flex-1 flex flex-col min-h-[220px] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-400/90 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-amber-400" strokeWidth={2.4} />
            <span>SYNCHRONIZED TRANSCRIPT</span>
          </div>
          {safeSegments.length > 0 && (
            <span className="text-[9px] panel-inset border border-[var(--border-default)] text-amber-300 px-2 py-0.5 rounded-[3px] font-mono font-bold">
              {filteredSegments.length} / {safeSegments.length}
            </span>
          )}
        </div>

        {/* Search Bar */}
        {safeSegments.length > 0 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" strokeWidth={2.4} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript keywords..."
              className="w-full pl-8 pr-2.5 py-1 text-xs panel-inset border border-[var(--border-default)] rounded-[4px] text-slate-200 font-sans placeholder-slate-500 outline-none"
            />
          </div>
        )}

        {/* Transcript Rows Box (Recessed Well) */}
        <div
          onScroll={handleTranscriptScroll}
          className="h-[170px] min-h-[140px] max-h-[220px] panel-inset border border-[var(--border-default)] p-2 rounded-[4px] overflow-y-auto space-y-1 text-slate-200 scroll-smooth skeuo-scrollbar shadow-inner"
        >
          {safeSegments.length > 0 ? (
            filteredSegments.length > 0 ? (
              <>
                {displayedSegments.map((seg) => (
                  <TranscriptSegmentRow
                    key={`seg-${seg.id}`}
                    seg={seg}
                    isCurrent={activeSegmentId === seg.id}
                    onSeekToTime={onSeekToTime}
                    activeRef={activeSegmentId === seg.id ? activeSegmentRef : undefined}
                  />
                ))}
                {filteredSegments.length > visibleCount && (
                  <div className="py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => Math.min(filteredSegments.length, prev + 100))}
                      className="text-[9px] font-mono font-bold text-amber-400 hover:text-amber-300 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 transition-colors cursor-pointer"
                    >
                      + Show more ({filteredSegments.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                <p className="text-xs font-mono text-slate-400">No matching transcript segments found.</p>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400 space-y-2">
              <FileAudio className="w-7 h-7 text-slate-600 mb-0.5" strokeWidth={2.2} />
              <p className="text-xs font-mono font-bold text-slate-300 uppercase">NO TRANSCRIPT GENERATED YET</p>
              <p className="text-[10px] text-slate-500">
                Click the button below to transcribe spoken voice into synchronized subtitles.
              </p>
              <button
                type="button"
                disabled={isTranscribing || !selectedFile}
                onClick={handleTranscribe}
                className="btn-actuator h-8 px-4 text-xs font-sans font-bold uppercase rounded-[3px] cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                START WHISPER TRANSCRIPTION
              </button>
            </div>
          )}
        </div>

        {/* Subtitle Export & Copy Toolbar */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            type="button"
            disabled={safeSegments.length === 0}
            onClick={handleExportSrt}
            className="py-1 px-1.5 text-[10px] font-mono font-bold gap-1 bg-[var(--bg-panel-sub)] border border-slate-700/60 text-slate-300 hover:bg-[var(--bg-panel-hover)] hover:text-white rounded-[4px] cursor-pointer flex items-center justify-center transition-all disabled:opacity-30"
            title="Export SubRip subtitles (.srt)"
          >
            <Download className="w-3 h-3 text-amber-400" strokeWidth={2.4} />
            <span>.SRT</span>
          </button>

          <button
            type="button"
            disabled={safeSegments.length === 0}
            onClick={handleExportVtt}
            className="py-1 px-1.5 text-[10px] font-mono font-bold gap-1 bg-[var(--bg-panel-sub)] border border-slate-700/60 text-slate-300 hover:bg-[var(--bg-panel-hover)] hover:text-white rounded-[4px] cursor-pointer flex items-center justify-center transition-all disabled:opacity-30"
            title="Export WebVTT subtitles (.vtt)"
          >
            <Download className="w-3 h-3 text-amber-400" strokeWidth={2.4} />
            <span>.VTT</span>
          </button>

          <button
            type="button"
            disabled={safeSegments.length === 0}
            onClick={handleCopyText}
            className="py-1 px-1.5 text-[10px] font-mono font-bold gap-1 bg-[var(--bg-panel-sub)] border border-slate-700/60 text-slate-300 hover:bg-[var(--bg-panel-hover)] hover:text-white rounded-[4px] cursor-pointer flex items-center justify-center transition-all disabled:opacity-30"
            title="Copy full text to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-amber-400" strokeWidth={2.4} />
                <span className="text-amber-400">COPIED</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" strokeWidth={2.4} />
                <span>COPY</span>
              </>
            )}
          </button>
        </div>

        {savedNotice && (
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold text-amber-400 text-center">
            <Check className="w-3 h-3 text-amber-400" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Clear & Reset Button */}
        {safeSegments.length > 0 && (
          <button
            type="button"
            disabled={isTranscribing}
            onClick={handleReset}
            className="w-full mt-2 py-1.5 px-3 bg-red-950/60 border border-red-700/60 text-red-300 hover:bg-red-900/80 rounded-[4px] flex items-center justify-center gap-1.5 uppercase font-mono text-[10px] font-bold disabled:opacity-40 cursor-pointer"
            title="Clear current transcript and start over"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" strokeWidth={2.4} />
            <span>CLEAR TRANSCRIPT & RESTART</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const TranscribePanel: React.FC<TranscribePanelProps> = (props) => (
  <TranscribeErrorBoundary>
    <TranscribePanelInternal {...props} />
  </TranscribeErrorBoundary>
);

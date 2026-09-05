import React, { Component, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface TranscribeErrorBoundaryProps {
  children: React.ReactNode;
}

interface TranscribeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class TranscribeErrorBoundary extends Component<
  TranscribeErrorBoundaryProps,
  TranscribeErrorBoundaryState
> {
  constructor(props: TranscribeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): TranscribeErrorBoundaryState {
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

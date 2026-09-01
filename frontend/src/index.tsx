import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Layout from './components/Layout';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[var(--bg-chassis)] text-white p-8 text-center select-none font-sans">
          <div className="skeuo-card p-6 max-w-lg border border-red-500/50 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-red-400">Application Runtime Notice</h2>
            <p className="text-xs text-[var(--text-muted)] font-mono whitespace-pre-wrap text-left bg-black/60 p-3 rounded overflow-auto max-h-48 border border-zinc-800">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="skeuo-btn px-4 py-2 text-xs font-bold text-emerald-600"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root') as HTMLElement;

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <Layout />
    </ErrorBoundary>
  );
} else {
  console.error('Root element not found');
}

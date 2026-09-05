import { useState, useEffect } from 'react';

interface UseSystemIpcListenersOptions {
  refreshDependencies: () => Promise<void>;
  setExportPath: (path: string) => void;
  setAnalysisProgress: (progress: number) => void;
}

export const useSystemIpcListeners = ({
  refreshDependencies,
  setExportPath,
  setAnalysisProgress,
}: UseSystemIpcListenersOptions) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    const initSystem = async () => {
      try {
        if (window.electron) {
          await refreshDependencies();
          const defaultFolder = await window.electron.getAppDataPath();
          if (isMounted && defaultFolder) {
            setExportPath(defaultFolder);
          }
        }
      } catch (err) {
        console.error('System init error:', err);
      }
    };

    initSystem();

    let unsubOutput: (() => void) | undefined;
    let unsubProg: (() => void) | undefined;
    let unsubPrevProg: (() => void) | undefined;

    if (window.electron?.onCommandOutput) {
      unsubOutput = window.electron.onCommandOutput((chunk: string) => {
        if (isMounted) setLogs((prev) => [...prev, chunk]);
      });
    }

    if (window.electron?.onCommandProgress) {
      unsubProg = window.electron.onCommandProgress((prog: number) => {
        if (isMounted) setProgress(prog);
      });
    }

    if (window.electron?.onPreviewProgress) {
      unsubPrevProg = window.electron.onPreviewProgress((prog: number) => {
        if (isMounted) setAnalysisProgress(prog);
      });
    }

    return () => {
      isMounted = false;
      if (unsubOutput) unsubOutput();
      if (unsubProg) unsubProg();
      if (unsubPrevProg) unsubPrevProg();
    };
  }, [refreshDependencies, setExportPath, setAnalysisProgress]);

  return {
    logs,
    setLogs,
    progress,
    setProgress,
  };
};

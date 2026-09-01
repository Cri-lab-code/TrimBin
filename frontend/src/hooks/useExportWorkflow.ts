import { useState, useMemo, useCallback } from 'react';
import { SelectedFile } from '@/global';
import { SilenceSettings, CutRange } from '../types/timeline';

export const getOutputExtension = (format: string, inputPath?: string): string => {
  switch (format) {
    case 'final-cut-pro':
    case 'resolve-fcpxml':
    case 'davinci-fcpxml':
      return '.fcpxml';
    case 'davinci':
    case 'davinci-xml':
    case 'resolve':
    case 'resolve-fcp7':
    case 'premiere':
      return '.xml';
    case 'kdenlive':
      return '.kdenlive';
    case 'shotcut':
      return '.mlt';
    case 'clipchamp':
      return '.json';
    case 'audio':
      return '.wav';
    case 'json':
      return '.json';
    default:
      if (inputPath) {
        const match = inputPath.match(/\.[^/.]+$/);
        if (match) return match[0];
      }
      return '.mp4';
  }
};

export interface ExportAlert {
  message: string;
  type: 'normal' | 'error' | 'success' | null;
  filePath?: string;
}

export interface UseExportWorkflowProps {
  selectedFile: SelectedFile | null;
  silenceSettings: SilenceSettings;
  cutRanges: CutRange[];
}

export interface UseExportWorkflowReturn {
  exportPath: string;
  setExportPath: React.Dispatch<React.SetStateAction<string>>;
  exportAs: string;
  setExportAs: React.Dispatch<React.SetStateAction<string>>;
  videoCodec: string;
  setVideoCodec: React.Dispatch<React.SetStateAction<string>>;
  audioCodec: string;
  setAudioCodec: React.Dispatch<React.SetStateAction<string>>;
  videoQualityCrf: number;
  setVideoQualityCrf: React.Dispatch<React.SetStateAction<number>>;
  audioTrackMode: 'mix' | 'separate';
  setAudioTrackMode: React.Dispatch<React.SetStateAction<'mix' | 'separate'>>;
  openWhenDone: boolean;
  setOpenWhenDone: React.Dispatch<React.SetStateAction<boolean>>;
  commandString: string;
  alert: ExportAlert | null;
  setAlert: React.Dispatch<React.SetStateAction<ExportAlert | null>>;
  runExport: (setIsProcessing: (val: boolean) => void, setProgress: (val: number) => void) => Promise<void>;
}

export function useExportWorkflow({
  selectedFile,
  silenceSettings,
  cutRanges,
}: UseExportWorkflowProps): UseExportWorkflowReturn {
  const [exportPath, setExportPath] = useState('');
  const [exportAs, setExportAs] = useState('premiere');
  const [videoCodec, setVideoCodec] = useState('auto');
  const [audioCodec, setAudioCodec] = useState('auto');
  const [videoQualityCrf, setVideoQualityCrf] = useState(21);
  const [audioTrackMode, setAudioTrackMode] = useState<'mix' | 'separate'>('mix');
  const [openWhenDone, setOpenWhenDone] = useState(false);
  const [alert, setAlert] = useState<ExportAlert | null>(null);

  const commandString = useMemo(() => {
    if (!selectedFile) {
      return 'auto-editor <input-file> --export premiere --margin 0.2s --edit audio:threshold=-25dB -o <output-path>';
    }
    const baseExt = getOutputExtension(exportAs, selectedFile.path);
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}_edited${baseExt}`;
    const fullOut = exportPath ? `${exportPath}/${outName}` : outName;

    const parts = ['auto-editor', `"${selectedFile.path}"`, '--export', exportAs];

    if (silenceSettings.isPaddingLinked || silenceSettings.paddingLeft === silenceSettings.paddingRight) {
      parts.push('--margin', `${silenceSettings.paddingLeft}s`);
    } else {
      parts.push('--margin', `"${silenceSettings.paddingLeft}s,${silenceSettings.paddingRight}s"`);
    }

    if (cutRanges.length > 0) {
      parts.push('--edit', 'none');
      const maxDisplayCuts = Math.min(cutRanges.length, 10);
      for (let i = 0; i < maxDisplayCuts; i++) {
        parts.push('--cut-out', `"${cutRanges[i].start}s,${cutRanges[i].end}s"`);
      }
      if (cutRanges.length > 10) {
        parts.push(`... (+${cutRanges.length - 10} cuts)`);
      }
    } else if (silenceSettings.isAutoThreshold) {
      parts.push('--edit', 'audio');
    } else {
      parts.push('--edit', `audio:threshold=${silenceSettings.threshold}dB`);
    }

    if (videoCodec !== 'auto') {
      parts.push('--video-codec', videoCodec);
    }
    if (audioCodec !== 'auto') {
      parts.push('--audio-codec', audioCodec);
    }
    if (!openWhenDone) {
      parts.push('--no-open');
    }
    parts.push('-o', `"${fullOut}"`);

    return parts.join(' ');
  }, [selectedFile, exportAs, silenceSettings, videoCodec, audioCodec, openWhenDone, exportPath, cutRanges]);

  const runExport = useCallback(
    async (setIsProcessing: (val: boolean) => void, setProgress: (val: number) => void) => {
      if (!selectedFile) {
        setAlert({
          message: 'Seleziona prima un file video da elaborare.',
          type: 'error',
        });
        return;
      }

      setIsProcessing(true);
      setProgress(0);
      setAlert(null);

      const baseExt = getOutputExtension(exportAs, selectedFile.path);
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const outName = `${baseName}_edited${baseExt}`;
      const fullOut = exportPath ? `${exportPath}/${outName}` : outName;

      const customExportArgs: string[] = [];

      if (cutRanges.length > 0) {
        for (const cut of cutRanges) {
          customExportArgs.push('--cut-out', `${cut.start}s,${cut.end}s`);
        }
      }
      if (audioTrackMode === 'mix') {
        customExportArgs.push('--mix-audio-streams');
      }

      try {
        const result = await window.electron.runCommand({
          inputFile: selectedFile.path,
          exportFormat: exportAs,
          ...silenceSettings,
          loudness: silenceSettings.threshold,
          margin: silenceSettings.paddingLeft,
          videoCodec,
          audioCodec,
          openWhenDone,
          outputFolder: exportPath,
          outputFilePath: fullOut,
          customArgs: customExportArgs,
        });

        if (result.success) {
          const isResolve = exportAs === 'davinci';
          setAlert({
            message: isResolve
              ? 'Esportato per DaVinci Resolve! In DaVinci: apri un progetto e premi Cmd+Shift+I (o trascina il file nel Media Pool).'
              : `Esportazione completata con successo! Salvato in: ${fullOut}`,
            type: 'success',
            filePath: fullOut,
          });
        } else {
          setAlert({
            message: result.message || "Errore durante l'esportazione.",
            type: 'error',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Errore imprevisto durante l'elaborazione.";
        console.error('Export execution error:', err);
        setAlert({
          message,
          type: 'error',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedFile, exportAs, exportPath, silenceSettings, videoCodec, audioCodec, openWhenDone, cutRanges, audioTrackMode]
  );

  return {
    exportPath,
    setExportPath,
    exportAs,
    setExportAs,
    videoCodec,
    setVideoCodec,
    audioCodec,
    setAudioCodec,
    videoQualityCrf,
    setVideoQualityCrf,
    audioTrackMode,
    setAudioTrackMode,
    openWhenDone,
    setOpenWhenDone,
    commandString,
    alert,
    setAlert,
    runExport,
  };
}

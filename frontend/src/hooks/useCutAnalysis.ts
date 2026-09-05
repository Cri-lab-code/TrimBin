import { useState, useCallback, RefObject } from 'react';
import { SelectedFile } from '@/global';
import { SilenceSettings, SilenceSlice } from '../types/timeline';
import { convertCutsToSilenceSlices } from '../utils/timelineEngine';
import { calibrateAudioSilence } from '../utils/audioCalibration';

interface UseCutAnalysisOptions {
  selectedFile: SelectedFile | null;
  sourceDuration: number;
  silenceSettings: SilenceSettings;
  setSilenceSettings: React.Dispatch<React.SetStateAction<SilenceSettings>>;
  setFps: (fps: number) => void;
  setInitialSilenceAnalysis: (slices: SilenceSlice[]) => void;
  setSilenceAnalysis: (slices: SilenceSlice[]) => void;
  setSmartSkipOn: (val: boolean) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  setSourceCurrentTime: (time: number) => void;
  setAlert: (alert: { message: string; type: 'error' | 'success'; filePath?: string } | null) => void;
}

export const useCutAnalysis = ({
  selectedFile,
  sourceDuration,
  silenceSettings,
  setSilenceSettings,
  setFps,
  setInitialSilenceAnalysis,
  setSilenceAnalysis,
  setSmartSkipOn,
  videoRef,
  setSourceCurrentTime,
  setAlert,
}: UseCutAnalysisOptions) => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  const handleAnalyzeCuts = useCallback(
    async (isInitialBaseline: boolean = false, overrideFilePath?: string) => {
      const targetPath = overrideFilePath || selectedFile?.path;
      if (!targetPath) return;

      setIsAnalyzing(true);
      setAnalysisProgress(10);

      try {
        const res = await window.electron.analyzeCuts({
          inputFile: targetPath,
          duration: sourceDuration,
          ...silenceSettings,
          loudness: silenceSettings.threshold,
          margin: silenceSettings.paddingLeft,
        });

        if (res.success && res.timeline) {
          setFps(res.timeline.fps || 30);
          const dur = sourceDuration > 0 ? sourceDuration : res.timeline.originalDuration;

          const slices = convertCutsToSilenceSlices(res.timeline.silenceCuts, dur);
          if (isInitialBaseline) {
            setInitialSilenceAnalysis(slices);
          } else {
            setSilenceAnalysis(slices);
          }
          setSmartSkipOn(true);

          if (res.timeline.segments.length > 0 && videoRef.current) {
            const firstIn = res.timeline.segments[0].inSec;
            videoRef.current.currentTime = firstIn;
            setSourceCurrentTime(firstIn);
          }
        }
      } catch (err: unknown) {
        console.error('Analyze cuts error:', err);
        setAlert({
          message: err instanceof Error ? err.message : 'Cut analysis failed.',
          type: 'error',
        });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [
      selectedFile,
      silenceSettings,
      sourceDuration,
      setSilenceAnalysis,
      setInitialSilenceAnalysis,
      setFps,
      setSmartSkipOn,
      videoRef,
      setSourceCurrentTime,
      setAlert,
    ]
  );

  const handleAutoCalibrateThreshold = useCallback(
    async (filePathToCalibrate?: string, isInitialBaseline: boolean = false) => {
      const targetPath = filePathToCalibrate || selectedFile?.path;
      if (!targetPath) return;

      setIsCalibrating(true);
      await new Promise((resolve) => setTimeout(resolve, 25));

      try {
        const calibration = await calibrateAudioSilence(targetPath);
        const roundedDb = typeof calibration === 'object' ? calibration.db : Math.round(calibration);

        const newSettings = {
          ...silenceSettings,
          threshold: roundedDb,
          isAutoThreshold: true,
        };
        setSilenceSettings(newSettings);

        setIsAnalyzing(true);
        setAnalysisProgress(15);

        try {
          const res = await window.electron.analyzeCuts({
            inputFile: targetPath,
            duration: sourceDuration,
            ...newSettings,
            loudness: roundedDb,
            margin: newSettings.paddingLeft,
          });

          if (res.success && res.timeline) {
            setFps(res.timeline.fps || 30);
            const dur = sourceDuration > 0 ? sourceDuration : res.timeline.originalDuration;
            const slices = convertCutsToSilenceSlices(res.timeline.silenceCuts, dur);

            if (isInitialBaseline) {
              setInitialSilenceAnalysis(slices);
            } else {
              setSilenceAnalysis(slices);
            }
            setSmartSkipOn(true);

            if (res.timeline.segments.length > 0 && videoRef.current) {
              const firstIn = res.timeline.segments[0].inSec;
              videoRef.current.currentTime = firstIn;
              setSourceCurrentTime(firstIn);
            }
          }
        } catch (err: unknown) {
          console.error('Analyze cuts error after auto-calibration:', err);
          setAlert({
            message:
              err instanceof Error ? err.message : 'Silence re-analysis failed after auto-calibration.',
            type: 'error',
          });
        } finally {
          setIsAnalyzing(false);
        }
      } catch (err) {
        console.error('Auto-calibration error:', err);
      } finally {
        setTimeout(() => {
          setIsCalibrating(false);
        }, 150);
      }
    },
    [
      selectedFile,
      silenceSettings,
      setSilenceSettings,
      sourceDuration,
      setSilenceAnalysis,
      setInitialSilenceAnalysis,
      setFps,
      setSmartSkipOn,
      videoRef,
      setSourceCurrentTime,
      setAlert,
    ]
  );

  return {
    isAnalyzing,
    analysisProgress,
    setAnalysisProgress,
    isCalibrating,
    handleAnalyzeCuts,
    handleAutoCalibrateThreshold,
  };
};

import { useEffect } from 'react';

export interface UseAppHotkeysProps {
  togglePlay: () => void;
  splitClip: (sourceTimeSec: number) => void;
  toggleDeleteSelectedClip: (clipId?: string) => void;
  selectedClipId: string | null;
  sourceCurrentTime: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  jumpNextCut: () => void;
  jumpPrevCut: () => void;
}

export function useAppHotkeys({
  togglePlay,
  splitClip,
  toggleDeleteSelectedClip,
  selectedClipId,
  sourceCurrentTime,
  canUndo,
  canRedo,
  undo,
  redo,
  jumpNextCut,
  jumpPrevCut,
}: UseAppHotkeysProps): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Prevent accidental browser reload
      if (
        (isCmdOrCtrl && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) ||
        e.code === 'F5' ||
        e.key === 'F5'
      ) {
        e.preventDefault();
        return;
      }

      // Undo
      if (isCmdOrCtrl && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ') && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
        return;
      }

      // Redo
      if (
        (isCmdOrCtrl && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ') && e.shiftKey) ||
        (isCmdOrCtrl && (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY'))
      ) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }

      // Space -> Toggle Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyB' || e.code === 'KeyS') {
        // B or S -> Razor Blade Split
        e.preventDefault();
        splitClip(sourceCurrentTime);
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        // Delete / Backspace -> Ripple Delete Selected Clip
        if (selectedClipId) {
          e.preventDefault();
          toggleDeleteSelectedClip(selectedClipId);
        }
      } else if (e.code === 'ArrowRight' && e.shiftKey) {
        // Shift + Right -> Next Cut
        e.preventDefault();
        jumpNextCut();
      } else if (e.code === 'ArrowLeft' && e.shiftKey) {
        // Shift + Left -> Prev Cut
        e.preventDefault();
        jumpPrevCut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    togglePlay,
    splitClip,
    toggleDeleteSelectedClip,
    selectedClipId,
    sourceCurrentTime,
    jumpNextCut,
    jumpPrevCut,
  ]);
}

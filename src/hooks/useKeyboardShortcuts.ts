import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcutsOptions {
  onTogglePlayPause: () => void;
  onNextSentence: () => void;
  onPrevSentence: () => void;
  onIncreaseSpeed: () => void;
  onDecreaseSpeed: () => void;
  onShowHelp: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts for TTS playback control.
 * Shortcuts are ignored when the user is typing in an input field (input, textarea, select, or contentEditable).
 */
export function useKeyboardShortcuts({
  onTogglePlayPause,
  onNextSentence,
  onPrevSentence,
  onIncreaseSpeed,
  onDecreaseSpeed,
  onShowHelp,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handlersRef = useRef({
    onTogglePlayPause,
    onNextSentence,
    onPrevSentence,
    onIncreaseSpeed,
    onDecreaseSpeed,
    onShowHelp,
  });

  // Keep handlers ref up to date without re-attaching listener
  useEffect(() => {
    handlersRef.current = {
      onTogglePlayPause,
      onNextSentence,
      onPrevSentence,
      onIncreaseSpeed,
      onDecreaseSpeed,
      onShowHelp,
    };
  }, [onTogglePlayPause, onNextSentence, onPrevSentence, onIncreaseSpeed, onDecreaseSpeed, onShowHelp]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore when typing in input fields
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    const handlers = handlersRef.current;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        handlers.onTogglePlayPause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handlers.onNextSentence();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handlers.onPrevSentence();
        break;
      case 'ArrowUp':
        e.preventDefault();
        handlers.onIncreaseSpeed();
        break;
      case 'ArrowDown':
        e.preventDefault();
        handlers.onDecreaseSpeed();
        break;
      case '?':
        handlers.onShowHelp();
        break;
    }
  }, [enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

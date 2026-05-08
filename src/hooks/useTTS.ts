import { useState, useCallback, useEffect, useRef } from 'react';
import { TTSState } from '../lib/types';

export function useTTS(initialSentence: number = 0) {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentSentence: initialSentence,
    speed: (() => {
      const saved = localStorage.getItem('open-reader-tts-speed');
      return saved ? parseFloat(saved) : 1;
    })(),
    selectedVoice: localStorage.getItem('open-reader-tts-voice'),
    sentences: [],
    sleepTimerMinutes: null,
    sleepTimerRemaining: null,
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const _articleTitle = useRef<string>('');

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // MediaSession API - Background Audio
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const nav = navigator as Navigator & { mediaSession: MediaSession };

    // Clear all handlers first to avoid stale listeners
    nav.mediaSession.setActionHandler('play', null);
    nav.mediaSession.setActionHandler('pause', null);
    nav.mediaSession.setActionHandler('seekbackward', null);
    nav.mediaSession.setActionHandler('seekforward', null);
    nav.mediaSession.setActionHandler('stop', null);

    if (state.isPlaying || state.isPaused) {
      nav.mediaSession.metadata = new MediaMetadata({
        title: _articleTitle.current || 'Open Reader',
        artist: 'Open Reader — ElevenReader Alternative',
        album: state.isPlaying ? 'Playing' : 'Paused',
      });

      nav.mediaSession.setActionHandler('play', () => {
        setState(prev => {
          if (prev.isPaused) {
            speechSynthesis.resume();
            return { ...prev, isPlaying: true, isPaused: false };
          } else if (!prev.isPlaying && prev.sentences.length > 0) {
            const text = prev.sentences.slice(prev.currentSentence).join(' ');
            const u = new SpeechSynthesisUtterance(text);
            u.rate = prev.speed;
            speechSynthesis.speak(u);
            return { ...prev, isPlaying: true, isPaused: false };
          }
          return prev;
        });
      });

      nav.mediaSession.setActionHandler('pause', () => pauseRef.current());
      nav.mediaSession.setActionHandler('stop', () => stopRef.current());
      nav.mediaSession.setActionHandler('seekbackward', () => skipBackRef.current());
      nav.mediaSession.setActionHandler('seekforward', () => skipForwardRef.current());
    }
  }, [state.isPlaying, state.isPaused, state.currentSentence, state.sentences, state.speed]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
      if (sleepTickRef.current) { clearInterval(sleepTickRef.current); sleepTickRef.current = null; }
    };
  }, []);

  // Consolidated ref updates — runs every render to keep refs current
  const pauseRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});
  const skipBackRef = useRef<() => void>(() => {});
  const skipForwardRef = useRef<() => void>(() => {});

  useEffect(() => {
    pauseRef.current = pause;
    stopRef.current = stop;
    skipBackRef.current = skipBack;
    skipForwardRef.current = skipForward;
  });

  const _updatePlaybackState = useCallback((playing: boolean, paused: boolean) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : paused ? 'paused' : 'none';
    }
  }, []);

  const speak = useCallback((text: string, startIndex?: number) => {
    speechSynthesis.cancel();

    const sentences = text.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 0);
    if (sentences.length === 0) {
      setState(prev => ({ ...prev, sentences: [], currentSentence: 0, isPlaying: false, isPaused: false }));
      return;
    }

    const startIdx = startIndex !== undefined ? Math.max(0, Math.min(startIndex, sentences.length - 1)) : 0;

    _articleTitle.current = sentences[0]?.substring(0, 60) || '';

    setState(prev => {
      const remainingText = sentences.slice(startIdx).join(' ');
      const utterance = new SpeechSynthesisUtterance(remainingText);

      const voice = window.speechSynthesis.getVoices().find(v => v.name === prev.selectedVoice);
      if (voice) utterance.voice = voice;
      utterance.rate = prev.speed;

      utterance.onend = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
        if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
        if (sleepTickRef.current) clearInterval(sleepTickRef.current);
      };

      utterance.onerror = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
      };

      speechSynthesis.speak(utterance);
      _updatePlaybackState(true, false);

      return {
        ...prev,
        sentences,
        currentSentence: startIdx,
        isPlaying: true,
        isPaused: false,
      };
    });
  }, [_updatePlaybackState]);

  const pause = useCallback(() => {
    speechSynthesis.pause();
    setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
    _updatePlaybackState(false, true);
  }, [_updatePlaybackState]);

  const resume = useCallback(() => {
    speechSynthesis.resume();
    setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    _updatePlaybackState(true, false);
  }, [_updatePlaybackState]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    setState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentSentence: 0, sleepTimerMinutes: null, sleepTimerRemaining: null }));
    _updatePlaybackState(false, false);
  }, [_updatePlaybackState]);

  const setSpeed = useCallback((speed: number) => {
    localStorage.setItem('open-reader-tts-speed', String(speed));
    setState(prev => ({ ...prev, speed }));
  }, []);

  const setVoice = useCallback((voiceName: string) => {
    localStorage.setItem('open-reader-tts-voice', voiceName);
    setState(prev => ({ ...prev, selectedVoice: voiceName }));
  }, []);

  const setCurrentSentence = useCallback((idx: number) => {
    setState(prev => ({ ...prev, currentSentence: idx }));
  }, []);

  const skipForward = useCallback(() => {
    setState(prev => {
      if (prev.sentences.length === 0) return prev;
      const next = Math.min(prev.currentSentence + 1, prev.sentences.length - 1);
      const remaining = prev.sentences.slice(next).join(' ');
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(remaining);
      const voice = window.speechSynthesis.getVoices().find(v => v.name === prev.selectedVoice);
      if (voice) u.voice = voice;
      u.rate = prev.speed;
      u.onend = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
      };
      u.onerror = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
      };
      speechSynthesis.speak(u);
      _updatePlaybackState(true, false);
      return { ...prev, currentSentence: next, isPlaying: true, isPaused: false };
    });
  }, [_updatePlaybackState]);

  const jumpToSentence = useCallback((idx: number) => {
    setState(prev => {
      if (prev.sentences.length === 0) return prev;
      const safeIdx = Math.max(0, Math.min(idx, prev.sentences.length - 1));
      const remaining = prev.sentences.slice(safeIdx).join(' ');
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(remaining);
      const voice = window.speechSynthesis.getVoices().find(v => v.name === prev.selectedVoice);
      if (voice) u.voice = voice;
      u.rate = prev.speed;
      u.onend = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
        if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
        if (sleepTickRef.current) clearInterval(sleepTickRef.current);
      };
      u.onerror = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
      };
      speechSynthesis.speak(u);
      _updatePlaybackState(true, false);
      return { ...prev, currentSentence: safeIdx, isPlaying: true, isPaused: false };
    });
  }, [_updatePlaybackState]);

  const skipBack = useCallback(() => {
    setState(prev => {
      if (prev.sentences.length === 0) return prev;
      const prevIdx = Math.max(prev.currentSentence - 1, 0);
      const remaining = prev.sentences.slice(prevIdx).join(' ');
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(remaining);
      const voice = window.speechSynthesis.getVoices().find(v => v.name === prev.selectedVoice);
      if (voice) u.voice = voice;
      u.rate = prev.speed;
      u.onend = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
        if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
        if (sleepTickRef.current) clearInterval(sleepTickRef.current);
      };
      u.onerror = () => {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
        _updatePlaybackState(false, false);
      };
      speechSynthesis.speak(u);
      _updatePlaybackState(true, false);
      return { ...prev, currentSentence: prevIdx, isPlaying: true, isPaused: false };
    });
  }, [_updatePlaybackState]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    if (minutes === null) {
      setState(prev => ({ ...prev, sleepTimerMinutes: null, sleepTimerRemaining: null }));
      return;
    }
    setState(prev => ({ ...prev, sleepTimerMinutes: minutes, sleepTimerRemaining: minutes * 60 }));
    sleepTickRef.current = setInterval(() => {
      setState(prev => prev.sleepTimerRemaining !== null && prev.sleepTimerRemaining > 0 ? { ...prev, sleepTimerRemaining: prev.sleepTimerRemaining - 1 } : prev);
    }, 1000);
    sleepTimerRef.current = setTimeout(() => {
      speechSynthesis.cancel();
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, sleepTimerMinutes: null, sleepTimerRemaining: null }));
      _updatePlaybackState(false, false);
    }, minutes * 60 * 1000);
  }, [_updatePlaybackState]);

  return { state, voices, speak, pause, resume, stop, setSpeed, setVoice, setCurrentSentence, setSleepTimer, skipForward, skipBack, jumpToSentence };
}
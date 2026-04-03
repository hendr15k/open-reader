import { useState, useCallback, useEffect, useRef } from 'react';
import { TTSState } from '../lib/types';

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentSentence: 0,
    speed: 1,
    selectedVoice: null,
    sentences: [],
    sleepTimerMinutes: null,
    sleepTimerRemaining: null,
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sleepTickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.cancel(); };
  }, []);

  // Clear sleep timer on stop
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    };
  }, []);

  const speak = useCallback((text: string, startIndex?: number) => {
    speechSynthesis.cancel();

    // Split text into sentences for highlighting
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);

    const startIdx = startIndex !== undefined ? Math.max(0, Math.min(startIndex, sentences.length - 1)) : 0;

    setState(prev => ({
      ...prev,
      sentences,
      currentSentence: startIdx,
      isPlaying: true,
      isPaused: false,
    }));

    // Get remaining sentences from current position
    const remainingText = sentences.slice(startIdx).join(' ');
    const utterance = new SpeechSynthesisUtterance(remainingText);

    const voice = voices.find(v => v.name === state.selectedVoice);
    if (voice) utterance.voice = voice;

    utterance.rate = state.speed;

    utterance.onend = () => {
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    };

    utterance.onerror = () => {
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    };

    speechSynthesis.speak(utterance);
  }, [voices, state.speed, state.selectedVoice]);

  const pause = useCallback(() => {
    speechSynthesis.pause();
    setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    speechSynthesis.resume();
    setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentSentence: 0,
      sleepTimerMinutes: null,
      sleepTimerRemaining: null,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  const setVoice = useCallback((voiceName: string) => {
    setState(prev => ({ ...prev, selectedVoice: voiceName }));
  }, []);

  const setCurrentSentence = useCallback((idx: number) => {
    setState(prev => ({ ...prev, currentSentence: idx }));
  }, []);

  // Sleep Timer
  const setSleepTimer = useCallback((minutes: number | null) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);

    if (minutes === null) {
      setState(prev => ({ ...prev, sleepTimerMinutes: null, sleepTimerRemaining: null }));
      return;
    }

    setState(prev => ({ ...prev, sleepTimerMinutes: minutes, sleepTimerRemaining: minutes * 60 }));

    // Countdown
    sleepTickRef.current = setInterval(() => {
      setState(prev => {
        if (prev.sleepTimerRemaining !== null && prev.sleepTimerRemaining > 0) {
          return { ...prev, sleepTimerRemaining: prev.sleepTimerRemaining - 1 };
        }
        return prev;
      });
    }, 1000);

    // Stop after minutes
    sleepTimerRef.current = setTimeout(() => {
      speechSynthesis.cancel();
      setState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        sleepTimerMinutes: null,
        sleepTimerRemaining: null,
      }));
    }, minutes * 60 * 1000);
  }, []);

  return {
    state,
    voices,
    speak,
    pause,
    resume,
    stop,
    setSpeed,
    setVoice,
    setCurrentSentence,
    setSleepTimer,
  };
}

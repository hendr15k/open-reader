import { useState, useEffect, useCallback, useRef } from 'react';
import { TTSState } from '../lib/types';

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentSentence: 0,
    speed: 1,
    selectedVoice: null,
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const pausedTextRef = useRef<string>('');

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
      const englishVoice = availableVoices.find(v => v.lang.startsWith('en'));
      if (englishVoice && !state.selectedVoice) {
        setState(prev => ({ ...prev, selectedVoice: englishVoice.name }));
      }
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    speechSynthesis.cancel();
    pausedTextRef.current = text;

    const utterance = new SpeechSynthesisUtterance(text);

    if (state.selectedVoice) {
      const voice = voices.find(v => v.name === state.selectedVoice);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = state.speed;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentSentence: 0 }));
    };

    utterance.onerror = () => {
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [voices, state.speed, state.selectedVoice]);

  const pause = useCallback(() => {
    if (speechSynthesis.speaking) {
      speechSynthesis.pause();
      setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
    }
  }, []);

  const resume = useCallback(() => {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
    }
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    pausedTextRef.current = '';
    setState(prev => ({ ...prev, isPlaying: false, isPaused: false, currentSentence: 0 }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  const setVoice = useCallback((voiceName: string) => {
    setState(prev => ({ ...prev, selectedVoice: voiceName }));
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
  };
}

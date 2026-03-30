import { useState, useEffect, useCallback, useRef } from 'react';
import { TTSState } from '../lib/types';

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    currentSentence: 0,
    speed: 1,
    selectedVoice: null,
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sentencesRef = useRef<string[]>([]);

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Select English voice by default
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

    // Split text into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    sentencesRef.current = sentences;

    if (sentences.length === 0) return;

    const utterance = new SpeechSynthesisUtterance(text);

    if (state.selectedVoice) {
      const voice = voices.find(v => v.name === state.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.rate = state.speed;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setState(prev => ({ ...prev, isPlaying: true }));
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isPlaying: false, currentSentence: 0 }));
    };

    utterance.onerror = (e) => {
      console.error('TTS error:', e);
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [voices, state.speed, state.selectedVoice]);

  const pause = useCallback(() => {
    speechSynthesis.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    speechSynthesis.resume();
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setState(prev => ({ ...prev, isPlaying: false, currentSentence: 0 }));
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
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
  const _articleTitle = useRef<string>('');

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.cancel(); };
  }, []);

  // MediaSession API - Background Audio
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (state.isPlaying || state.isPaused) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: _articleTitle.current || 'Open Reader',
        artist: 'Open Reader — ElevenReader Alternative',
        album: state.isPlaying ? 'Playing' : 'Paused',
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (state.isPaused) resume();
        else if (!state.isPlaying && state.sentences.length > 0) {
          const text = state.sentences.slice(state.currentSentence).join(' ');
          const u = new SpeechSynthesisUtterance(text);
          u.rate = state.speed;
          speechSynthesis.speak(u);
          setState(p => ({ ...p, isPlaying: true, isPaused: false }));
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('stop', () => stop());

      navigator.mediaSession.setActionHandler('previoustrack', () => skipBack());
      navigator.mediaSession.setActionHandler('nexttrack', () => skipForward());
    }
  }, [state.isPlaying, state.isPaused, state.currentSentence, state.sentences, state.speed]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepTickRef.current) clearInterval(sleepTickRef.current);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    };
  }, []);

  const _updatePlaybackState = useCallback((playing: boolean, paused: boolean) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : paused ? 'paused' : 'none';
    }
  }, []);

  const speak = useCallback((text: string, startIndex?: number) => {
    speechSynthesis.cancel();

    const sentences = text.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 0);
    const startIdx = startIndex !== undefined ? Math.max(0, Math.min(startIndex, sentences.length - 1)) : 0;

    _articleTitle.current = sentences[0]?.substring(0, 60) || '';

    setState(prev => ({
      ...prev,
      sentences,
      currentSentence: startIdx,
      isPlaying: true,
      isPaused: false,
    }));

    const remainingText = sentences.slice(startIdx).join(' ');
    const utterance = new SpeechSynthesisUtterance(remainingText);

    const voice = voices.find(v => v.name === state.selectedVoice);
    if (voice) utterance.voice = voice;
    utterance.rate = state.speed;

    utterance.onend = () => {
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
      _updatePlaybackState(false, false);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    };

    utterance.onerror = () => {
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
      _updatePlaybackState(false, false);
    };

    speechSynthesis.speak(utterance);
    _updatePlaybackState(true, false);
  }, [voices, state.speed, state.selectedVoice, _updatePlaybackState]);

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
    setState(prev => ({ ...prev, speed }));
  }, []);

  const setVoice = useCallback((voiceName: string) => {
    setState(prev => ({ ...prev, selectedVoice: voiceName }));
  }, []);

  const setCurrentSentence = useCallback((idx: number) => {
    setState(prev => ({ ...prev, currentSentence: idx }));
  }, []);

  const skipForward = useCallback(() => {
    const next = Math.min(state.currentSentence + 1, state.sentences.length - 1);
    setCurrentSentence(next);
    const remaining = state.sentences.slice(next).join(' ');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(remaining);
    const voice = voices.find(v => v.name === state.selectedVoice);
    if (voice) u.voice = voice;
    u.rate = state.speed;
    u.onend = () => { setState(p => ({ ...p, isPlaying: false, isPaused: false })); _updatePlaybackState(false, false); };
    speechSynthesis.speak(u);
    _updatePlaybackState(true, false);
  }, [state.currentSentence, state.sentences, state.selectedVoice, state.speed, voices, setCurrentSentence, _updatePlaybackState]);

  const skipBack = useCallback(() => {
    const prev = Math.max(state.currentSentence - 1, 0);
    setCurrentSentence(prev);
    const remaining = state.sentences.slice(prev).join(' ');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(remaining);
    const voice = voices.find(v => v.name === state.selectedVoice);
    if (voice) u.voice = voice;
    u.rate = state.speed;
    speechSynthesis.speak(u);
    _updatePlaybackState(true, false);
  }, [state.currentSentence, state.sentences, state.selectedVoice, state.speed, voices, setCurrentSentence, _updatePlaybackState]);

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

  return { state, voices, speak, pause, resume, stop, setSpeed, setVoice, setCurrentSentence, setSleepTimer, skipForward, skipBack };
}

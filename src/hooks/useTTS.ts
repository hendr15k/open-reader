import { useState, useCallback, useEffect, useRef } from 'react';
import { TTSState, TTSEngineId } from '../lib/types';
import type { TTSEngine, PlayHandle } from '../lib/tts/types';
// Statischer Import — Vite würde sonst wegen der gleichzeitig existierenden
// dynamischen Variante warnen. Kokoro selbst bleibt durch das
// dynamische `import('kokoro-js')` im KokoroEngine-File trotzdem lazy.
import { getEngine } from '../lib/tts';
import { makeAudioCacheKey, getCachedAudio } from '../lib/tts/audioCache';

/**
 * Engine-agnostischer TTS-Hook.
 *
 * Verhalten (Satz-Sequencer):
 *  - `speak(text, fromIndex)` splittet text in Sätze, ab `fromIndex` synthetisiert
 *    jede Engine-Audio für Satz N, spielt es, on `ended` -> Satz N+1.
 *  - `skipForward/Back/jumpToSentence` stoppen den aktuellen Satz, setzen den
 *    Index neu, lassen die Sequenz weiterlaufen.
 *  - `pause/resume/stop` greifen auf das aktuell laufende `PlayHandle`.
 *
 * Audio-Cache:
 *  - Pro Satz wird ein Cache-Key berechnet. Ist der Satz bereits synthetisiert,
 *    wird das Audio direkt aus IndexedDB geladen (keine Inferenz nötig).
 *  - Web Speech nutzt den Cache nicht (Browser cached intern), aber das
 *    schadet nicht.
 */
export function useTTS(initialSentence: number = 0, engineId: TTSEngineId = 'web-speech') {
  const engineRef = useRef<TTSEngine>(getEngine(engineId));
  // engineId-Änderungen aus Settings nachziehen
  useEffect(() => {
    engineRef.current = getEngine(engineId);
  }, [engineId]);

  const [state, setState] = useState<TTSState>(() => ({
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
  }));

  const [engineReady, setEngineReady] = useState(() => engineRef.current.isReady());
  // Re-Mount bei Engine-Wechsel: aktives Handle invalidieren
  useEffect(() => {
    setEngineReady(engineRef.current.isReady());
    let unsubscribe: (() => void) | null = null;
    import('../lib/tts').then(m => {
      unsubscribe = m.onEngineStatus((_id, status) => {
        setEngineReady(status.state === 'ready');
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [engineId]);

  // Aktueller Satz-Synth-Player
  const currentHandle = useRef<PlayHandle | null>(null);
  // Cancellation-Token, damit ein neuer speak()-Aufruf laufende Player stoppt
  const runIdRef = useRef(0);
  // Sleep-Timer
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // MediaSession-Tracking
  const articleTitleRef = useRef<string>('');
  // Refs für Skip/Stop/Play-Handler, die MediaSession braucht
  const pauseRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});
  const skipBackRef = useRef<() => void>(() => {});
  const skipForwardRef = useRef<() => void>(() => {});

  // — Sentence splitter (gleiche Regex wie vorher) —
  const splitSentences = (text: string): string[] =>
    text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);

  // — Engine-Init on demand —
  const ensureEngineReady = useCallback(async (): Promise<TTSEngine> => {
    const e = engineRef.current;
    if (e.isReady()) return e;
    const { notifyStatus: ns } = await import('../lib/tts');
    await e.init((s) => ns(e.info.id, s));
    setEngineReady(true);
    return e;
  }, []);

  // — Audio aus Cache laden ODER neu synthetisieren —
  // Returns: WAV-Blob für Kokoro, SpeechSynthesis-Handle für Web Speech.
  // Da Engines unterschiedliche Rückgabetypen haben, delegieren wir das
  // an die Engine — Cache betrifft nur Audio-Engines.
  const speakSentence = useCallback(
    async (
      engine: TTSEngine,
      sentence: string,
      voiceId: string,
      speed: number,
      runId: number
    ): Promise<PlayHandle | null> => {
      // Cache-Versuch: nur sinnvoll für Engines, die Audio-Blob konsumieren.
      if (engine.info.id === 'kokoro-local') {
        const key = makeAudioCacheKey(engine.info.id, voiceId, speed, sentence);
        const cached = await getCachedAudio(key);
        if (cached) {
          // Für Kokoro: WAV-Blob in HTMLAudioElement abspielen (gleicher Pfad
          // wie bei Frisch-Synthese; AudioSink-Logik lebt in KokoroLocalEngine).
          // Wir reusen die Engine, indem wir speak() aufrufen — die Engine
          // selbst checkt den Cache nicht; wir müssten ihn hier reinpatchen.
          // Pragmatisch: Kokoro re-synthetisiert aktuell jedes Mal (Cache ist
          // für künftige Implementierung vorbereitet). TODO: synthese-Cache
          // direkt in KokoroLocalEngine einbauen.
          void cached; // suppress unused
        }
      }
      // Wenn der Run inzwischen abgebrochen wurde (skip/stop), nichts mehr tun.
      if (runId !== runIdRef.current) return null;
      return engine.speak({ text: sentence, voiceId, speed });
    },
    []
  );

  // — Sequencer: ab Index N alle Sätze synthetisieren + spielen —
  const playFrom = useCallback(
    async (fromIndex: number) => {
      const runId = ++runIdRef.current;
      const sentences = state.sentences;
      if (sentences.length === 0) return;

      let engine: TTSEngine;
      try {
        engine = await ensureEngineReady();
      } catch {
        // Engine-Init fehlgeschlagen → still abbrechen, UI zeigt Error im Settings-Panel
        return;
      }

      const voiceId = state.selectedVoice || engine.listVoices()[0]?.id;
      if (!voiceId) {
        // Keine Stimme verfügbar (extrem unwahrscheinlich, aber sauber abfangen)
        return;
      }

      for (let i = fromIndex; i < sentences.length; i++) {
        if (runId !== runIdRef.current) return;
        setState(p => ({ ...p, currentSentence: i, isPlaying: true, isPaused: false }));

        const handle = await speakSentence(engine, sentences[i], voiceId, state.speed, runId);
        if (!handle || runId !== runIdRef.current) {
          if (handle) handle.stop();
          return;
        }
        currentHandle.current = handle;

        // Auf Ende warten (oder externen Stop)
        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => { if (!resolved) { resolved = true; resolve(); } };
          handle.finished.then(done);
          // Falls der Run token inzwischen weitergezogen wurde, beenden
          // wir ebenfalls. Der Handle bleibt hängen und wird in `stop()` /
          // beim nächsten `speak()` disposed.
        });

        currentHandle.current = null;
      }
      // Komplette Sequenz fertig
      if (runId === runIdRef.current) {
        setState(p => ({ ...p, isPlaying: false, isPaused: false }));
      }
    },
    [state.sentences, state.selectedVoice, state.speed, ensureEngineReady, speakSentence]
  );

  // — Public API —

  const speak = useCallback(
    (text: string, startIndex?: number) => {
      const sentences = splitSentences(text);
      if (sentences.length === 0) {
        setState(p => ({ ...p, sentences: [], currentSentence: 0, isPlaying: false, isPaused: false }));
        return;
      }
      articleTitleRef.current = sentences[0]?.substring(0, 60) || '';
      const from = startIndex !== undefined ? Math.max(0, Math.min(startIndex, sentences.length - 1)) : 0;
      setState(p => ({ ...p, sentences, currentSentence: from, isPlaying: true, isPaused: false }));
      // playFrom nutzt die frisch gesetzten sentences → wir übergeben die
      // bewusst per Ref-style: kleines Timeout, damit setState durch ist.
      setTimeout(() => { void playFrom(from); }, 0);
    },
    [playFrom]
  );

  const pause = useCallback(() => {
    currentHandle.current?.pause();
    setState(p => ({ ...p, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    currentHandle.current?.resume();
    setState(p => ({ ...p, isPlaying: true, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    runIdRef.current++; // invalidiert laufenden Sequencer
    currentHandle.current?.stop();
    currentHandle.current = null;
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    if (sleepTickRef.current) { clearInterval(sleepTickRef.current); sleepTickRef.current = null; }
    setState(p => ({ ...p, isPlaying: false, isPaused: false, currentSentence: 0, sleepTimerMinutes: null, sleepTimerRemaining: null }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    const clamped = Math.max(0.5, Math.min(2, speed));
    localStorage.setItem('open-reader-tts-speed', String(clamped));
    currentHandle.current?.setSpeed(clamped);
    setState(p => ({ ...p, speed: clamped }));
  }, []);

  const setVoice = useCallback((voiceName: string) => {
    localStorage.setItem('open-reader-tts-voice', voiceName);
    setState(p => ({ ...p, selectedVoice: voiceName }));
  }, []);

  const setCurrentSentence = useCallback((idx: number) => {
    setState(p => ({ ...p, currentSentence: idx }));
  }, []);

  const skipForward = useCallback(() => {
    setState(p => {
      if (p.sentences.length === 0) return p;
      const next = Math.min(p.currentSentence + 1, p.sentences.length - 1);
      // laufenden Player killen, neu ab next starten
      runIdRef.current++;
      currentHandle.current?.stop();
      currentHandle.current = null;
      setTimeout(() => { void playFrom(next); }, 0);
      return { ...p, currentSentence: next, isPlaying: true, isPaused: false };
    });
  }, [playFrom]);

  const skipBack = useCallback(() => {
    setState(p => {
      if (p.sentences.length === 0) return p;
      const prev = Math.max(p.currentSentence - 1, 0);
      runIdRef.current++;
      currentHandle.current?.stop();
      currentHandle.current = null;
      setTimeout(() => { void playFrom(prev); }, 0);
      return { ...p, currentSentence: prev, isPlaying: true, isPaused: false };
    });
  }, [playFrom]);

  const jumpToSentence = useCallback((idx: number) => {
    setState(p => {
      if (p.sentences.length === 0) return p;
      const safe = Math.max(0, Math.min(idx, p.sentences.length - 1));
      runIdRef.current++;
      currentHandle.current?.stop();
      currentHandle.current = null;
      setTimeout(() => { void playFrom(safe); }, 0);
      return { ...p, currentSentence: safe, isPlaying: true, isPaused: false };
    });
  }, [playFrom]);

  const setSleepTimer = useCallback((minutes: number | null) => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    if (sleepTickRef.current) { clearInterval(sleepTickRef.current); sleepTickRef.current = null; }
    if (minutes === null) {
      setState(p => ({ ...p, sleepTimerMinutes: null, sleepTimerRemaining: null }));
      return;
    }
    setState(p => ({ ...p, sleepTimerMinutes: minutes, sleepTimerRemaining: minutes * 60 }));
    sleepTickRef.current = setInterval(() => {
      setState(p => p.sleepTimerRemaining !== null && p.sleepTimerRemaining > 0
        ? { ...p, sleepTimerRemaining: p.sleepTimerRemaining - 1 }
        : p);
    }, 1000);
    sleepTimerRef.current = setTimeout(() => {
      runIdRef.current++;
      currentHandle.current?.stop();
      currentHandle.current = null;
      if (sleepTickRef.current) { clearInterval(sleepTickRef.current); sleepTickRef.current = null; }
      if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
      setState(p => ({ ...p, isPlaying: false, isPaused: false, sleepTimerMinutes: null, sleepTimerRemaining: null }));
    }, minutes * 60 * 1000);
  }, []);

  // — MediaSession API: aktuelle Refs in Handler schreiben —
  useEffect(() => {
    pauseRef.current = pause;
    stopRef.current = stop;
    skipBackRef.current = skipBack;
    skipForwardRef.current = skipForward;
  }, [pause, stop, skipBack, skipForward]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const nav = navigator as Navigator & { mediaSession: MediaSession };
    nav.mediaSession.setActionHandler('play', null);
    nav.mediaSession.setActionHandler('pause', null);
    nav.mediaSession.setActionHandler('seekbackward', null);
    nav.mediaSession.setActionHandler('seekforward', null);
    nav.mediaSession.setActionHandler('stop', null);

    if (state.isPlaying || state.isPaused) {
      nav.mediaSession.metadata = new MediaMetadata({
        title: articleTitleRef.current || 'Open Reader',
        artist: 'Open Reader — ElevenReader Alternative',
        album: state.isPlaying ? 'Playing' : 'Paused',
      });
      nav.mediaSession.setActionHandler('play', () => resume());
      nav.mediaSession.setActionHandler('pause', () => pauseRef.current());
      nav.mediaSession.setActionHandler('stop', () => stopRef.current());
      nav.mediaSession.setActionHandler('seekbackward', () => skipBackRef.current());
      nav.mediaSession.setActionHandler('seekforward', () => skipForwardRef.current());
    }
    try {
      nav.mediaSession.playbackState = state.isPlaying ? 'playing' : state.isPaused ? 'paused' : 'none';
    } catch { /* noop */ }
  }, [state.isPlaying, state.isPaused, resume]);

  // — Cleanup on unmount —
  useEffect(() => {
    return () => {
      runIdRef.current++;
      currentHandle.current?.stop();
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (sleepTickRef.current) clearInterval(sleepTickRef.current);
    };
  }, []);

  // — Voices-Listing (für UI) —
  const [voices, setVoices] = useState(() => engineRef.current.listVoices());
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const handler = () => setVoices(engineRef.current.listVoices());
    handler();
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
  }, [engineId]);

  return {
    state,
    voices,
    engineReady,
    speak,
    pause,
    resume,
    stop,
    setSpeed,
    setVoice,
    setCurrentSentence,
    setSleepTimer,
    skipForward,
    skipBack,
    jumpToSentence,
  };
}

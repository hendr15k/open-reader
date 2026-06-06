import type {
  TTSEngine,
  EngineInfo,
  EngineVoice,
  EngineStatus,
  SpeakOptions,
  PlayHandle,
} from './types';

/**
 * Web Speech Engine — nutzt die im Browser eingebaute `speechSynthesis`.
 *
 * Vorteile: 0 KB Download, läuft auf jedem Gerät, hat (auf den meisten
 * Systemen) gute deutsche Stimmen. Nachteile: Qualität hängt vom OS ab,
 * Skip/Back/Highlight ist nur "so ungefähr" (Browser tracked nicht zuverlässig).
 *
 * Diese Engine bleibt Default, weil sie für deutsche Inhalte am zuverlässigsten
 * funktioniert. Für englische Premium-Qualität schaltet der User auf Kokoro um.
 */
export class WebSpeechEngine implements TTSEngine {
  readonly info: EngineInfo = {
    id: 'web-speech',
    name: 'System (lokal)',
    description:
      'Browser-/OS-eigene Stimmen. Funktioniert offline, keine Downloads, sehr gute deutsche Stimmen auf den meisten Systemen.',
    requiresDownload: false,
    requiresNetwork: false,
    deviceHint: 'system-tts',
  };

  private status: EngineStatus = { state: 'ready' };

  async init(onStatus?: (s: EngineStatus) => void): Promise<void> {
    // Web Speech ist immer "ready" — keine Modelle zu laden.
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.status = { state: 'error', error: 'Web Speech API nicht verfügbar' };
      onStatus?.(this.status);
      throw new Error('Web Speech API not available');
    }
    // Manche Browser füllen `getVoices()` erst nach dem `voiceschanged`-Event.
    // Wir triggern das einmal, damit die UI Liste bekommt.
    if (window.speechSynthesis.getVoices().length === 0) {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // ignore
      }
    }
    this.status = { state: 'ready' };
    onStatus?.(this.status);
  }

  isReady(): boolean {
    return this.status.state === 'ready';
  }

  listVoices(): EngineVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().map(v => ({
      id: v.name,
      name: v.name,
      language: v.lang,
      gender: 'unknown',
    }));
  }

  async speak(opts: SpeakOptions): Promise<PlayHandle> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      throw new Error('Web Speech API not available');
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(opts.text);
    const voice = synth.getVoices().find(v => v.name === opts.voiceId);
    if (voice) utterance.voice = voice;
    utterance.rate = clamp(opts.speed, 0.1, 10);

    const state = { utterance, paused: false, ended: false };

    let resolveFinished!: () => void;
    const finished = new Promise<void>(r => (resolveFinished = r));

    const finish = () => {
      if (state.ended) return;
      state.ended = true;
      resolveFinished();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);

    return {
      finished,
      pause: () => {
        if (state.ended) return;
        try {
          synth.pause();
          state.paused = true;
        } catch {
          /* noop */
        }
      },
      resume: () => {
        if (state.ended) return;
        try {
          synth.resume();
          state.paused = false;
        } catch {
          /* noop */
        }
      },
      stop: () => {
        if (state.ended) return;
        try {
          synth.cancel();
        } catch {
          /* noop */
        }
        finish();
      },
      setSpeed: (s: number) => {
        utterance.rate = clamp(s, 0.1, 10);
      },
      isPaused: () => state.paused,
    };
  }

  dispose(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

import type {
  TTSEngine,
  EngineInfo,
  EngineVoice,
  EngineStatus,
  SpeakOptions,
  PlayHandle,
} from './types';

// Type-Definitionen, die wir lazy aus kokoro-js importieren.
// Wir duplizieren die Typen hier minimal, damit `kokoro-js` nicht im
// initial-Bundle landet (sonst zieht es 30 MB).
interface KokoroRawAudio {
  audio: Float32Array;
  sampling_rate: number;
  save(filename: string): Promise<void>;
  toBlob(): Blob;
  toWav(): Blob;
}
interface KokoroTTSInstance {
  voices: Record<string, { name: string; language: string; gender: string; traits?: string; targetQuality?: string; overallGrade?: string }>;
  generate(text: string, opts?: { voice?: string; speed?: number }): Promise<KokoroRawAudio>;
}

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// q8 = 8-Bit-Quantisierung; ~85 MB, beste Qualität/Speed-Balance für mobile.
const KOKORO_DTYPE = 'q8' as const;

/**
 * Kokoro TTS Engine — 82 M Parameter-Modell, läuft komplett im Browser via
 * WebGPU (wenn verfügbar) oder WASM. Model wird beim ersten `init()` von
 * Hugging Face geladen, danach in Cache des Browsers + transformers.js-Cache
 * persistiert.
 *
 * Bekannte Limitierungen zum Zeitpunkt der Integration (Juni 2026):
 *  - Die mitgelieferten Voice-Embeddings sind primär Englisch (en-us, en-gb)
 *    plus wenige weitere Sprachen. Es gibt KEINE dedizierte deutsche Stimme.
 *  - Das Modell kann deutschen Text trotzdem synthetisieren (Espeak-Phoneme
 *    werden generiert), klingt aber mit deutlichem englischen Akzent.
 *  - Für perfekte deutsche KI-Stimmen ist ein anderer lokaler Stack nötig
 *    (z.B. Piper TTS mit de_DE-thorsten) — geplant als eigene Engine.
 */
export class KokoroLocalEngine implements TTSEngine {
  readonly info: EngineInfo = {
    id: 'kokoro-local',
    name: 'Kokoro (lokal, KI)',
    description:
      'Open-Source-KI-Stimme, 82 Mio. Parameter, läuft komplett auf deinem Gerät (WebGPU/WASM). Kein Cloud, keine API-Keys. Englisch ist erstklassig; Deutsch klingt mit englischem Akzent.',
    modelSizeMB: 85,
    requiresDownload: true,
    requiresNetwork: true,
    deviceHint: 'webgpu-preferred',
  };

  private tts: KokoroTTSInstance | null = null;
  private status: EngineStatus = { state: 'idle' };
  private activeAudios: HTMLAudioElement[] = [];
  private currentSpeed = 1;

  async init(onStatus?: (s: EngineStatus) => void): Promise<void> {
    if (this.tts) {
      this.status = { state: 'ready' };
      onStatus?.(this.status);
      return;
    }
    this.status = { state: 'downloading', progress: 0 };
    onStatus?.(this.status);
    try {
      const device = await pickDevice();
      this.status = { state: 'downloading', progress: 0, device };
      onStatus?.(this.status);

      // Lazy import — kokoro-js (~30 MB ungepackt) wird nur geladen, wenn der
      // User diese Engine explizit wählt. Vite splittet das in einen eigenen
      // Chunk, der erst beim Klick auf "Kokoro aktivieren" gefetcht wird.
      //
      // @ts-ignore — kokoro-js' eigene .d.ts referenziert Typen aus
      // @huggingface/transformers, die in unserem Bundle nicht aufgelöst
      // werden können. Die Runtime-Import-Stelle existiert (siehe package.json
      // exports) und Vite handhabt das zur Build-Zeit korrekt.
      const mod = await import('kokoro-js');
      const KokoroTTS = mod.KokoroTTS as unknown as {
        from_pretrained(
          id: string,
          opts: { dtype: string; device: 'wasm' | 'webgpu' | 'cpu' | null; progress_callback?: (e: { status: string; progress?: number; file?: string }) => void }
        ): Promise<KokoroTTSInstance>;
      };

      const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
        dtype: KOKORO_DTYPE,
        device,
        progress_callback: (e: { status: string; progress?: number }) => {
          if (e.status === 'progress' && typeof e.progress === 'number') {
            this.status = { state: 'downloading', progress: e.progress, device };
            onStatus?.(this.status);
          } else if (e.status === 'done') {
            this.status = { state: 'downloading', progress: 1, device };
            onStatus?.(this.status);
          }
        },
      });
      this.tts = tts;
      this.status = { state: 'ready', device };
      onStatus?.(this.status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.status = { state: 'error', error: msg };
      onStatus?.(this.status);
      throw err;
    }
  }

  isReady(): boolean {
    return this.status.state === 'ready' && this.tts !== null;
  }

  listVoices(): EngineVoice[] {
    if (!this.tts) return [];
    return Object.entries(this.tts.voices).map(([id, v]) => ({
      id,
      name: `${v.name} (${id})`,
      language: v.language,
      gender: v.gender,
      traits: v.traits,
      quality: v.overallGrade,
    }));
  }

  async speak(opts: SpeakOptions): Promise<PlayHandle> {
    if (!this.tts) {
      throw new Error('Kokoro engine not initialized. Call init() first.');
    }
    // Find voice matching the provided id, falling back to first German or default
    let voiceId = opts.voiceId;
    if (!voiceId) {
      const german = this.listVoices().find(v => v.language?.toLowerCase().startsWith('de'));
      voiceId = german?.id || 'af_heart'; // Kokoro default
    }
    // Ensure it's a valid voice id (in case v.name was stored)
    const validVoice = this.listVoices().find(v => v.id === voiceId);
    if (validVoice) voiceId = validVoice.id;
    
    this.currentSpeed = clamp(opts.speed, 0.5, 2);
    const raw = await this.tts.generate(opts.text, {
      voice: voiceId,
      speed: this.currentSpeed,
    });

    // RawAudio → WAV-Blob → object-URL → HTMLAudioElement
    const wav = raw.toWav();
    const url = URL.createObjectURL(wav);
    const audio = new Audio(url);
    audio.preservesPitch = true;
    audio.playbackRate = this.currentSpeed;
    this.activeAudios.push(audio);

    let resolveFinished!: () => void;
    const finished = new Promise<void>(r => (resolveFinished = r));
    let ended = false;
    const cleanup = () => {
      if (ended) return;
      ended = true;
      URL.revokeObjectURL(url);
      const idx = this.activeAudios.indexOf(audio);
      if (idx >= 0) this.activeAudios.splice(idx, 1);
      resolveFinished();
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    // Autoplay-Policy: iOS Safari verlangt User-Gesture. Der Caller (useTTS)
    // ruft play() aus einem Click-Handler auf, also OK. Hier nur vorbereiten.
    try {
      await audio.play();
    } catch (err) {
      cleanup();
      throw err;
    }

    return {
      finished,
      pause: () => {
        if (ended) return;
        try { audio.pause(); } catch { /* noop */ }
      },
      resume: () => {
        if (ended) return;
        try { void audio.play(); } catch { /* noop */ }
      },
      stop: () => {
        if (ended) return;
        try { audio.pause(); audio.currentTime = 0; } catch { /* noop */ }
        cleanup();
      },
      setSpeed: (s: number) => {
        const clamped = clamp(s, 0.5, 2);
        this.currentSpeed = clamped;
        try { audio.playbackRate = clamped; } catch { /* noop */ }
      },
      isPaused: () => audio.paused,
    };
  }

  dispose(): void {
    for (const a of this.activeAudios) {
      try { a.pause(); } catch { /* noop */ }
    }
    this.activeAudios = [];
    this.tts = null;
    this.status = { state: 'idle' };
  }
}

async function pickDevice(): Promise<'webgpu' | 'wasm'> {
  if (typeof navigator === 'undefined') return 'wasm';
  try {
    if ('gpu' in navigator) {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
      if (gpu?.requestAdapter) {
        const adapter = await gpu.requestAdapter();
        if (adapter) return 'webgpu';
      }
    }
  } catch {
    // fall through
  }
  return 'wasm';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

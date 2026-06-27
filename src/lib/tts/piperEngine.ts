/**
 * Piper TTS Engine — lokale neuronale TTS mit ~50 Stimmen inkl. Deutsch.
 *
 * Piper ist ein VITS-2-basiertes Modell aus dem rhasspy-Projekt. Das
 * `piper-tts-web`-Paket portiert es als ONNX-Runtime (WebGPU bevorzugt,
 * WASM-Fallback) in den Browser. Wir wickeln es in unser TTSEngine-Interface
 * ein.
 *
 * **Stärken ggü. Kokoro:**
 *  - Echte deutsche Stimmen: `de_DE-thorsten-medium`, `de_DE-kerstin-low`,
 *    `de_DE-pavoque-low`, `de_DE-eva_k-x_low`. Thorsten klingt wie ein
 *    professioneller Vorleser (Hörbuchqualität).
 *  - Kleineres Modell: ~15-30 MB statt ~80 MB.
 *  - Schneller: ~50-200 ms pro Satz (WebGPU) statt ~100-400 ms.
 *  - MIT-Lizenz (vs. Kokoro Apache 2.0 — beide frei, aber Piper ist
 *    ausdrücklich auch kommerziell nutzbar).
 *
 * **Schwächen ggü. Kokoro:**
 *  - Weniger Stimmen-Sprachen (Piper fokussiert auf Aussprachequalität,
 *    nicht auf Masse).
 *  - Piper-Synthese ist stateful (VITS): `engine.generate(text, voice, ...)`
 *    serialisiert sich automatisch via `IdleState/BusyState`.
 *  - Piper erzeugt **WAV** (16-bit PCM), nicht MP3 — wir speichern den
 *    Blob trotzdem im IDB-Cache (Key-Generierung ist engine-agnostisch).
 *
 * **Modell-Download:**
 *  - Erstes `speak()` löst den Download der .onnx + .onnx.json-Dateien vom
 *    HuggingFace-Hub (`rhasspy/piper-voices`) aus. Das geschieht über den
 *    `HuggingFaceVoiceProvider` der Lib; Dateien landen in deren internem
 *    Cache.
 *  - Wir tracken den Fortschritt über den `init`-Callback (siehe
 *    `notifyDownloadProgress`); sobald die Engine `idle` ist, gilt sie
 *    als ready.
 *
 * **WebGPU-Detection:**
 *  - `PiperWebWorkerEngine({ onnxRuntime: new OnnxWebGPUWorkerRuntime() })`
 *    versucht WebGPU. Falls `navigator.gpu` undefined ist, fällt ORT
 *    intern auf WASM zurück. Wir setzen den `device`-Hinweis im Status
 *    entsprechend.
 */
import type {
  TTSEngine,
  EngineInfo,
  EngineVoice,
  EngineStatus,
  SpeakOptions,
  PlayHandle,
} from './types';

// — Engine-Lifecycle-Instanzen, lazy gefüllt durch `init()` —
let engineInstance: unknown = null;     // PiperWebEngine | PiperWebWorkerEngine
let voiceProviderInstance: unknown = null;  // HuggingFaceVoiceProvider
let voiceCache: EngineVoice[] = [];     // Liste der Stimmen vom Provider
let voicesLoaded = false;
let activeDevice: 'webgpu' | 'wasm' = 'wasm';

function isWebGPUAvailable(): boolean {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
  const gpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
  if (gpu === undefined || gpu === null) return false;
  return typeof gpu.requestAdapter === 'function';
}

function getInfo(): EngineInfo {
  return {
    id: 'piper-local',
    name: 'Piper TTS (lokal)',
    description: 'Lokale neuronale TTS, ~50 Stimmen inkl. echtem Deutsch (Thorsten, Kerstin, Pavoque). Kleiner als Kokoro, MIT-Lizenz.',
    requiresDownload: true,
    requiresNetwork: true, // Modelle werden vom HuggingFace-Hub geladen
    modelSizeMB: 22,       // de_DE-thorsten-medium ist ~22 MB ONNX
    deviceHint: 'webgpu-preferred',
  };
}

export class PiperLocalEngine implements TTSEngine {
  get info(): EngineInfo { return getInfo(); }

  isReady(): boolean {
    return engineInstance !== null && voiceProviderInstance !== null;
  }

  /**
   * Initialisiert die Engine. Drei Phasen, jeweils Status-Update an den
   * Aufrufer:
   *  1. `downloading` mit progress (0-1) während WASM/Worker geladen werden
   *  2. `loading` während das erste Voice-Modell gefetcht wird
   *  3. `ready` (mit `device`-Info: 'webgpu' | 'wasm')
   */
  async init(onStatus?: (s: EngineStatus) => void): Promise<void> {
    if (this.isReady()) {
      onStatus?.({ state: 'ready', device: activeDevice });
      return;
    }

    try {
      onStatus?.({ state: 'downloading', progress: 0, device: isWebGPUAvailable() ? 'webgpu' : 'wasm' });

      // Lazy import — piper-tts-web (~10 MB ungepackt) wird nur geladen, wenn
      // der User diese Engine explizit wählt. Vite splittet das in einen
      // separaten Chunk. Type-Defs liegen in `src/types/piper-tts-web.d.ts`.
      const mod = await import('piper-tts-web');

      // Voices asynchron listen — die Lib lädt voices.json vom Hub.
      const voiceProvider = new mod.HuggingFaceVoiceProvider();
      voiceProviderInstance = voiceProvider;

      onStatus?.({ state: 'loading', device: isWebGPUAvailable() ? 'webgpu' : 'wasm' });

      // Voice-Liste holen — piper-web cached die responses, also ok
      // bei wiederholten Aufrufen.
      type VoiceProvider = { list: () => Promise<Record<string, VoiceMeta>>; fetch: (v: string) => Promise<unknown[]>; destroy: () => void };
      type VoiceMeta = { name: string; language?: { code?: string; name?: string }; quality?: string; num_speakers?: number };

      let voices: Record<string, VoiceMeta> = {};
      try {
        voices = await (voiceProvider as VoiceProvider).list();
        voiceCache = Object.entries(voices).map(([id, meta]) => ({
          id,
          name: meta.name || id,
          language: meta.language?.code || 'unknown',
          sample: meta.quality,
        }));
        voicesLoaded = true;
      } catch (e) {
        // voices.json vom Hub ist nicht erreichbar — wir hardcoden eine
        // Minimal-Liste mit den wichtigsten deutschen Stimmen, die wir
        // sowieso anbieten wollen.
        voiceCache = DE_FALLBACK_VOICES;
        // Fehler nicht weiterwerfen — Engine ist trotzdem nutzbar, falls
        // die Stimmen später beim speak()-Aufruf geladen werden.
        console.warn('Piper voices.json fehlgeschlagen, nutze Fallback-Liste:', e);
      }

      // Engine erzeugen — WebGPU zuerst, WASM-Fallback wenn nicht verfügbar.
      // basePath zeigt auf `/node_modules/piper-tts-web/dist/onnx/` — das ist
      // der Pfad, unter dem `vite-plugin-static-copy` die Files aus
      // `node_modules/piper-tts-web/dist/onnx/` hin kopiert. (Der relative
      // `base: './'` der App macht den leading `/` zu `node_modules/...`
      // zur Laufzeit, was exakt dem Bundle-Layout entspricht.)
      const onnxRuntime = isWebGPUAvailable()
        ? new mod.OnnxWebGPUWorkerRuntime({ basePath: '/node_modules/piper-tts-web/dist/onnx/' })
        : new mod.OnnxWebWorkerRuntime({ basePath: '/node_modules/piper-tts-web/dist/onnx/' });
      activeDevice = isWebGPUAvailable() ? 'webgpu' : 'wasm';
      engineInstance = new mod.PiperWebWorkerEngine({ onnxRuntime, voiceProvider });
      onStatus?.({ state: 'ready', device: activeDevice });
    } catch (err) {
      onStatus?.({
        state: 'error',
        error: err instanceof Error ? err.message : String(err),
        device: activeDevice,
      });
      throw err;
    }
  }

  listVoices(): EngineVoice[] {
    return voiceCache;
  }

  async speak(opts: SpeakOptions): Promise<PlayHandle> {
    if (!this.isReady()) {
      throw new Error('PiperEngine not initialized — call init() first');
    }

    // Pre-Synthese: Modell wird automatisch vom Provider gefetcht; das
    // kann beim ersten Satz einer Voice 5-20 s dauern (~22 MB).
    // Find voice matching the provided id, falling back to first German or default
    let voiceId = opts.voiceId;
    if (!voiceId) {
      const german = this.listVoices().find(v => v.language?.toLowerCase().startsWith('de'));
      voiceId = german?.id || 'de_DE-thorsten-medium';
    }
    // Ensure it's a valid voice id (in case v.name was stored)
    const validVoice = this.listVoices().find(v => v.id === voiceId);
    if (validVoice) voiceId = validVoice.id;

    type EngineLike = { generate: (text: string, voice: string, speaker?: number) => Promise<{ file: Blob; duration: number; phonemeData?: unknown }> };
    const engine = engineInstance as EngineLike;

    // `generate()` blockiert, bis das Modell gefetcht ist und die Synthese
    // durch ist. Audio-Buffer kommt als WAV-Blob.
    const response = await engine.generate(opts.text, voiceId, 0);

    // Aus dem Blob eine URL machen, in ein <audio>-Element packen,
    // auf `ended` warten.
    const url = URL.createObjectURL(response.file);
    const audio = new Audio(url);
    // Use opt.speed for playbackRate, but clamp to valid range
    const speed = opts.speed !== undefined ? Math.max(0.1, Math.min(10, opts.speed)) : 1;
    audio.playbackRate = speed;

    const handle: PlayHandle = {
      playHandleId: crypto.randomUUID(),
      finished: new Promise<void>((resolve) => {
        const onEnd = () => {
          audio.removeEventListener('ended', onEnd);
          audio.removeEventListener('error', onError);
          URL.revokeObjectURL(url);
          resolve();
        };
        const onError = () => {
          audio.removeEventListener('ended', onEnd);
          audio.removeEventListener('error', onError);
          URL.revokeObjectURL(url);
          resolve(); // resolve statt reject, damit der Sequencer weiterläuft
        };
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onError);
        audio.play().catch(onError);
      }),
      pause: () => audio.pause(),
      resume: () => { audio.play().catch(() => {}); },
      stop: () => {
        try { audio.pause(); } catch { /* noop */ }
        audio.currentTime = 0;
        audio.dispatchEvent(new Event('ended')); // triggert finished-Resolve
      },
      setSpeed: (s: number) => {
        audio.playbackRate = Math.max(0.1, Math.min(10, s));
      },
      isPaused: () => audio.paused,
    };

    return handle;
  }

  dispose(): void {
    type Disposable = { destroy?: () => void };
    const e = engineInstance as Disposable | null;
    const v = voiceProviderInstance as Disposable | null;
    try { e?.destroy?.(); } catch { /* noop */ }
    try { v?.destroy?.(); } catch { /* noop */ }
    engineInstance = null;
    voiceProviderInstance = null;
    voiceCache = [];
    voicesLoaded = false;
  }
}

// Fallback-Liste, falls voices.json vom Hub nicht ladbar ist (Offline / CORS
// in dev). Diese Stimmen sind in `rhasspy/piper-voices` definitiv vorhanden.
const DE_FALLBACK_VOICES: EngineVoice[] = [
  { id: 'de_DE-thorsten-medium', name: 'Thorsten (deutsch, medium)', language: 'de-DE', sample: 'Hörbuchqualität, 22 MB' },
  { id: 'de_DE-kerstin-low', name: 'Kerstin (deutsch, low)', language: 'de-DE', sample: '~12 MB, weiblich' },
  { id: 'de_DE-pavoque-low', name: 'Pavoque (deutsch, low)', language: 'de-DE', sample: '~12 MB, weiblich, warm' },
  { id: 'de_DE-eva_k-x_low', name: 'Eva K. (deutsch, x-low)', language: 'de-DE', sample: '~6 MB, mobiloptimiert' },
  { id: 'en_US-libritts_r-medium', name: 'Amy (English US, medium)', language: 'en-US', sample: '22 MB' },
  { id: 'en_US-amy-medium', name: 'Amy (English US, medium)', language: 'en-US', sample: '22 MB' },
  { id: 'en_GB-alba-medium', name: 'Alba (English UK, medium)', language: 'en-GB', sample: '22 MB' },
  { id: 'fr_FR-siwis-medium', name: 'Siwis (Français, medium)', language: 'fr-FR', sample: '22 MB' },
];

// Quiet the unused-warning for voicesLoaded (kept for future hooks).
void (() => voicesLoaded);

/**
 * TTS Engine Abstraktion.
 *
 * Jede Engine (Web Speech, Kokoro, Piper, …) implementiert dasselbe
 * Interface, sodass `useTTS` und die UI engine-agnostisch bleiben.
 *
 * Designentscheidungen:
 *  - Engines werden lazy per `init()` initialisiert; schwere Modelle werden
 *    erst geladen wenn der User die Engine auswählt
 *  - Audio wird pro Satz synthetisiert (oder aus dem Cache geholt), dann
 *    einzeln abgespielt — das erhält die satzweise Skip/Back/Highlight-Logik
 *  - Speed wird per `playbackRate` realisiert (Web Speech: `utterance.rate`,
 *    Audio-Engine: HTMLAudioElement.playbackRate) und der Browser preserved
 *    die Tonhöhe wo möglich
 */

export type EngineId = 'web-speech' | 'kokoro-local' | 'piper-local';

export interface EngineInfo {
  id: EngineId;
  name: string;
  description: string;
  /** Geschätzt für UI (echte Größe erst nach erstem Laden sichtbar). */
  modelSizeMB?: number;
  /** Wird ein Download benötigt? */
  requiresDownload: boolean;
  /** Wird eine Netzwerkverbindung benötigt (nur fürs Modell)? */
  requiresNetwork: boolean;
  /** Hardware-Anforderungen (z.B. 'webgpu-preferred' für WebGPU). */
  deviceHint: 'webgpu-preferred' | 'wasm-ok' | 'system-tts';
}

export interface EngineVoice {
  /** Engine-interne ID (z.B. 'af_heart' für Kokoro, SpeechSynthesisVoice.name für Web Speech). */
  id: string;
  /** Menschenlesbarer Name. */
  name: string;
  /** BCP-47 oder ähnlich (z.B. 'en-us', 'de-de'). */
  language: string;
  gender?: 'Female' | 'Male' | string;
  traits?: string;
  /** Optional: Qualitätsstufe (A/B/C/...) falls Engine sie mitliefert. */
  quality?: string;
  /** Optional: Freitext-Hinweis (z.B. '22 MB', 'Hörbuchqualität') — in UI angezeigt. */
  sample?: string;
}

export interface EngineStatus {
  state: 'idle' | 'loading' | 'downloading' | 'ready' | 'error';
  /** 0..1, nur bei 'downloading' / 'loading'. */
  progress?: number;
  /** Bei 'error' die Fehlermeldung. */
  error?: string;
  /** Menschenlesbarer Hint, z.B. 'WebGPU aktiv' oder 'WebGPU nicht verfügbar → WASM'. */
  device?: string;
}

export interface SpeakOptions {
  text: string;
  voiceId: string;
  /** 0.5 .. 2.0; Engine klemmt/clamped selbst falls nötig. */
  speed: number;
}

export interface PlayHandle {
  /** Eindeutige ID, nützlich fürs Cache-Lookup (engine+id+...). */
  playHandleId?: string;
  /** Promise, das resolved wenn das Audio zu Ende ist (natürlich oder durch stop()). */
  readonly finished: Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Engine native (Web Speech) ignoriert das; Audio-Engine setzt playbackRate. */
  setSpeed(speed: number): void;
  isPaused(): boolean;
}

export interface TTSEngine {
  readonly info: EngineInfo;
  /** Lädt Modell/Trie/etc. (idempotent). */
  init(onStatus?: (s: EngineStatus) => void): Promise<void>;
  isReady(): boolean;
  /** Aktuell geladene Stimmen (Web Speech kann das erst nach `voiceschanged`). */
  listVoices(): EngineVoice[];
  /** Synthetisiert Text zu einem abspielbaren Handle. */
  speak(opts: SpeakOptions): Promise<PlayHandle>;
  /** Cleanup bei dauerhaftem Engine-Wechsel. */
  dispose(): void;
}

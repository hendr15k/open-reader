import type { TTSEngine, EngineId, EngineStatus } from './types';
import { WebSpeechEngine } from './webSpeechEngine';
import { KokoroLocalEngine } from './kokoroEngine';
import { PiperLocalEngine } from './piperEngine';

/**
 * Zentrale Engine-Registry. Wird vom useTTS-Hook und von der Settings-UI
 * konsumiert, um Engines aufzulisten / zu instanziieren / zu wechseln.
 *
 * `getEngine(id)` ist idempotent: derselbe Engine-Instance wird wiederverwendet,
 * damit ein Modell, das einmal geladen wurde, nicht beim Wechsel aus der UI
 * neu heruntergeladen wird.
 */
const engines = new Map<EngineId, TTSEngine>();

/** Die Reihenfolge hier bestimmt die Anzeige-Reihenfolge in der UI. */
const ORDER: EngineId[] = ['web-speech', 'piper-local', 'kokoro-local'];

export function listEngines(): TTSEngine[] {
  return ORDER.map(getEngine);
}

export function getEngine(id: EngineId): TTSEngine {
  let e = engines.get(id);
  if (e) return e;
  switch (id) {
    case 'web-speech':
      e = new WebSpeechEngine();
      break;
    case 'kokoro-local':
      e = new KokoroLocalEngine();
      break;
    case 'piper-local':
      e = new PiperLocalEngine();
      break;
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown engine id: ${exhaustive as string}`);
    }
  }
  engines.set(id, e);
  return e;
}

/** Status-Listener; mehrere Komponenten können gleichzeitig lauschen. */
type Listener = (engineId: EngineId, status: EngineStatus) => void;
const listeners = new Set<Listener>();

export function onEngineStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyStatus(engineId: EngineId, status: EngineStatus): void {
  listeners.forEach(l => l(engineId, status));
}

/** Wenn der User auf eine andere Engine wechselt: vorherige disposen,
 *  Modell-Speicher wird freigegeben (außer Browser-Cache). */
export function disposeEngine(id: EngineId): void {
  const e = engines.get(id);
  if (e) {
    e.dispose();
    engines.delete(id);
  }
}

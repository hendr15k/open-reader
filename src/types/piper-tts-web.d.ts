// Ambient module declaration for `piper-tts-web`.
//
// `piper-tts-web` ist ein reines JS-Bundle ohne vollständige Type-Defs.
// Wir deklarieren nur das, was wir tatsächlich importieren — Vite/TS
// akzeptiert den Import dann ohne `--ignoreUnknown` und Code-Refs werden
// in der IDE aufgelöst.
declare module 'piper-tts-web' {
  export class PiperWebWorkerEngine {
    constructor(opts?: {
      onnxRuntime?: unknown;
      phonemizeRuntime?: unknown;
      expressionRuntime?: unknown;
      voiceProvider?: unknown;
    });
    generate(text: string, voice: string, speaker?: number): Promise<{
      phonemeData: unknown;
      file: Blob;
      duration: number;
    }>;
    expressions(phonemeData: unknown, duration?: number): Promise<{ mouth: unknown; face: unknown[] }>;
    destroy(): void;
  }
  export class OnnxWebGPUWorkerRuntime {
    constructor(opts?: { worker?: unknown; basePath?: string; numThreads?: number });
    destroy(): void;
  }
  export class OnnxWebWorkerRuntime {
    constructor(opts?: { worker?: unknown; basePath?: string; numThreads?: number });
    destroy(): void;
  }
  export class HuggingFaceVoiceProvider {
    constructor(opts?: { provider?: unknown; baseUrl?: string; separator?: string });
    list(): Promise<Record<string, {
      name: string;
      language?: { code?: string; name?: string };
      quality?: string;
      num_speakers?: number;
    }>>;
    fetch(voice: string): Promise<[unknown, Blob]>;
    destroy(): void;
  }
  // — Selten genutzt, hier nur der Vollständigkeit halber —
  export class PiperWebEngine {
    constructor(opts?: unknown);
    generate(text: string, voice: string, speaker?: number): Promise<unknown>;
  }
  export class OnnxWebGPURuntime {}
  export class OnnxWebRuntime {}
  export class PhonemizeWebWorkerRuntime {}
  export class ExpressionWebWorkerRuntime {}
}

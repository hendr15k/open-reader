import { test } from 'node:test';
import * as assert from 'node:assert';

// Mock browser globals BEFORE importing the module under test.
const fakeVoices: Array<{ name: string; lang: string }> = [
  { name: 'Microsoft Stefan - German (Germany)', lang: 'de-DE' },
  { name: 'Google Deutsch', lang: 'de-DE' },
  { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' },
];

let cancelledCount = 0;
let spokenUtterances: Array<{ text: string; rate: number; voice: { name: string } | null; ended: boolean }> = [];

class FakeSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  voice: { name: string; lang: string } | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}

// Im echten Browser ist `SpeechSynthesisUtterance` ein globales Constructor.
// Im Node-Testlauf hängen wir es an globalThis, damit `new ...` im Engine
// funktioniert.
(globalThis as unknown as { SpeechSynthesisUtterance: typeof FakeSpeechSynthesisUtterance })
  .SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;
(globalThis as unknown as { window: unknown }).window = {
  speechSynthesis: {
    getVoices: () => fakeVoices,
    cancel: () => { cancelledCount++; },
    speak: (u: FakeSpeechSynthesisUtterance) => {
      const rec = { text: u.text, rate: u.rate, voice: u.voice as { name: string } | null, ended: false };
      spokenUtterances.push(rec);
      // simulate natural end after a microtask
      setImmediate(() => {
        rec.ended = true;
        u.onend?.();
      });
    },
    pause: () => {},
    resume: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  },
};

test('WebSpeechEngine.init() reports ready when speechSynthesis is present', async () => {
  const { WebSpeechEngine } = await import('../webSpeechEngine');
  const engine = new WebSpeechEngine();
  const statuses: string[] = [];
  await engine.init((s) => statuses.push(s.state));
  assert.strictEqual(statuses[statuses.length - 1], 'ready', 'last status should be ready');
  assert.strictEqual(engine.isReady(), true);
});

test('WebSpeechEngine.listVoices() returns the browser voice list with normalized fields', async () => {
  const { WebSpeechEngine } = await import('../webSpeechEngine');
  const engine = new WebSpeechEngine();
  const voices = engine.listVoices();
  assert.strictEqual(voices.length, fakeVoices.length);
  for (const v of voices) {
    assert.ok(typeof v.id === 'string' && v.id.length > 0, 'voice has id');
    assert.ok(typeof v.language === 'string' && v.language.length > 0, 'voice has language');
  }
});

test('WebSpeechEngine.speak() creates a PlayHandle that resolves on natural end', async () => {
  spokenUtterances = [];
  cancelledCount = 0;
  const { WebSpeechEngine } = await import('../webSpeechEngine');
  const engine = new WebSpeechEngine();
  const handle = await engine.speak({ text: 'Hallo Welt.', voiceId: 'Google Deutsch', speed: 1.25 });
  assert.strictEqual(spokenUtterances.length, 1, 'one utterance spoken');
  assert.strictEqual(spokenUtterances[0].rate, 1.25, 'speed propagated to utterance');
  await handle.finished;
  assert.ok(spokenUtterances[0].ended, 'natural end fired');
});

test('WebSpeechEngine.speak() clamps speed to safe range', async () => {
  spokenUtterances = [];
  const { WebSpeechEngine } = await import('../webSpeechEngine');
  const engine = new WebSpeechEngine();
  await engine.speak({ text: 'x', voiceId: 'Google Deutsch', speed: 99 });
  assert.strictEqual(spokenUtterances[0].rate, 10, 'rate clamped to 10');
  spokenUtterances = [];
  await engine.speak({ text: 'x', voiceId: 'Google Deutsch', speed: 0.001 });
  assert.strictEqual(spokenUtterances[0].rate, 0.1, 'rate clamped to 0.1');
});

test('WebSpeechEngine.speak() stop() resolves the finished promise immediately', async () => {
  spokenUtterances = [];
  cancelledCount = 0;
  const { WebSpeechEngine } = await import('../webSpeechEngine');
  const engine = new WebSpeechEngine();
  const handle = await engine.speak({ text: 'langer text', voiceId: 'Google Deutsch', speed: 1 });
  handle.stop();
  await handle.finished; // should resolve quickly
  assert.ok(cancelledCount >= 1, 'speechSynthesis.cancel was called');
});

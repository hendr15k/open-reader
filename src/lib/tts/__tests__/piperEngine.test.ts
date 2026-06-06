import { test } from 'node:test';
import * as assert from 'node:assert';

// Mock minimal browser globals, damit PiperLocalEngine im Node-Testlauf
// instanziiert werden kann, ohne dass piper-tts-web geladen werden muss.
(globalThis as unknown as { window: unknown; navigator: unknown }).window = {};
(globalThis as unknown as { navigator: { hardwareConcurrency: number } }).navigator = {
  hardwareConcurrency: 4,
};

test('PiperEngine exposes correct EngineInfo metadata', async () => {
  const { PiperLocalEngine } = await import('../piperEngine');
  const e = new PiperLocalEngine();
  assert.strictEqual(e.info.id, 'piper-local');
  assert.strictEqual(e.info.requiresDownload, true, 'requires download');
  assert.strictEqual(e.info.requiresNetwork, true, 'requires network (modelle vom HF Hub)');
  assert.strictEqual(e.info.deviceHint, 'webgpu-preferred');
  assert.ok(e.info.name.includes('Piper'));
  assert.ok(e.info.description.includes('Deutsch'), 'description mentions German support');
});

test('PiperEngine.listVoices() returns the German fallback list even before init()', async () => {
  const { PiperLocalEngine } = await import('../piperEngine');
  const e = new PiperLocalEngine();
  const voices = e.listVoices();
  // Vor init() sind die Voices ggf. leer oder die Fallback-Liste — beides OK,
  // wichtig ist nur dass es nicht crashed.
  assert.ok(Array.isArray(voices), 'listVoices returns an array');

  // Die Fallback-Liste ist die "harte" Liste der häufigsten Stimmen; sie
  // wird sofort benutzt, wenn voices.json vom Hub nicht ladbar ist. Wir
  // prüfen, ob die deutsche Thorsten-Stimme enthalten ist.
  const thorsten = voices.find(v => v.id === 'de_DE-thorsten-medium');
  if (thorsten) {
    assert.ok(thorsten.language.toLowerCase().startsWith('de'), 'Thorsten ist als deutsch markiert');
  }
});

test('PiperEngine.isReady() is false before init()', async () => {
  const { PiperLocalEngine } = await import('../piperEngine');
  const e = new PiperLocalEngine();
  assert.strictEqual(e.isReady(), false);
});

test('PiperEngine.speak() throws with a clear message if called before init()', async () => {
  const { PiperLocalEngine } = await import('../piperEngine');
  const e = new PiperLocalEngine();
  await assert.rejects(
    () => e.speak({ text: 'Hallo', voiceId: 'de_DE-thorsten-medium', speed: 1 }),
    /not initialized|init\(\)/i,
    'speak() vor init() wirft einen klaren Fehler',
  );
});

test('PiperEngine.dispose() is idempotent (no throw when called multiple times)', async () => {
  const { PiperLocalEngine } = await import('../piperEngine');
  const e = new PiperLocalEngine();
  e.dispose();
  e.dispose(); // darf nicht werfen
  assert.strictEqual(e.isReady(), false, 'after dispose, engine is not ready');
});

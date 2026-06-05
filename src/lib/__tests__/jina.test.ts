import { test } from 'node:test';
import * as assert from 'node:assert';
import { buildJinaUrl } from '../jina';

test('buildJinaUrl', async (t) => {
  await t.test('preserves https:// protocol', () => {
    assert.strictEqual(
      buildJinaUrl('https://example.com/article'),
      'https://r.jina.ai/https://example.com/article',
    );
  });

  await t.test('preserves http:// protocol', () => {
    assert.strictEqual(
      buildJinaUrl('http://example.com/article'),
      'https://r.jina.ai/http://example.com/article',
    );
  });

  await t.test('defaults to http:// for protocol-less URLs', () => {
    assert.strictEqual(
      buildJinaUrl('example.com/article'),
      'https://r.jina.ai/http://example.com/article',
    );
  });

  await t.test('does not downgrade https to http', () => {
    // Regression: the old code unconditionally prepended `http://`, which
    // would turn `https://example.com` into
    // `https://r.jina.ai/http://example.com`. Assert this never happens.
    const result = buildJinaUrl('https://example.com');
    assert.ok(!result.includes('r.jina.ai/http://example.com'),
      'https URL must not be downgraded to http');
    assert.ok(result.includes('r.jina.ai/https://example.com'),
      'https URL should be passed through as https');
  });

  await t.test('handles URLs with query strings and fragments', () => {
    assert.strictEqual(
      buildJinaUrl('https://example.com/path?q=1&r=2#section'),
      'https://r.jina.ai/https://example.com/path?q=1&r=2#section',
    );
  });
});

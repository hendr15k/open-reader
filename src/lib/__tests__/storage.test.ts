import { test } from 'node:test';
import * as assert from 'node:assert';
import esmock from 'esmock';

// Helper: build a fake idb openDB() that tracks puts, gets, deletes, and
// pre-populates the object stores. The returned `db` is what the module-under-
// test will see when it calls `getDB()`.
function makeFakeDB({
  articles = [] as Array<Record<string, unknown> & { url: string }>,
  files = [] as Array<Record<string, unknown> & { id: string }>,
}: { articles?: any[]; files?: any[] } = {}) {
  const calls: { op: string; store: string; arg?: unknown }[] = [];
  const articlesByKey = new Map(articles.map(a => [a.url, a]));
  const filesByKey = new Map(files.map(f => [f.id, f]));

  return {
    calls,
    db: {
      get: async (store: string, key: string) => {
        calls.push({ op: 'get', store, arg: key });
        return store === 'articles' ? articlesByKey.get(key) : filesByKey.get(key);
      },
      getAll: async (store: string) => {
        calls.push({ op: 'getAll', store });
        return store === 'articles' ? Array.from(articlesByKey.values()) : Array.from(filesByKey.values());
      },
      put: async (store: string, value: any) => {
        calls.push({ op: 'put', store, arg: value });
        if (store === 'articles') articlesByKey.set(value.url, value);
        else filesByKey.set(value.id, value);
      },
      delete: async (store: string, key: string) => {
        calls.push({ op: 'delete', store, arg: key });
        if (store === 'articles') articlesByKey.delete(key);
        else filesByKey.delete(key);
      },
      objectStoreNames: { contains: () => true },
    },
  };
}

test('removeArticle', async (t) => {
  await t.test('removes file by id from the files store', async () => {
    const { calls, db } = makeFakeDB({ files: [{ id: 'file-1', title: 'X' }] });
    const { removeArticle } = await esmock('../storage.ts', { idb: { openDB: async () => db } });

    await removeArticle('file-1');

    // No need to scan articles for files (the article-store getAll should
    // not have been needed); the direct id-based file delete is enough.
    const deletes = calls.filter(c => c.op === 'delete');
    assert.deepStrictEqual(
      deletes.map(c => ({ store: c.store, arg: c.arg })),
      [{ store: 'files', arg: 'file-1' }],
      'Should only delete the file directly',
    );
  });

  await t.test('removes URL article by scanning for matching id then deleting by url', async () => {
    // KEY: articles store uses `url` as its keyPath, but the Article object
    // also has a separate `id` field. The fix here is that we must look up
    // the url-keyed article by its `id` field, then delete by `url`.
    const { calls, db } = makeFakeDB({
      articles: [
        { id: 'uuid-A', url: 'https://example.com/a', title: 'A', favorite: false },
        { id: 'uuid-B', url: 'https://example.com/b', title: 'B', favorite: true },
      ],
    });
    const { removeArticle } = await esmock('../storage.ts', { idb: { openDB: async () => db } });

    await removeArticle('uuid-A');

    // We expect:
    //  1. No delete against the files store (no file with that id)
    //  2. A getAll('articles') to scan for the matching id
    //  3. A delete against the articles store with the *url* (not the id)
    const deletes = calls.filter(c => c.op === 'delete');
    assert.deepStrictEqual(
      deletes.map(c => ({ store: c.store, arg: c.arg })),
      [{ store: 'articles', arg: 'https://example.com/a' }],
      'URL article should be deleted by its url key, not its id',
    );
  });

  await t.test('is a silent no-op when neither store has the id', async () => {
    const { calls, db } = makeFakeDB({});
    const { removeArticle } = await esmock('../storage.ts', { idb: { openDB: async () => db } });

    // Should not throw.
    await removeArticle('does-not-exist');

    const deletes = calls.filter(c => c.op === 'delete');
    assert.strictEqual(deletes.length, 0, 'No deletes should occur for unknown id');
  });
});

test('toggleFavorite', async (t) => {
  await t.test('updates the favorite flag of a URL-keyed article by its id', async () => {
    // Before the fix, toggleFavorite called `database.get('articles', id)`,
    // but the articles store is keyed by `url`. The lookup would silently
    // miss and the favorite toggle would do nothing.
    const { calls, db } = makeFakeDB({
      articles: [
        { id: 'uuid-A', url: 'https://example.com/a', title: 'A', favorite: false },
      ],
    });
    const { toggleFavorite } = await esmock('../storage.ts', { idb: { openDB: async () => db } });

    await toggleFavorite('uuid-A', true);

    const puts = calls.filter(c => c.op === 'put' && c.store === 'articles');
    assert.strictEqual(puts.length, 1, 'Should put the article back with favorite=true');
    const updated = (puts[0].arg as any);
    assert.strictEqual(updated.favorite, true, 'favorite should now be true');
    assert.strictEqual(updated.url, 'https://example.com/a', 'should put back under same url key');
  });

  await t.test('updates a file-sourced article directly by id', async () => {
    const { calls, db } = makeFakeDB({
      files: [{ id: 'file-1', title: 'X', favorite: false }],
    });
    const { toggleFavorite } = await esmock('../storage.ts', { idb: { openDB: async () => db } });

    await toggleFavorite('file-1', true);

    const puts = calls.filter(c => c.op === 'put' && c.store === 'files');
    assert.strictEqual(puts.length, 1, 'Should put the file back with favorite=true');
    assert.strictEqual((puts[0].arg as any).favorite, true);
  });

  await t.test('does not throw when the id does not match any article or file', async () => {
    const { db } = makeFakeDB({});
    const { toggleFavorite } = await esmock('../storage.ts', { idb: { openDB: async () => db } });
    await toggleFavorite('ghost', true); // must not throw
  });
});

test('isUrlSaved', async (t) => {
  await t.test('returns true when an article with that url exists', async () => {
    const { db } = makeFakeDB({
      articles: [{ id: 'uuid-A', url: 'https://example.com/a', title: 'A' }],
    });
    const { isUrlSaved } = await esmock('../storage.ts', { idb: { openDB: async () => db } });

    assert.strictEqual(await isUrlSaved('https://example.com/a'), true);
    assert.strictEqual(await isUrlSaved('https://example.com/zzz'), false);
  });
});

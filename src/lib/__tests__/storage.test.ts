import { test } from 'node:test';
import * as assert from 'node:assert';
import esmock from 'esmock';

test('removeArticle tests', async (t) => {
  await t.test('successfully removes article from both stores', async () => {
    const deleteCalls: Array<{ store: string, id: string }> = [];

    const { removeArticle } = await esmock('../storage.ts', {
      idb: {
        openDB: async () => ({
          delete: async (store: string, id: string) => {
            deleteCalls.push({ store, id });
          },
          objectStoreNames: { contains: () => true },
        })
      }
    });

    await removeArticle('test-id-123');

    assert.strictEqual(deleteCalls.length, 2, 'Should call delete twice');
    assert.deepStrictEqual(deleteCalls[0], { store: 'articles', id: 'test-id-123' }, 'Should delete from articles store');
    assert.deepStrictEqual(deleteCalls[1], { store: 'files', id: 'test-id-123' }, 'Should delete from files store');
  });

  await t.test('propagates errors from delete operation', async () => {
    const { removeArticle } = await esmock('../storage.ts', {
      idb: {
        openDB: async () => ({
          delete: async () => {
            throw new Error('Database delete error');
          },
          objectStoreNames: { contains: () => true },
        })
      }
    });

    await assert.rejects(
      async () => {
        await removeArticle('test-id-123');
      },
      (error: Error) => {
        assert.strictEqual(error.message, 'Database delete error');
        return true;
      },
      'Should propagate the error thrown by database.delete'
    );
  });
});

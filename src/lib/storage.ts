import { openDB } from 'idb';
import { Article } from './types';

const DB_NAME = 'OpenReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'articles';

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt');
      }
    },
  });
}

export async function saveArticle(article: Article): Promise<void> {
  const db = await initDB();
  await db.put(STORE_NAME, article);
}

export async function getArticle(id: string): Promise<Article | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME, id);
}

export async function getAllArticles(): Promise<Article[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function deleteArticle(id: string): Promise<void> {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
}

export async function isArticleSaved(url: string): Promise<boolean> {
  const db = await initDB();
  const all = await db.getAll(STORE_NAME);
  return all.some(a => a.url === url);
}
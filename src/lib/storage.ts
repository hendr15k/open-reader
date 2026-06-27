import { openDB, type IDBPDatabase } from 'idb';
import type { Article, Bookmark } from './types';

const DB_NAME = 'open-reader-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          if (!database.objectStoreNames.contains('articles')) {
            database.createObjectStore('articles', { keyPath: 'url' });
          }
        }
        if (oldVersion < 2) {
          if (!database.objectStoreNames.contains('files')) {
            database.createObjectStore('files', { keyPath: 'id' });
          }
        }
        if (oldVersion < 3) {
          if (!database.objectStoreNames.contains('bookmarks')) {
            database.createObjectStore('bookmarks', { keyPath: 'id' });
          }
        }
      },
    }).catch(e => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

export async function getAllArticles(): Promise<Article[]> {
  const database = await getDB();
  const articles = await database.getAll('articles');
  const files = await database.getAll('files');
  return [...articles, ...files.map(f => ({
    id: String(f.id),
    url: '',
    title: f.title,
    content: f.content,
    author: '',
    date: new Date(f.uploadedAt).toLocaleDateString(),
    readingTime: f.readingTime,
    savedAt: f.uploadedAt,
    source: 'file' as const,
    fileName: f.fileName,
    totalWords: f.totalWords,
    favorite: f.favorite || false,
  }))];
}

export async function getAllUploadedFiles(): Promise<any[]> {
  const database = await getDB();
  return database.getAll('files');
}

export async function addArticle(article: Article): Promise<void> {
  const database = await getDB();
  if (article.source === 'file' && article.fileName) {
    await database.put('files', {
      id: article.id,
      title: article.title,
      content: article.content,
      fileName: article.fileName,
      uploadedAt: article.savedAt,
      totalWords: article.totalWords || article.content.split(/\s+/).length,
      readingTime: article.readingTime || Math.ceil((article.totalWords || article.content.split(/\s+/).length) / 200),
      favorite: article.favorite || false,
    });
  } else {
    await database.put('articles', article);
  }
}

export async function addUploadedFile(file: any): Promise<void> {
  const database = await getDB();
  await database.put('files', file);
}

export async function removeArticle(id: string): Promise<void> {
  const database = await getDB();
  // Fast path: files are keyed by `id`, so a direct get is O(1).
  const file = await database.get('files', id);
  if (file) {
    await database.delete('files', id);
    return;
  }
  // Slow path: URL articles are keyed by `url`, NOT `id`. We have to scan
  // every article, find the one whose `id` field matches, and delete by its
  // real key (its `url`). Without this scan, deleting a URL-sourced article
  // was a silent no-op (and remains a top user complaint).
  const articles = await database.getAll('articles');
  const target = articles.find((a: Article) => a.id === id && a.url);
  if (target?.url) {
    await database.delete('articles', target.url);
  }
}

export async function removeUploadedFile(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('files', id);
}

export async function getArticleCount(): Promise<number> {
  const database = await getDB();
  const articles = await database.getAllKeys('articles');
  const files = await database.getAllKeys('files');
  return articles.length + files.length;
}

export const saveArticle = addArticle;
export const deleteArticle = removeArticle;
export const isArticleSaved = isUrlSaved;

export async function isUrlSaved(url: string): Promise<boolean> {
  const database = await getDB();
  const article = await database.get('articles', url);
  return !!article;
}

// Bookmark functions
export async function getAllBookmarks(): Promise<Bookmark[]> {
  const database = await getDB();
  return database.getAll('bookmarks');
}

export async function getBookmarksForArticle(articleId: string): Promise<Bookmark[]> {
  const all = await getAllBookmarks();
  return all.filter(b => b.articleId === articleId);
}

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const database = await getDB();
  await database.put('bookmarks', bookmark);
}

export async function removeBookmark(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('bookmarks', id);
}

export async function getBookmarkCount(): Promise<number> {
  const database = await getDB();
  return (await database.getAllKeys('bookmarks')).length;
}

export async function getFavoriteArticles(): Promise<string[]> {
  const database = await getDB();
  const articles = await database.getAll('articles');
  const files = await database.getAll('files');
  const favIds: string[] = [];
  for (const a of articles) { if (a.favorite) favIds.push(a.url || a.id); }
  for (const f of files) { if (f.favorite) favIds.push(f.id); }
  return favIds;
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const database = await getDB();
  // Files are keyed by `id` — straight lookup works.
  const file = await database.get('files', id);
  if (file) { await database.put('files', { ...file, favorite: isFavorite }); }
  // URL articles are keyed by `url` — scan to find the one whose `id` field
  // matches, then update by its real key. Without this, favoriting a URL
  // article silently did nothing.
  const articles = await database.getAll('articles');
  const target = articles.find((a: Article) => a.id === id && a.url);
  if (target?.url) {
    await database.put('articles', { ...target, favorite: isFavorite });
  }
}

import { openDB, type IDBPDatabase } from 'idb';
import type { Article } from './types';

const DB_NAME = 'open-reader-db';
const DB_VERSION = 2;

let db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
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
    },
  });

  return db;
}

export async function getAllArticles(): Promise<Article[]> {
  const database = await getDB();
  const articles = await database.getAll('articles');
  const files = await database.getAll('files');
  return [...articles, ...files.map(f => ({
    id: f.id,
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
  await database.delete('articles', id);
  await database.delete('files', id);
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

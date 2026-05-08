// IndexedDB storage for EPUB files and reading positions
const DB_NAME = 'open-reader-epubs';
const STORE_FILES = 'epub-files';
const STORE_BOOKMARKS = 'epub-bookmarks';
const DB_VERSION = 3;

interface EpubFile {
  id: number;
  title: string;
  author?: string;
  fileName: string;
  coverUrl?: string;
  content: ArrayBuffer;
  createdAt: number;
  fileSize: number;
}

interface EpubBookmark {
  fileId: number;
  location: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BOOKMARKS)) {
        const store = db.createObjectStore(STORE_BOOKMARKS, { keyPath: ['fileId', 'location'] });
        store.createIndex('fileId', 'fileId', { unique: false });
      }
      if (!db.objectStoreNames.contains('epub-progress')) {
        db.createObjectStore('epub-progress', { keyPath: 'fileId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const epubDB = {
  async saveFile(title: string, content: ArrayBuffer, fileName: string, author?: string, coverUrl?: string): Promise<number> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    const id = Date.now();
    await new Promise<void>((resolve, reject) => {
      const req = store.add({ id, title, fileName, author, coverUrl, content, createdAt: Date.now(), fileSize: content.byteLength });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return id;
  },

  async getFile(fileId: number): Promise<EpubFile | undefined> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    const store = tx.objectStore(STORE_FILES);
    return new Promise((resolve, reject) => {
      const req = store.get(fileId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllFiles(): Promise<EpubFile[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    const store = tx.objectStore(STORE_FILES);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteFile(fileId: number): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORE_FILES, STORE_BOOKMARKS], 'readwrite');
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const req = tx.objectStore(STORE_FILES).delete(fileId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const store = tx.objectStore(STORE_BOOKMARKS);
        const index = store.index('fileId');
        const req = index.openCursor(IDBKeyRange.only(fileId));
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) { cursor.delete(); cursor.continue(); }
          else resolve();
        };
        req.onerror = () => reject(req.error);
      })
    ]);
  },

  async getBookmark(fileId: number): Promise<EpubBookmark | undefined> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOKMARKS, 'readonly');
    const store = tx.objectStore(STORE_BOOKMARKS);
    const index = store.index('fileId');
    return new Promise((resolve, reject) => {
      const req = index.getAll(IDBKeyRange.only(fileId));
      req.onsuccess = () => {
        const results: EpubBookmark[] = req.result;
        // Return the last (most recent) bookmark
        resolve(results.length > 0 ? results[results.length - 1] : undefined);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getBookmarks(fileId: number): Promise<EpubBookmark[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOKMARKS, 'readonly');
    const store = tx.objectStore(STORE_BOOKMARKS);
    const index = store.index('fileId');
    return new Promise((resolve, reject) => {
      const req = index.getAll(IDBKeyRange.only(fileId));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveBookmark(fileId: number, location: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOKMARKS, 'readwrite');
    const store = tx.objectStore(STORE_BOOKMARKS);
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ fileId, location, createdAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async deleteBookmark(fileId: number, location: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_BOOKMARKS, 'readwrite');
    const store = tx.objectStore(STORE_BOOKMARKS);
    await new Promise<void>((resolve, reject) => {
      const req = store.delete([fileId, location]);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async saveProgress(fileId: number, location: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('epub-progress', 'readwrite');
    const store = tx.objectStore('epub-progress');
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ fileId, location });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getProgress(fileId: number): Promise<string | null> {
    const db = await openDB();
    const tx = db.transaction('epub-progress', 'readonly');
    const store = tx.objectStore('epub-progress');
    return new Promise((resolve, reject) => {
      const req = store.get(fileId);
      req.onsuccess = () => resolve(req.result?.location || null);
      req.onerror = () => reject(req.error);
    });
  },
};

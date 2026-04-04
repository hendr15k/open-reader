import { useState, useEffect, useRef } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import { ChevronLeft, BookOpen, Bookmark, Maximize2, Minimize2, Save } from 'lucide-react';
import { epubDB } from '../lib/epubDB';

interface EpubReaderProps {
  fileId: number;
  onClose: () => void;
  title: string;
  author?: string;
  coverUrl?: string;
}

export default function EpubReader({ fileId, onClose, title, author }: EpubReaderProps) {
  const [epubContent, setEpubContent] = useState<ArrayBuffer | null>(null);
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const renditionRef = useRef<any>(null);

  useEffect(() => {
    const loadEpub = async () => {
      const file = await epubDB.getFile(fileId);
      if (file) {
        setEpubContent(file.content);
        const savedLoc = await epubDB.getBookmark(fileId);
        if (savedLoc) setLocation(savedLoc.location);
        const bmList = await epubDB.getBookmarks(fileId);
        setBookmarks(new Set(bmList.map((b: any) => b.location)));
      }
    };
    loadEpub();
  }, [fileId]);

  const handleLocationChanged = async (loc: string | number) => {
    const locStr = String(loc);
    setLocation(locStr);
    await epubDB.saveBookmark(fileId, locStr);
  };

  const getRendition = (rendition: any) => {
    renditionRef.current = rendition;
    rendition.themes.fontSize('16px');
    rendition.themes.lineHeight('1.6');
    rendition.themes.registerFont('serif', 'Georgia, serif');
    rendition.themes.font('serif');
  };

  const toggleBookmark = async () => {
    if (!location) return;
    const newBookmarks = new Set(bookmarks);
    if (newBookmarks.has(location)) {
      newBookmarks.delete(location);
      await epubDB.deleteBookmark(fileId, location);
    } else {
      newBookmarks.add(location);
      await epubDB.saveBookmark(fileId, location);
    }
    setBookmarks(newBookmarks);
  };

  const handleSave = async () => {
    if (location) {
      await epubDB.saveBookmark(fileId, location);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 ${immersiveMode ? 'opacity-0 pointer-events-none h-0 overflow-hidden border-0' : ''}`}>
        <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="flex-1 mx-4 overflow-hidden">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
          {author && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{author}</p>}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{bookmarks.size} 🔖</span>
          <button onClick={toggleBookmark} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${bookmarks.has(location || '') ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
            <Bookmark className="w-4 h-4" />
          </button>
          <button onClick={() => setImmersiveMode(!immersiveMode)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            {immersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={handleSave} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* EPUB Reader */}
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 relative">
        {epubContent ? (
          <ReactReader
            url={epubContent}
            location={location || null}
            locationChanged={handleLocationChanged}
            getRendition={getRendition}
            readerStyles={ReactReaderStyle}
            loadingView={
              <div className="flex items-center justify-center h-full">
                <BookOpen className="w-12 h-12 text-indigo-400 animate-pulse" />
              </div>
            }
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <BookOpen className="w-12 h-12 text-gray-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

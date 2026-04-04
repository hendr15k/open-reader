import { useState, useEffect, lazy, Suspense } from 'react';
import { BookOpen, Bookmark, Settings, Moon, Sun, Rss, Zap, Headphones, Upload } from 'lucide-react';
import { Article, Tab } from './lib/types';
import { fetchArticle } from './lib/jina';
import { useArticleStorage } from './hooks/useArticleStorage';
import { epubDB } from './lib/epubDB';
import URLInput from './components/URLInput';
import ArticleView from './components/ArticleView';
import SavedArticles from './components/SavedArticles';
import FileUpload from './components/FileUpload';
const EpubReader = lazy(() => import('./components/EpubReader'));
const EpubUpload = lazy(() => import('./components/EpubUpload'));
const EpubLibrary = lazy(() => import('./components/EpubLibrary'));

interface EpubEntry {
  id: number;
  title: string;
  author?: string;
}

// Demo article to showcase the app
const DEMO_ARTICLE: Article = {
  id: 'demo',
  url: 'https://example.com/demo',
  title: 'Welcome to Open Reader',
  content: `Open Reader transforms any web article into a peaceful reading experience.

Paste any URL above to begin. The article will be extracted and formatted for comfortable reading, without ads, distractions, or cluttered layouts.

🎧 Listen Anywhere
Use the built-in text-to-speech to listen to articles while multitasking. Adjust the reading speed and choose from different voices to match your preference.

💾 Read Offline
Save articles to your library and read them later, even without an internet connection. Your saved articles are stored locally on your device.

🌙 Easy on the Eyes
Switch to dark mode for comfortable reading at night. The app automatically follows your system preference, or toggle it manually in settings.

📱 Works Everywhere
Whether you're on a phone, tablet, or computer, the app provides a clean, responsive reading experience that adapts to your screen.

Try it now — paste a URL in the box above and start reading.`,
  author: 'Open Reader Team',
  date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  readingTime: 2,
  savedAt: Date.now(),
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [epubReader, setEpubReader] = useState<EpubEntry | null>(null);
  const [epubUpload, setEpubUpload] = useState(false);
  const [epubLibraryView, setEpubLibraryView] = useState(false);
  const [_, setEpubLibraryList] = useState<EpubEntry[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const { articles, loading, addArticle, removeArticle, checkSaved, reload } = useArticleStorage();
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load EPUB library
  useEffect(() => {
    const load = async () => {
      const files = await epubDB.getAllFiles();
      setEpubLibraryList(files.map(f => ({ id: f.id, title: f.title, author: f.author })));
    };
    load();
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const handleFetch = async (url: string) => {
    setFetching(true);
    setError(null);

    try {
      const articleData = await fetchArticle(url);
      const article: Article = {
        id: articleData.id || Date.now().toString(),
        url: articleData.url,
        title: articleData.title || 'Untitled Article',
        content: articleData.content,
        author: articleData.author,
        date: articleData.date,
        readingTime: articleData.readingTime,
        savedAt: Date.now(),
      };
      setCurrentArticle(article);
      setIsSaved(await checkSaved(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch article');
    } finally {
      setFetching(false);
    }
  };

  const handleSaveArticle = async () => {
    if (!currentArticle) return;
    try {
      await addArticle(currentArticle);
      setIsSaved(true);
    } catch (err) {
      console.error('Error saving article:', err);
    }
  };

  const handleFileProcessed = async (content: string, title: string, fileName: string, fileType: string) => {
    const wordCount = content.split(/\s+/).length;
    const article: Article = {
      id: 'file_' + Date.now(),
      title: title,
      content: content,
      author: `Uploaded ${fileType.toUpperCase()}`,
      date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      readingTime: Math.ceil(wordCount / 200),
      savedAt: Date.now(),
      source: 'file',
      fileName: fileName,
      totalWords: wordCount,
    };
    setCurrentArticle(article);
    setIsSaved(true);
    // Save to IndexedDB
    try {
      await addArticle(article);
    } catch (err) {
      console.error('Error saving uploaded file:', err);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await removeArticle(id);
      if (currentArticle?.id === id) {
        setIsSaved(false);
      }
      reload();
    } catch (err) {
      console.error('Error deleting article:', err);
    }
  };

  const handleOpenDemo = () => {
    setCurrentArticle(DEMO_ARTICLE);
    setIsSaved(false);
  };

  // EPUB Upload handler
  const handleEpubUploaded = async (fileId: number, title: string) => {
    setEpubUpload(false);
    setEpubLibraryView(false);
    const files = await epubDB.getAllFiles();
    setEpubLibraryList(files.map(f => ({ id: f.id, title: f.title, author: f.author })));
    setEpubReader({ id: fileId, title });
  };

  // EPUB Reader view
  if (epubReader) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading EPUB Reader...</p></div>}>
        <EpubReader
          fileId={epubReader.id}
          title={epubReader.title}
          author={epubReader.author}
          onClose={() => setEpubReader(null)}
        />
      </Suspense>
    );
  }

  // EPUB Library view
  if (epubLibraryView) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading EPUB Library...</p></div>}>
        <EpubLibrary
          onOpenEpub={(id, title) => setEpubReader({ id, title })}
          onBack={() => setEpubLibraryView(false)}
        />
      </Suspense>
    );
  }

  // EPUB Upload view
  if (epubUpload) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading EPUB Upload...</p></div>}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setEpubUpload(false)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">EPUB hochladen</h1>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <EpubUpload onUploadComplete={handleEpubUploaded} onCancel={() => setEpubUpload(false)} />
        </div>
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 safe-area-bottom">
          <div className="max-w-3xl mx-auto flex">
            {[
              { id: 'home' as Tab, icon: BookOpen, label: 'Read' },
              { id: 'saved' as Tab, icon: Bookmark, label: 'Library' },
              { id: 'upload' as Tab, icon: Upload, label: 'Upload' },
              { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setCurrentTab(id)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 ${
                  currentTab === id
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
      </Suspense>
    );
  }

  // Render article view
  if (currentArticle) {
    return (
      <ArticleView
        article={currentArticle}
        onClose={() => {
          setCurrentArticle(null);
          setIsSaved(false);
        }}
        onSave={handleSaveArticle}
        isSaved={isSaved}
      />
    );
  }

  if (currentTab === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setCurrentTab('home')}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">Datei hochladen</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">PDF, TXT, EPUB, MD → TTS Hörbuch</p>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* EPUB Library Button */}
          <button
            onClick={() => setEpubLibraryView(true)}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-5 text-left shadow-lg shadow-emerald-500/10 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">EPUB Bibliothek</h3>
                <p className="text-sm text-white/80">Deine hochgeladenen EPUBs ansehen und lesen</p>
              </div>
            </div>
          </button>

          <FileUpload onFileProcessed={handleFileProcessed} />
        </div>
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 safe-area-bottom">
          <div className="max-w-3xl mx-auto flex">
            {[
              { id: 'home' as Tab, icon: BookOpen, label: 'Read' },
              { id: 'saved' as Tab, icon: Bookmark, label: 'Library' },
              { id: 'upload' as Tab, icon: Upload, label: 'Upload' },
              { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setCurrentTab(id)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 ${
                  currentTab === id
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  // Main tabs
  if (currentTab === 'saved') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <SavedArticles
          articles={articles}
          loading={loading}
          onSelectArticle={(article) => {
            setCurrentArticle(article);
            setIsSaved(true);
          }}
          onDeleteArticle={handleDeleteArticle}
          onBack={() => setCurrentTab('home')}
        />
      </div>
    );
  }

  if (currentTab === 'settings') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setCurrentTab('home')}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">Settings</h1>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Appearance */}
          <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Appearance</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {darkMode ? <Moon className="w-5 h-5 text-indigo-600" /> : <Sun className="w-5 h-5 text-amber-500" />}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Follows system by default</p>
                  </div>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    darkMode ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">About</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Open Reader</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Version 1.2.0</p>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                A beautiful, distraction-free article reader with text-to-speech built right in.
                Paste any URL to start reading.
              </p>
              <div className="pt-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Powered by Jina Reader
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Home tab
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Open Reader</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Distraction-free reading</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>

          {/* URL Input */}
          <URLInput onFetch={handleFetch} loading={fetching} />

          {/* Error */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Feature Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {[
            { icon: Headphones, label: 'Text-to-Speech', color: 'text-purple-600 dark:text-purple-400' },
            { icon: Zap, label: 'Instant Parse', color: 'text-amber-600 dark:text-amber-400' },
            { icon: Bookmark, label: 'Offline Reading', color: 'text-emerald-600 dark:text-emerald-400' },
            { icon: Upload, label: 'File Upload', color: 'text-rose-600 dark:text-rose-400' },
          ].map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium whitespace-nowrap"
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-gray-600 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>

        {/* Demo Card */}
        <div className="mb-6">
          <button
            onClick={handleOpenDemo}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-left card-hover shadow-xl shadow-indigo-500/10"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <span className="inline-block px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium text-white/90 mb-2">
                  Try it free
                </span>
                <h3 className="text-lg font-bold text-white mb-1">Welcome to Open Reader</h3>
                <p className="text-sm text-white/80 leading-relaxed">
                  No URL? No problem. Tap here to see how it works.
                </p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center ml-3">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
            </div>
          </button>
        </div>

        {/* Recent Articles */}
        {articles.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Your Library
            </h2>
            <div className="space-y-2">
              {articles.slice(0, 5).map((article) => (
                <button
                  key={article.id}
                  onClick={() => {
                    setCurrentArticle(article);
                    setIsSaved(true);
                  }}
                  className="w-full bg-white dark:bg-gray-900 rounded-xl p-4 text-left border border-gray-200 dark:border-gray-800 card-hover"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {article.readingTime || '?'} min
                    </span>
                    <span>•</span>
                    <span>{new Date(article.savedAt).toLocaleDateString()}</span>
                    {article.author && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-24">{article.author}</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {articles.length === 0 && !fetching && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Rss className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No saved articles yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Paste a URL or upload a file (PDF, TXT, EPUB) to start reading and listening.
            </p>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex">
          {[
            { id: 'home' as Tab, icon: BookOpen, label: 'Read' },
            { id: 'saved' as Tab, icon: Bookmark, label: 'Library' },
            { id: 'upload' as Tab, icon: Upload, label: 'Upload' },
            { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 ${
                currentTab === id
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

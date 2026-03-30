import { useState, useEffect } from 'react';
import { BookOpen, Bookmark, Settings, Moon, Sun } from 'lucide-react';
import { Article, Tab } from './lib/types';
import { fetchArticle } from './lib/jina';
import { useArticleStorage } from './hooks/useArticleStorage';
import URLInput from './components/URLInput';
import ArticleView from './components/ArticleView';
import SavedArticles from './components/SavedArticles';

function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const { articles, loading, addArticle, removeArticle, checkSaved, reload } = useArticleStorage();
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark');
    }
  };

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



  const renderContent = () => {
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

    if (currentTab === 'home') {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-6 sm:px-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-8 h-8 text-primary-600" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Jules Reader
                  </h1>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              </div>

              {/* URL Input */}
              <URLInput onFetch={handleFetch} loading={fetching} />

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Instructions */}
              <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                <p className="font-medium mb-2">Features:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>📖 Fetch and read articles from any URL</li>
                  <li>🎧 Text-to-speech playback with speed control</li>
                  <li>💾 Save articles for offline reading</li>
                  <li>🌙 Dark mode support</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Recent Articles Preview */}
          {articles.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Articles
              </h2>
              <div className="space-y-3">
                {articles.slice(0, 3).map((article) => (
                  <button
                    key={article.id}
                    onClick={() => {
                      setCurrentArticle(article);
                      setIsSaved(true);
                    }}
                    className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {article.title}
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      📖 {article.readingTime} min read •{' '}
                      {new Date(article.savedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentTab === 'saved') {
      return (
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
      );
    }

    if (currentTab === 'settings') {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <button
              onClick={() => setCurrentTab('home')}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">
              Settings
            </h1>
          </div>

          <div className="max-w-3xl mx-auto p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
                Appearance
              </h2>

              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Dark Mode</span>
                <button
                  onClick={toggleDarkMode}
                  className={`px-4 py-2 rounded-lg ${
                    darkMode
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  {darkMode ? 'On' : 'Off'}
                </button>
              </div>

              <div className="py-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">About</p>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <p><strong>Jules Reader</strong> v1.0.0</p>
                  <p className="mt-1">Article reader with TTS support</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      {renderContent()}

      {/* Bottom Navigation */}
      {!currentArticle && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40">
          <div className="max-w-3xl mx-auto flex">
            <button
              onClick={() => setCurrentTab('home')}
              className={`flex-1 py-3 px-4 flex flex-col items-center gap-1 ${
                currentTab === 'home'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-xs">Home</span>
            </button>

            <button
              onClick={() => setCurrentTab('saved')}
              className={`flex-1 py-3 px-4 flex flex-col items-center gap-1 ${
                currentTab === 'saved'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Bookmark className="w-5 h-5" />
              <span className="text-xs">Saved</span>
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`flex-1 py-3 px-4 flex flex-col items-center gap-1 ${
                currentTab === 'settings'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs">Settings</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
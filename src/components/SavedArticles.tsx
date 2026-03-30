import { Trash2, ExternalLink, Bookmark } from 'lucide-react';
import { Article } from '../lib/types';

interface SavedArticlesProps {
  articles: Article[];
  loading: boolean;
  onSelectArticle: (article: Article) => void;
  onDeleteArticle: (id: string) => void;
  onBack: () => void;
}

export default function SavedArticles({
  articles,
  loading,
  onSelectArticle,
  onDeleteArticle,
  onBack,
}: SavedArticlesProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Library</h1>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {articles.length}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading your library...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
              <Bookmark className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Your library is empty
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Save articles to read them offline, anywhere, anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <div
                key={article.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 card-hover"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <button
                    onClick={() => onSelectArticle(article)}
                    className="text-left flex-1"
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {article.title}
                    </h3>
                  </button>
                  <button
                    onClick={() => onDeleteArticle(article.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {article.readingTime && (
                      <span>{article.readingTime} min read</span>
                    )}
                    {article.author && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-24">{article.author}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{new Date(article.savedAt).toLocaleDateString()}</span>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    title="Open source"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

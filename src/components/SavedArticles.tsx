import { Trash2, ExternalLink } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-10">
        <button
          onClick={onBack}
          className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Saved Articles
        </h1>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {articles.length}
        </span>
      </div>

      {/* Articles List */}
      <div className="max-w-3xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading articles...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No saved articles yet
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              Fetch an article and save it to read offline
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <div
                key={article.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3
                    className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 flex-1"
                    onClick={() => onSelectArticle(article)}
                  >
                    {article.title}
                  </h3>
                  <button
                    onClick={() => onDeleteArticle(article.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors flex-shrink-0"
                    title="Delete article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {article.readingTime && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    📖 {article.readingTime} min read
                  </div>
                )}

                {article.summary && (
                  <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-2">
                    ✨ AI Summary available
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {new Date(article.savedAt).toLocaleDateString()}
                  </span>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Source
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
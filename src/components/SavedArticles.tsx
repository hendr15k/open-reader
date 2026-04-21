import { useState, useMemo } from 'react';
import { Trash2, Bookmark, Search, Grid, List, FileText, Globe, SortAsc, SortDesc } from 'lucide-react';
import { Article } from '../lib/types';

function hasSavedProgress(articleId: string): boolean {
  try {
    const saved = localStorage.getItem(`open-reader-progress-${articleId}`);
    if (!saved) return false;
    const idx = parseInt(saved, 10);
    return !isNaN(idx) && idx > 0;
  } catch { return false; }
}

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
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'readingTime'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [filterType, setFilterType] = useState<'all' | 'url' | 'file'>('all');

  const filtered = useMemo(() => {
    let result = [...articles];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(a => filterType === 'file' ? a.source === 'file' : a.source !== 'file');
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.author && a.author.toLowerCase().includes(q)) ||
        (a.fileName && a.fileName.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = a.savedAt - b.savedAt;
      else if (sortBy === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortBy === 'readingTime') cmp = (a.readingTime || 0) - (b.readingTime || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [articles, search, filterType, sortBy, sortDir]);

  const urlCount = articles.filter(a => a.source !== 'file').length;
  const fileCount = articles.filter(a => a.source === 'file').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 px-4 py-3 z-10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">← Zurück</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {urlCount} 📄 • {fileCount} 📁
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Bibliothek durchsuchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Filters + Sort */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button onClick={() => setFilterType('all')} className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterType === 'all' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                Alle ({articles.length})
              </button>
              <button onClick={() => setFilterType('url')} className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterType === 'url' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                <Globe className="w-3 h-3 inline mr-1" />Web ({urlCount})
              </button>
              <button onClick={() => setFilterType('file')} className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterType === 'file' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                <FileText className="w-3 h-3 inline mr-1" />Dateien ({fileCount})
              </button>
            </div>

            <div className="flex items-center gap-1">
              {/* Sort toggle */}
              <button onClick={() => setSortBy(prev => prev === 'date' ? 'title' : prev === 'title' ? 'readingTime' : 'date')}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-xs">
                {sortBy === 'date' ? 'Datum' : sortBy === 'title' ? 'Titel' : 'Dauer'}
              </button>
              <button onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                {sortDir === 'desc' ? <SortDesc className="w-3.5 h-3.5" /> : <SortAsc className="w-3.5 h-3.5" />}
              </button>

              {/* View mode */}
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Lade Bibliothek...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
              <Bookmark className="w-12 h-12 text-indigo-500 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {search ? 'Nichts gefunden' : 'Deine Bibliothek ist leer'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              {search ? `Keine Treffer für "${search}"` : 'Lade Artikel oder Dateien hoch, um sie offline zu lesen und anhören.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(article => (
              <div key={article.id}
                className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                {/* Top accent */}
                <div className={`h-1 ${article.source === 'file' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button onClick={() => onSelectArticle(article)} className="text-left flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {article.title}
                      </h3>
                    </button>
                    <button onClick={() => onDeleteArticle(article.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" title="Löschen">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    {article.source === 'file' ? (
                      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><FileText className="w-3 h-3" />{article.fileName?.split('.').pop()?.toUpperCase()}</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400"><Globe className="w-3 h-3" />Web</span>
                    )}
                    {article.readingTime && <span>{article.readingTime} min</span>}
                    {(() => { const hasProgress = hasSavedProgress(article.id); return hasProgress ? <span className="text-indigo-500 font-medium">Fortsetzen</span> : null; })()}
                  </div>
                  {(() => { const hasProgress = hasSavedProgress(article.id); return hasProgress ? (
                    <div className="mt-2 text-[11px] text-indigo-500 dark:text-indigo-400">Zuletzt gelesene Position gespeichert</div> ) : null; })()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(article => (
              <div key={article.id}
                className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                {/* Type indicator */}
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => onSelectArticle(article)} className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {article.source === 'file' ? (
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      )}
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {article.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {article.readingTime && <span>{article.readingTime} min</span>}
                      {article.author && <span>• {article.author}</span>}
                      <span>• {new Date(article.savedAt).toLocaleDateString('de-DE')}</span>
                      {article.fileName && <span>• {article.fileName}</span>}
                    </div>
                  </button>
                  <button onClick={() => onDeleteArticle(article.id)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" title="Löschen">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="text-center mt-6 text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} von {articles.length} Einträgen {search ? `— Suche: "${search}"` : ''}
          </div>
        )}
      </main>
    </div>
  );
}

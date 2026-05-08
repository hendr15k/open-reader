import { useState, useEffect } from 'react';
import { BookOpen, Trash2, Search, Play, ArrowLeft, Library } from 'lucide-react';
import { epubDB } from '../lib/epubDB';

interface EpubFile {
  id: string;
  title: string;
  author?: string;
  fileName?: string;
  fileSize?: number;
  createdAt?: number;
}

interface EpubLibraryProps {
  onOpenEpub: (fileId: string, title: string) => void;
  onBack: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function timeAgo(timestamp: number): string {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.round(diff / 60)}m`;
  if (diff < 86400) return `vor ${Math.round(diff / 3600)}h`;
  if (diff < 86400 * 7) return `vor ${Math.round(diff / 86400)}d`;
  return new Date(timestamp).toLocaleDateString('de-DE');
}

export default function EpubLibrary({ onOpenEpub, onBack }: EpubLibraryProps) {
  const [files, setFiles] = useState<EpubFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { loadFiles(); }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const all = await epubDB.getAllFiles();
      setFiles(all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (e) {
      console.error('Load epub files:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`${title} wirklich löschen?`)) return;
    setDeleting(id);
    try {
      await epubDB.deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      console.error('Delete epub:', e);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = search
    ? files.filter(f =>
        f.title.toLowerCase().includes(search.toLowerCase()) ||
        (f.author || '').toLowerCase().includes(search.toLowerCase())
      )
    : files;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Library className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">EPUB Bibliothek</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{files.length} {files.length === 1 ? 'Buch' : 'Bücher'}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bibliothek durchsuchen..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              {search ? 'Keine Treffer' : 'Noch keine EPUBs'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              {search
                ? `Keine Ergebnisse für "${search}"`
                : 'Lade EPUB-Dateien hoch, um deine Bibliothek aufzubauen.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((file) => (
              <div
                key={file.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden card-hover"
              >
                <div className="p-4 flex items-center gap-3">
                  {/* Cover/Icon */}
                  <div className="w-14 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                      {file.title}
                    </h3>
                    {file.author && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{file.author}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {file.fileSize && <span>{formatFileSize(file.fileSize)}</span>}
                      {file.createdAt && (
                        <>
                          <span>•</span>
                          <span>{timeAgo(file.createdAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onOpenEpub(file.id, file.title)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                      title="Lesen"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    {deleting !== file.id ? (
                      <button
                        onClick={() => handleDelete(file.id, file.title)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="w-9 h-9 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex">
          <button
            onClick={onBack}
            className="flex-1 py-3 flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-medium">Zurück</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

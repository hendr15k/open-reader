import { useState, useRef, useCallback } from 'react';
import { Upload, BookOpen, X, AlertCircle } from 'lucide-react';
import { epubDB } from '../lib/epubDB';

interface EpubUploadProps {
  onUploadComplete?: (fileId: string, title: string) => void;
  onCancel?: () => void;
}

export default function EpubUpload({ onUploadComplete, onCancel }: EpubUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.epub')) {
      setError('Nur .epub Dateien werden unterstützt');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(10);

    try {
      const buffer = await file.arrayBuffer();
      setProgress(30);

      // Extract metadata from EPUB (basic - title from filename)
      const title = file.name.replace('.epub', '').replace(/[-_]/g, ' ');
      setProgress(60);

      const fileId = await epubDB.saveFile(title, buffer, file.name);
      setProgress(100);

      if (onUploadComplete) {
        onUploadComplete(fileId, title);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Verarbeiten der EPUB-Datei');
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">EPUB hochladen</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Drag & drop oder Datei auswählen</p>
          </div>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      <div className="p-5">
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
            ${dragging
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <Upload className="w-6 h-6 text-emerald-600 animate-bounce" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Verarbeite EPUB...</p>
              <div className="w-48 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{progress}%</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Upload className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  EPUB-Datei hierher ziehen
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  oder <span className="text-emerald-600 dark:text-emerald-400 underline">Datei auswählen</span>
                </p>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">.epub Dateien • Lokale Speicherung</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
          <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            <strong>Tipp:</strong> EPUB-Dateien werden lokal im Browser gespeichert.
            Dein Lesefortschritt und Lesezeichen werden automatisch gespeichert.
          </p>
        </div>
      </div>
    </div>
  );
}

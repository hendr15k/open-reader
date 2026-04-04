import { X, ListChecks } from 'lucide-react';
import { Chapter } from '../hooks/useChapters';

interface ChapterSidebarProps {
  chapters: Chapter[];
  activeChapter: number;
  onSelect: (id: number) => void;
  onClose: () => void;
}

export default function ChapterSidebar({ chapters, activeChapter, onSelect, onClose }: ChapterSidebarProps) {
  return (
    <div className="fixed inset-0 z-40 bg-white dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Kapitel ({chapters.length})
          </h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {chapters.map((ch) => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 transition-colors ${
              ch.id === activeChapter
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <span className="text-xs font-mono text-gray-400 w-6">
              {ch.id + 1}
            </span>
            <span className="text-sm leading-snug">
              {ch.title}
            </span>
            {ch.id === activeChapter && (
              <span className="ml-auto w-2 h-2 rounded-full bg-indigo-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

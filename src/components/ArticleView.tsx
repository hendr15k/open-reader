import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Save, ChevronLeft, Minus, Plus } from 'lucide-react';
import { Article } from '../lib/types';
import { useTTS } from '../hooks/useTTS';

interface ArticleViewProps {
  article: Article;
  onClose: () => void;
  onSave: () => void;
  isSaved: boolean;
}

const FONT_SIZES = [
  { name: 'Small', class: 'text-sm' },
  { name: 'Medium', class: 'text-base' },
  { name: 'Large', class: 'text-lg' },
  { name: 'X-Large', class: 'text-xl' },
];

export default function ArticleView({ article, onClose, onSave, isSaved }: ArticleViewProps) {
  const { state, voices, speak, pause, resume, stop, setSpeed, setVoice } = useTTS();
  const [fontSizeIndex, setFontSizeIndex] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const [readingProgress, setReadingProgress] = useState(0);

  // Track reading progress
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const progress = scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * 100 : 100;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePlay = () => {
    if (state.isPlaying) {
      pause();
    } else if (state.isPaused) {
      resume();
    } else {
      speak(article.content);
    }
  };

  const handleStop = () => {
    stop();
    setReadingProgress(0);
  };

  const decreaseFontSize = () => {
    setFontSizeIndex(prev => Math.max(0, prev - 1));
  };

  const increaseFontSize = () => {
    setFontSizeIndex(prev => Math.min(FONT_SIZES.length - 1, prev + 1));
  };

  const currentFontClass = FONT_SIZES[fontSizeIndex].class;

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-950 z-50 flex flex-col">
      {/* Progress Bar */}
      <div
        className="h-1 bg-indigo-600 transition-all duration-150"
        style={{ width: `${readingProgress}%` }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {Math.round(readingProgress)}%
          </span>
        </div>

        <button
          onClick={onSave}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isSaved
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          <Save className="w-5 h-5" />
        </button>
      </div>

      {/* Article Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-5 py-8">
          {/* Article Meta */}
          <header className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              {article.author && (
                <span className="font-medium text-gray-700 dark:text-gray-300">{article.author}</span>
              )}
              {article.date && (
                <>
                  <span>•</span>
                  <span>{article.date}</span>
                </>
              )}
              {article.readingTime && (
                <>
                  <span>•</span>
                  <span>{article.readingTime} min read</span>
                </>
              )}
            </div>
          </header>

          {/* Content */}
          <div className={`prose dark:prose-invert max-w-none ${currentFontClass}`}>
            {article.content.split('\n').map((paragraph, idx) => {
              const trimmed = paragraph.trim();
              if (!trimmed) return <div key={idx} className="h-4" />;
              return (
                <p key={idx} className="text-gray-700 dark:text-gray-300 leading-relaxed mb-5">
                  {trimmed}
                </p>
              );
            })}
          </div>
        </article>
      </div>

      {/* TTS Controls */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4 py-4 px-4">
          <button
            onClick={decreaseFontSize}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Decrease font size"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            onClick={handleStop}
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Stop"
          >
            <Square className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlay}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 ${
              state.isPlaying
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 ml-1" />
            )}
          </button>

          <button
            onClick={increaseFontSize}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Increase font size"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center justify-center gap-4 pb-5 px-4">
          {/* Speed */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10">Speed</span>
            <select
              value={state.speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs border-0 focus:ring-2 focus:ring-indigo-500"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>

          {/* Voice */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10">Voice</span>
            <select
              value={state.selectedVoice || ''}
              onChange={(e) => setVoice(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs border-0 focus:ring-2 focus:ring-indigo-500 max-w-32 truncate"
            >
              <option value="">System Default</option>
              {voices.slice(0, 5).map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

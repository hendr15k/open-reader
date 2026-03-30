import { useState } from 'react';
import { Play, Pause, Square, Save, Sparkles, ChevronLeft } from 'lucide-react';
import { Article } from '../lib/types';
import { useTTS } from '../hooks/useTTS';

interface ArticleViewProps {
  article: Article;
  onClose: () => void;
  onSave: () => void;
  isSaved: boolean;
  onGenerateSummary: () => void;
}

export default function ArticleView({
  article,
  onClose,
  onSave,
  isSaved,
  onGenerateSummary,
}: ArticleViewProps) {
  const { state, voices, speak, pause, resume, stop, setSpeed, setVoice } = useTTS();
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  const handlePlay = () => {
    if (state.isPlaying) {
      pause();
    } else if (speechSynthesis.paused) {
      resume();
    } else {
      speak(article.content);
    }
  };

  const handleStop = () => {
    stop();
  };

  const fontSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 mx-4 truncate">
          {article.title}
        </h2>
        <button
          onClick={onSave}
          className={`p-2 rounded-full ${
            isSaved
              ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Save className="w-5 h-5" />
        </button>
      </div>

      {/* Article Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
            {article.readingTime && (
              <span>📖 {article.readingTime} min read</span>
            )}
            {article.date && <span>📅 {article.date}</span>}
          </div>

          <div
            className={`prose prose-lg dark:prose-invert max-w-none ${fontSizeClasses[fontSize]}`}
          >
            {article.content.split('\n').map((paragraph, idx) => (
              <p key={idx} className="mb-4 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Summary Section */}
          {article.summary && (
            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                  AI Summary
                </h3>
              </div>
              <div className="text-gray-800 dark:text-gray-200 whitespace-pre-line">
                {article.summary}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TTS Controls */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
        <div className="max-w-3xl mx-auto">
          {/* Primary Controls */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={handlePlay}
              className="p-4 bg-primary-600 text-white rounded-full hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {state.isPlaying ? (
                <Pause className="w-8 h-8" />
              ) : (
                <Play className="w-8 h-8 ml-1" />
              )}
            </button>
            <button
              onClick={handleStop}
              className="p-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <Square className="w-6 h-6" />
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Speed:</span>
              <select
                value={state.speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            {/* Voice Selection */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Voice:</span>
              <select
                value={state.selectedVoice || ''}
                onChange={(e) => setVoice(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Default</option>
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Font:</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as 'small' | 'medium' | 'large')}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            {/* Generate Summary */}
            {!article.summary && (
              <button
                onClick={onGenerateSummary}
                className="flex items-center gap-2 px-4 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Generate Summary
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
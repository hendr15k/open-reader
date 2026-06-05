import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Square, Save, ChevronLeft,
  SkipBack, SkipForward, Moon, Timer, Maximize2, Minimize2, Bookmark, BookOpen, Download
} from 'lucide-react';
import { Article } from '../lib/types';
import { useTTS } from '../hooks/useTTS';
import { useChapters } from '../hooks/useChapters';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import ChapterSidebar from './ChapterSidebar';

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

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function ArticleView({ article, onClose, onSave, isSaved }: ArticleViewProps) {
  const initialProgress = (() => {
    const saved = localStorage.getItem(`open-reader-progress-${article.id}`);
    if (saved) {
      const parsed = parseInt(saved, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  })();
  const { state, voices, speak, pause, resume, stop, setSpeed, setVoice, setCurrentSentence, setSleepTimer, skipForward, skipBack, jumpToSentence } = useTTS(initialProgress);
  const { chapters, activeChapter, setActiveChapter, showSidebar, setShowSidebar } = useChapters(article.content);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSizeIndex, setFontSizeIndex] = useState(() => {
    const saved = localStorage.getItem('open-reader-font-size');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [sleepMode, setSleepMode] = useState(() => localStorage.getItem('open-reader-sleep-mode') === 'true');
  const [immersiveMode, setImmersiveMode] = useState(() => localStorage.getItem('open-reader-immersive') === 'true');
  const [bookmarkedSentences, setBookmarked] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(`open-reader-bookmarks-${article.id}`);
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });
  const [readingProgress, setReadingProgress] = useState(0);
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  const { toasts, showToast } = useToast(1500);

  // Speed step through SPEED_OPTIONS
  const cycleSpeed = useCallback((direction: 1 | -1) => {
    const currentIdx = SPEED_OPTIONS.indexOf(state.speed);
    const nextIdx = Math.max(0, Math.min(SPEED_OPTIONS.length - 1, currentIdx + direction));
    if (nextIdx !== currentIdx) {
      setSpeed(SPEED_OPTIONS[nextIdx]);
      showToast(`Speed: ${SPEED_OPTIONS[nextIdx]}x`);
    }
  }, [state.speed, setSpeed, showToast]);

  const handleIncreaseSpeed = useCallback(() => cycleSpeed(1), [cycleSpeed]);
  const handleDecreaseSpeed = useCallback(() => cycleSpeed(-1), [cycleSpeed]);

  // Get content for current chapter
  const chapter = chapters[activeChapter];
  const chapterContent = chapter
    ? article.content.split('\n').slice(chapter.startLine, chapter.endLine).join('\n')
    : article.content;

  // Restore reading progress on mount
  useEffect(() => {
    const saved = localStorage.getItem(`open-reader-progress-${article.id}`);
    if (saved) {
      const savedIdx = parseInt(saved, 10);
      if (!isNaN(savedIdx) && savedIdx > 0) {
        setCurrentSentence(savedIdx);
      }
    }
  }, []);

  // Auto-speak the current chapter content when it changes, but only if the
  // user is actively playing. We intentionally do NOT auto-resume on chapter
  // change while paused/stopped — that was a confusing UX where pausing then
  // changing chapter silently restarted TTS.
  useEffect(() => {
    if (
      chapterContent &&
      chapterContent.trim().length > 0 &&
      state.isPlaying &&
      !state.isPaused
    ) {
      speak(chapterContent, state.currentSentence > 0 ? state.currentSentence : undefined);
    }
    // We intentionally exclude `speak` and `state.currentSentence` from deps:
    // we only want to re-speak when the chapter content itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter, chapterContent]);

  // Save reading progress on a fixed 5s cadence. We use a ref to read the
  // latest sentence index inside the interval callback — depending on
  // `state.currentSentence` would reset the interval on every change and
  // the throttle would never actually fire.
  const currentSentenceRef = useRef(state.currentSentence);
  currentSentenceRef.current = state.currentSentence;
  useEffect(() => {
    const saveProgress = () => {
      try {
        localStorage.setItem(
          `open-reader-progress-${article.id}`,
          String(currentSentenceRef.current)
        );
      } catch {
        // Storage may be unavailable (private mode, quota) — silently ignore
      }
    };
    const interval = setInterval(saveProgress, 5000);
    return () => clearInterval(interval);
  }, [article.id]);


  // Also save when pausing/stopping — guard against stale article ID
  useEffect(() => {
    if (!state.isPlaying && !state.isPaused) {
      localStorage.setItem(`open-reader-progress-${article.id}`, String(state.currentSentence));
    }
  }, [state.isPlaying, state.isPaused]);

  // Track reading progress (overall = text progress within chapter + chapter position)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const chapterProgress = scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * 100 : 100;
      const overallProgress = ((activeChapter + chapterProgress / 100) / chapters.length) * 100;
      setReadingProgress(Math.min(100, Math.max(0, overallProgress)));
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [chapter, activeChapter, chapters.length]);

  // Scroll to top when chapter changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeChapter]);

  const handlePlay = () => {
    if (state.isPlaying) pause();
    else if (state.isPaused) resume();
    // Resume from saved sentence index so restored progress is honored
    else speak(chapterContent, state.currentSentence > 0 ? state.currentSentence : undefined);
  };

  const handleStop = () => { stop(); };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTogglePlayPause: handlePlay,
    onNextSentence: skipForward,
    onPrevSentence: skipBack,
    onIncreaseSpeed: handleIncreaseSpeed,
    onDecreaseSpeed: handleDecreaseSpeed,
    onShowHelp: () => setShowShortcutsHint(prev => !prev),
  });

  const toggleBookmark = (idx: number) => {
    const nb = new Set(bookmarkedSentences);
    if (nb.has(idx)) nb.delete(idx); else nb.add(idx);
    setBookmarked(nb);
    localStorage.setItem(`open-reader-bookmarks-${article.id}`, JSON.stringify([...nb]));
  };

  const toggleSleepMode = () => {
    setSleepMode(prev => {
      localStorage.setItem('open-reader-sleep-mode', String(!prev));
      return !prev;
    });
  };
  const toggleImmersive = () => {
    setImmersiveMode(prev => {
      localStorage.setItem('open-reader-immersive', String(!prev));
      return !prev;
    });
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const textProgress = state.sentences.length > 0 ? Math.round((state.currentSentence / state.sentences.length) * 100) : 0;
  const progressPct = Math.max(textProgress, Math.round(readingProgress));
  useEffect(() => {
    localStorage.setItem('open-reader-font-size', String(fontSizeIndex));
  }, [fontSizeIndex]);

  const currentFontClass = FONT_SIZES[Math.max(0, Math.min(fontSizeIndex, FONT_SIZES.length - 1))].class;
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('open-reader-font-family') || 'system-ui, -apple-system, sans-serif';
  });

  useEffect(() => {
    const handleStorage = () => {
      setFontFamily(localStorage.getItem('open-reader-font-family') || 'system-ui, -apple-system, sans-serif');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${sleepMode ? 'bg-gray-950' : 'bg-white dark:bg-gray-950'} transition-colors duration-500`}>
      <div className="h-1 bg-indigo-600 transition-all duration-300" style={{ width: `${progressPct}%` }} />

      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 ${sleepMode ? 'bg-gray-900 border-gray-700' : 'bg-white dark:bg-gray-900'} transition-all duration-300 ${immersiveMode ? 'opacity-0 pointer-events-none h-0 overflow-hidden border-0' : ''}`}>
        <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="flex items-center gap-2">
          {state.sleepTimerRemaining !== null && (
            <div className="flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
              <Timer className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">{formatTime(state.sleepTimerRemaining)}</span>
            </div>
          )}
          {chapters.length > 1 && (
            <button
              onClick={() => setShowSidebar(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Kapitel navigieren"
            >
              <BookOpen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{progressPct}%</span>
          {bookmarkedSentences.size > 0 && <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{bookmarkedSentences.size} 🔖</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleImmersive} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            {immersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={toggleSleepMode} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${sleepMode ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
            <Moon className="w-4 h-4" />
          </button>
          <button onClick={onSave} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isSaved ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <article className={`max-w-2xl mx-auto px-5 py-8 ${sleepMode ? 'text-gray-400' : ''} ${immersiveMode ? 'pt-4' : ''}`}>
          {!sleepMode && !immersiveMode && (
            <header className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-4">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                {article.author && <span className="font-medium text-gray-700 dark:text-gray-300">{article.author}</span>}
                {article.date && <><span>•</span><span>{article.date}</span></>}
                {article.readingTime && <><span>•</span><span>{article.readingTime} min</span></>}
                {article.fileName && <><span>•</span><span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{article.fileName}</span></>}
              </div>
            </header>
          )}

          {/* Chapter indicator */}
          {chapters.length > 1 && !immersiveMode && (
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => activeChapter > 0 && setActiveChapter(activeChapter - 1)}
                disabled={activeChapter === 0}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Kapitel {activeChapter}
              </button>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                {chapter?.title}
              </span>
              <button
                onClick={() => activeChapter < chapters.length - 1 && setActiveChapter(activeChapter + 1)}
                disabled={activeChapter === chapters.length - 1}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Kapitel {activeChapter + 2} →
              </button>
            </div>
          )}

          <div className={`prose dark:prose-invert max-w-none ${currentFontClass}`} style={{ fontFamily }}>
            {state.sentences.length > 0 ? (
              state.sentences.map((sentence, idx) => {
                const isCurrent = idx === state.currentSentence;
                const isPast = idx < state.currentSentence;
                const isBookmarked = bookmarkedSentences.has(idx);
                return (
                  <div key={idx} className="flex gap-1 group items-start">
                    <button onClick={() => toggleBookmark(idx)} className={`flex-shrink-0 w-6 h-6 mt-1 rounded flex items-center justify-center transition-colors ${isBookmarked ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' : 'text-transparent group-hover:text-gray-400 dark:group-hover:text-gray-500'}`}>
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                    <p className={`flex-1 leading-relaxed mb-2 transition-all duration-200 cursor-pointer rounded px-1 py-0.5 ${
                      isCurrent ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100 font-medium -mx-1'
                        : isPast ? (sleepMode ? 'text-gray-700' : 'text-gray-500 dark:text-gray-500')
                        : (sleepMode ? 'text-gray-600' : 'text-gray-700 dark:text-gray-300')
                    }`}
                      onClick={() => {
                        jumpToSentence(idx);
                      }}>{sentence}</p>
                  </div>
                );
              })
            ) : (
              chapterContent.split('\n').map((paragraph, idx) => {
                const trimmed = paragraph.trim();
                if (!trimmed) return <div key={idx} className="h-4" />;
                return <p key={idx} className={`${sleepMode ? 'text-gray-500' : 'text-gray-700 dark:text-gray-300'} leading-relaxed mb-5`}>{trimmed}</p>;
              })
            )}
          </div>
        </article>
      </div>

      <div className={`border-t border-gray-200 dark:border-gray-800 ${sleepMode ? 'bg-gray-900 border-gray-700' : 'bg-white dark:bg-gray-900'} transition-opacity duration-300 ${immersiveMode ? 'opacity-40 hover:opacity-100' : ''}`}>
        <div className="flex items-center justify-center gap-3 py-4 px-4">
          <div className="relative">
            <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className={`w-12 h-12 rounded-2xl ${sleepMode ? 'bg-gray-800' : 'bg-gray-100/50 dark:bg-gray-800/50'} flex items-center justify-center ${sleepMode ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'} hover:bg-gray-200/50 dark:hover:bg-gray-700/50 text-sm font-bold`}>{state.speed}x</button>
            {showSpeedMenu && (
              <div className="absolute bottom-14 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 z-50">
                {SPEED_OPTIONS.map(s => (<button key={s} onClick={() => { setSpeed(s); setShowSpeedMenu(false); }} className={`w-full px-4 py-2 text-sm rounded-lg text-left ${state.speed === s ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{s}x</button>))}
              </div>
            )}
          </div>
          <button onClick={skipBack} className={`w-12 h-12 rounded-xl ${sleepMode ? 'bg-gray-800' : 'bg-gray-100/50 dark:bg-gray-800/50'} flex items-center justify-center ${sleepMode ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'} hover:bg-gray-200/50 dark:hover:bg-gray-700/50`}><SkipBack className="w-5 h-5" /></button>
          <button onClick={handleStop} className={`w-14 h-14 rounded-full ${sleepMode ? 'bg-gray-800' : 'bg-gray-100 dark:bg-gray-800'} flex items-center justify-center ${sleepMode ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'} hover:bg-gray-200 dark:hover:bg-gray-700 shadow-sm`}><Square className="w-5 h-5 fill-current" /></button>
          <button onClick={handlePlay} className="w-16 h-16 rounded-full flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 transition-all duration-300 active:scale-95">
            {state.isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 ml-1 fill-current" />}
          </button>
          <button onClick={skipForward} className={`w-12 h-12 rounded-xl ${sleepMode ? 'bg-gray-800' : 'bg-gray-100/50 dark:bg-gray-800/50'} flex items-center justify-center ${sleepMode ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'} hover:bg-gray-200/50 dark:hover:bg-gray-700/50`}><SkipForward className="w-5 h-5" /></button>
          <div className="flex items-center gap-1">
            <button onClick={() => setFontSizeIndex(p => Math.max(0, p - 1))} className={`w-10 h-10 rounded-xl ${sleepMode ? 'bg-gray-800' : 'bg-gray-100/50 dark:bg-gray-800/50'} flex items-center justify-center ${sleepMode ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'} hover:bg-gray-200/50 text-xs font-bold`}>A-</button>
            <button onClick={() => setFontSizeIndex(p => Math.min(FONT_SIZES.length - 1, p + 1))} className={`w-10 h-10 rounded-xl ${sleepMode ? 'bg-gray-800' : 'bg-gray-100/50 dark:bg-gray-800/50'} flex items-center justify-center ${sleepMode ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'} hover:bg-gray-200/50 text-xs font-bold`}>A+</button>
          </div>
        </div>
        <div className={`flex items-center justify-between px-6 pb-4 transition-all duration-300 ${immersiveMode ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''}`} aria-hidden={immersiveMode}>
          <div className="relative flex items-center gap-2">
            <button onClick={() => {
              const blob = new Blob([article.content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${article.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${sleepMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300'} text-xs font-medium border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors`} title="Als TXT herunterladen">
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button onClick={() => setShowSleepMenu(!showSleepMenu)} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${state.sleepTimerMinutes ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : sleepMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'} text-xs font-medium`}><Timer className="w-3.5 h-3.5" />{state.sleepTimerMinutes ? `${state.sleepTimerMinutes} Min` : 'Sleep Timer'}</button>
            {showSleepMenu && (
              <div className="absolute bottom-12 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 z-50 min-w-[140px]">
                {[{label: 'Aus', minutes: null}, {label: '5 Min', minutes: 5}, {label: '15 Min', minutes: 15}, {label: '30 Min', minutes: 30}, {label: '45 Min', minutes: 45}, {label: '60 Min', minutes: 60}].map(opt => (
                  <button key={opt.label} onClick={() => { setSleepTimer(opt.minutes); setShowSleepMenu(false); }} className={`w-full px-3 py-2 text-sm rounded-lg text-left ${state.sleepTimerMinutes === opt.minutes ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{opt.label}</button>
                ))}
              </div>
            )}
          </div>
          <select value={state.selectedVoice || ''} onChange={(e) => setVoice(e.target.value)} className={`px-3 py-2 rounded-xl ${sleepMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300'} text-xs font-medium border border-gray-200/50 dark:border-gray-700/50 max-w-32 truncate`}><option value="">Stimme</option>{voices.filter(v => v.lang.startsWith('de')).slice(0, 3).map(v => <option key={v.name} value={v.name}>{v.name.split(' ')[0]}</option>)}{voices.filter(v => !v.lang.startsWith('de')).slice(0, 3).map(v => <option key={v.name} value={v.name}>{v.name.split(' ')[0]}</option>)}</select>
        </div>
      </div>

      {/* Chapter Sidebar Overlay */}
      {showSidebar && (
        <ChapterSidebar
          chapters={chapters}
          activeChapter={activeChapter}
          onSelect={setActiveChapter}
          onClose={() => setShowSidebar(false)}
        />
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2">
          {toasts.map(t => (
            <div
              key={t.id}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-medium shadow-lg animate-fade-in"
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Keyboard Shortcuts Hint Overlay */}
      {showShortcutsHint && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
          onClick={() => setShowShortcutsHint(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-xs w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Play / Pause</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">Space</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Next sentence</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">→</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Previous sentence</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">←</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Increase speed</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">↑</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Decrease speed</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">↓</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Show this help</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">?</kbd>
              </div>
            </div>
            <button
              onClick={() => setShowShortcutsHint(false)}
              className="mt-5 w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

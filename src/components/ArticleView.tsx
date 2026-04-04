import { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Square, Save, ChevronLeft,
  SkipBack, SkipForward, Moon, Timer, Maximize2, Minimize2, Bookmark, BookOpen
} from 'lucide-react';
import { Article } from '../lib/types';
import { useTTS } from '../hooks/useTTS';
import { useChapters } from '../hooks/useChapters';
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

const SLEEP_OPTIONS = [
  { label: 'Aus', minutes: null },
  { label: '5 Min', minutes: 5 },
  { label: '15 Min', minutes: 15 },
  { label: '30 Min', minutes: 30 },
  { label: '45 Min', minutes: 45 },
  { label: '60 Min', minutes: 60 },
];

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function ArticleView({ article, onClose, onSave, isSaved }: ArticleViewProps) {
  const { state, voices, speak, pause, resume, stop, setSpeed, setVoice, setCurrentSentence, setSleepTimer, skipForward, skipBack } = useTTS();
  const { chapters, activeChapter, setActiveChapter, showSidebar, setShowSidebar } = useChapters(article.content);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fontSizeIndex, setFontSizeIndex] = useState(1);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [bookmarkedSentences, setBookmarked] = useState<Set<number>>(new Set());
  const [readingProgress, setReadingProgress] = useState(0);

  // Get content for current chapter
  const chapter = chapters[activeChapter];
  const chapterContent = chapter
    ? article.content.split('\n').slice(chapter.startLine, chapter.endLine).join('\n')
    : article.content;

  // Speak chapter content on mount or chapter change
  useEffect(() => {
    if (chapterContent && chapterContent.trim().length > 0) {
      speak(chapterContent);
    }
  }, [activeChapter]);

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
    else speak(chapterContent);
  };

  const handleStop = () => { stop(); };

  const toggleBookmark = (idx: number) => {
    const nb = new Set(bookmarkedSentences);
    if (nb.has(idx)) nb.delete(idx); else nb.add(idx);
    setBookmarked(nb);
  };

  const toggleSleepMode = () => setSleepMode(!sleepMode);
  const toggleImmersive = () => setImmersiveMode(!immersiveMode);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const textProgress = state.sentences.length > 0 ? Math.round((state.currentSentence / state.sentences.length) * 100) : 0;
  const progressPct = Math.max(textProgress, Math.round(readingProgress));
  const currentFontClass = FONT_SIZES[fontSizeIndex].class;

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

          <div className={`prose dark:prose-invert max-w-none ${currentFontClass}`}>
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
                        setCurrentSentence(idx);
                        speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(state.sentences.slice(idx).join(' '));
                        const voice = voices.find(v => v.name === state.selectedVoice);
                        if (voice) u.voice = voice;
                        u.rate = state.speed;
                        speechSynthesis.speak(u);
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
        <div className={`flex items-center justify-between px-6 pb-4 transition-all duration-300 ${immersiveMode ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''}`}>
          <div className="relative">
            <button onClick={() => setShowSleepMenu(!showSleepMenu)} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${state.sleepTimerMinutes ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : sleepMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'} text-xs font-medium`}><Timer className="w-3.5 h-3.5" />{state.sleepTimerMinutes ? `${state.sleepTimerMinutes} Min` : 'Sleep Timer'}</button>
            {showSleepMenu && (<div className="absolute bottom-12 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 z-50 min-w-[140px]">{SLEEP_OPTIONS.map(opt => (<button key={opt.label} onClick={() => { setSleepTimer(opt.minutes); setShowSleepMenu(false); }} className={`w-full px-3 py-2 text-sm rounded-lg text-left ${state.sleepTimerMinutes === opt.minutes ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{opt.label}</button>))}</div>)}
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
    </div>
  );
}

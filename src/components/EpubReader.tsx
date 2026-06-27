import { useState, useEffect, useRef, useCallback } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import {
  ChevronLeft, Bookmark, Maximize2, Minimize2, Save,
  Play, Pause, Square, SkipBack, SkipForward, Moon, Timer,
  Loader2, BookOpen
} from 'lucide-react';
import { epubDB } from '../lib/epubDB';
import { useTTS } from '../hooks/useTTS';
import type { TTSEngineId } from '../lib/types';

function getStoredEngineId(): TTSEngineId {
  const stored = localStorage.getItem('open-reader-tts-engine') as TTSEngineId | null;
  return stored || 'web-speech';
}

interface EpubReaderProps {
  fileId: string;
  onClose: () => void;
  title: string;
  author?: string;
  coverUrl?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SLEEP_OPTIONS = [
  { label: 'Aus', minutes: null },
  { label: '5 Min', minutes: 5 },
  { label: '15 Min', minutes: 15 },
  { label: '30 Min', minutes: 30 },
  { label: '45 Min', minutes: 45 },
  { label: '60 Min', minutes: 60 },
];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function EpubReader({ fileId, onClose, title, author }: EpubReaderProps) {
  const [epubContent, setEpubContent] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const renditionRef = useRef<any>(null);
  const blobUrlRef = useRef<string>('');
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestLocationRef = useRef<string>('');
  latestLocationRef.current = location;
  // Holds the *raw* EpubLocation object that ReactReader needs as its
  // `location` prop (it's not a string — it's an object with cfi/ranges).
  // We persist a stable string version to IndexedDB but pass this through.
  const rawLocationRef = useRef<any>(null);

  const handleRelocated = useCallback((loc: any) => {
    // epub.js passes a `EpubLocation`-like object on `relocated`. We persist
    // a stable string for IndexedDB (using `start.href` so it's comparable
    // across sessions) but also remember the raw object in the ref so React
    // can pass it back into <ReactReader location={...} />.
    const locStr = String(loc?.start?.href || loc?.start || '');
    setLocation(locStr);
    rawLocationRef.current = loc;
  }, []);

  // Load saved progress on mount. The string we stored is `start.href`; React
  // then keeps it in `location` and passes it back into <ReactReader>.
  useEffect(() => {
    let cancelled = false;
    epubDB.getProgress(fileId).then(progress => {
      if (!cancelled && progress) setLocation(progress);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [fileId]);

  // Debounced progress save — `locationChanged` fires on every page turn, and
  // the previous code wrote to IndexedDB on every single event, which is
  // needlessly expensive.
  useEffect(() => {
    if (!location) return;
    const handle = setTimeout(() => {
      epubDB.saveProgress(fileId, location).catch(console.error);
    }, 1000);
    return () => clearTimeout(handle);
  }, [location, fileId]);

  const {
    state: ttsState,
    voices,
    speak,
    stop: ttsStop,
    pause: ttsPause,
    resume: ttsResume,
    setSpeed,
    setVoice: ttsSetVoice,
    skipForward: ttsSkipForward,
    skipBack: ttsSkipBack,
  } = useTTS(0, getStoredEngineId());

  // Load bookmarks
  useEffect(() => {
    epubDB.getBookmarks(fileId).then(bms => {
      if (bms) setBookmarks(new Set(bms.map(b => b.location)));
    }).catch(console.error);
  }, [fileId]);

  useEffect(() => {
    let cancelled = false;
    epubDB.getFile(fileId).then(epub => {
      if (cancelled) return;
      if (epub?.content) {
        const blob = new Blob([epub.content], { type: 'application/epub+zip' });
        const url = URL.createObjectURL(blob);
        if (cancelled) { URL.revokeObjectURL(url); return; }
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setEpubContent(url);
      }
    }).catch(console.error);
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = '';
      }
    };
  }, [fileId]);

  // Sleep timer
  useEffect(() => {
    if (sleepTimerRef.current) { clearInterval(sleepTimerRef.current); sleepTimerRef.current = null; }
    if (sleepMinutes !== null && sleepMinutes > 0) {
      setSleepRemaining(sleepMinutes * 60);
      setSleepMode(true);
      sleepTimerRef.current = setInterval(() => {
        setSleepRemaining(prev => {
          if (prev === null) return null;
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); };
  }, [sleepMinutes]);

  useEffect(() => {
    if (sleepRemaining === 0) {
      if (sleepTimerRef.current) { clearInterval(sleepTimerRef.current); sleepTimerRef.current = null; }
      ttsStop();
      setSleepMode(false);
      setSleepMinutes(null);
      setSleepRemaining(null);
    }
  }, [sleepRemaining, ttsStop]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      ttsStop();
      if (latestLocationRef.current) {
        epubDB.saveProgress(fileId, latestLocationRef.current).catch(console.error);
      }
    };
  }, []);

  const toggleBookmark = () => {
    const loc = String(location);
    const newBookmarks = new Set(bookmarks);
    if (newBookmarks.has(loc)) {
      newBookmarks.delete(loc);
      epubDB.deleteBookmark(fileId, loc).catch(console.error);
    } else if (loc) {
      newBookmarks.add(loc);
      epubDB.saveBookmark(fileId, loc).catch(console.error);
    }
    setBookmarks(newBookmarks);
  };

  const handleSave = () => { /* save handled via IndexedDB */ };

  const getRendition = (rendition: any) => {
    // Guard against re-entry: if ReactReader hands us the SAME rendition
    // instance again, do nothing — otherwise we end up with duplicate
    // listeners and double state updates.
    if (renditionRef.current === rendition) return;
    if (renditionRef.current) {
      renditionRef.current.off('relocated', handleRelocated);
    }
    renditionRef.current = rendition;
    rendition.on('relocated', handleRelocated);
  };

  const handlePlayPause = () => {
    if (ttsState.isPlaying) {
      ttsPause();
    } else if (ttsState.isPaused) {
      ttsResume();
    } else if (ttsState.sentences.length > 0) {
      const remaining = ttsState.sentences.slice(ttsState.currentSentence).join(' ');
      if (remaining) speak(remaining);
    } else {
      const rendition = renditionRef.current;
      if (rendition) {
        try {
          const contents = rendition.getContents();
          if (contents && contents.length > 0) {
            const text = contents.map((c: any) => c.window.document.body.innerText).filter(Boolean).join('\n');
            if (text.trim()) speak(text);
          }
        } catch (e) {
          console.error('Failed to extract EPUB text:', e);
        }
      }
    }
  };

  const handleStop = () => { ttsStop(); };
  const handleSkipBack = () => { ttsSkipBack(); };
  const handleSkipForward = () => { ttsSkipForward(); };

  const progress = ttsState.sentences.length > 0
    ? Math.round((ttsState.currentSentence / ttsState.sentences.length) * 100)
    : 0;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${sleepMode ? 'bg-gray-950' : 'bg-white dark:bg-gray-950'} transition-colors duration-500`}>
      {/* Progress bar */}
      {ttsState.sentences.length > 0 && (
        <div className="h-1 bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 ${sleepMode ? 'bg-gray-900 border-gray-700' : 'bg-white dark:bg-gray-900'} transition-all duration-300 ${immersiveMode ? 'opacity-0 pointer-events-none h-0 overflow-hidden border-0' : ''}`}>
        <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
        <div className="flex-1 mx-4 overflow-hidden">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
          {author && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{author}</p>}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">{bookmarks.size} 🔖</span>
          <button onClick={toggleBookmark} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${bookmarks.has(String(location)) ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
            <Bookmark className="w-4 h-4" />
          </button>
          <button onClick={() => setImmersiveMode(!immersiveMode)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            {immersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={handleSave} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* EPUB Reader */}
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 relative">
        {epubContent ? (
          <ReactReader
            url={epubContent}
            location={location ?? null}
            locationChanged={(loc: string) => setLocation(loc)}
            getRendition={getRendition}
            readerStyles={ReactReaderStyle}
            loadingView={
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <BookOpen className="w-12 h-12 text-indigo-400 animate-pulse" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">Lade EPUB...</p>
              </div>
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Lade EPUB...</p>
          </div>
        )}
      </div>

      {/* TTS Bottom Bar */}
      <div className={`border-t border-gray-200 dark:border-gray-800 ${sleepMode ? 'bg-gray-900 border-gray-700' : 'bg-white dark:bg-gray-900'} transition-opacity duration-300 ${immersiveMode ? 'opacity-20 hover:opacity-100' : ''}`}>

        {/* Sentence progress */}
        {ttsState.sentences.length > 0 && (
          <div className="px-4 pt-2 pb-0">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Satz {ttsState.currentSentence + 1} / {ttsState.sentences.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Main controls */}
        <div className="flex items-center justify-center gap-2 py-3 px-4">
          {/* Sleep */}
          <div className="relative">
            <button onClick={() => setShowSleepMenu(!showSleepMenu)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
              {sleepMode && sleepRemaining !== null ? (
                <Timer className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            {showSleepMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[120px] z-50">
                {SLEEP_OPTIONS.map(opt => (
                  <button key={String(opt.minutes)} onClick={() => { setSleepMinutes(opt.minutes); setShowSleepMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSkipBack} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <SkipBack className="w-4 h-4" />
          </button>

          <button onClick={handlePlayPause} className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white shadow-lg">
            {ttsState.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button onClick={handleStop} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <Square className="w-4 h-4" />
          </button>

          <button onClick={handleSkipForward} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <SkipForward className="w-4 h-4" />
          </button>

          <button className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-mono">
            {ttsState.speed}×
          </button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center justify-center gap-1 pb-2 px-4">
          {SPEED_OPTIONS.map(s => (
            <button key={s} onClick={() => setSpeed(s)} className={`px-2 py-1 rounded-lg text-xs transition-colors ${ttsState.speed === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900'}`}>
              {s}×
            </button>
          ))}
        </div>

        {/* Voice selector */}
        <div className="flex items-center justify-center pb-2 px-4">
          <select
            value={ttsState.selectedVoice || ''}
            onChange={(e) => ttsSetVoice(e.target.value)}
            className={`px-3 py-1.5 rounded-lg text-xs max-w-36 truncate ${sleepMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'} border border-gray-200/50 dark:border-gray-700/50`}
          >
            <option value="">Stimme</option>
            {voices.filter(v => v.language.startsWith('de')).slice(0, 3).map(v => <option key={v.id} value={v.id}>{v.name.split(' ')[0]}</option>)}
            {voices.filter(v => !v.language.startsWith('de')).slice(0, 3).map(v => <option key={v.id} value={v.id}>{v.name.split(' ')[0]}</option>)}
          </select>
        </div>

        {/* Sleep remaining */}
        {sleepMode && sleepRemaining !== null && (
          <div className="text-center text-xs text-amber-500 pb-1">
            Schlafmodus: {formatTime(sleepRemaining)}
          </div>
        )}
      </div>
    </div>
  );
}

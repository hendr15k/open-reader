import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Moon, Sun, Type, Volume2, BookOpen, Clock,
  Play, Eye, Smartphone, Globe, Info, Cpu, Download, Trash2
} from 'lucide-react';
import { listEngines, getEngine, onEngineStatus } from '../lib/tts';
import type { TTSEngine, EngineStatus, EngineVoice } from '../lib/tts/types';
import type { TTSEngineId } from '../lib/types';
import { getAudioCacheSize, clearAudioCache } from '../lib/tts/audioCache';

interface SettingsProps {
  onBack: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const FONT_FAMILIES = [
  { name: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { name: 'Serif', value: 'Georgia, Times New Roman, serif' },
  { name: 'Sans', value: 'Inter, Helvetica, Arial, sans-serif' },
  { name: 'Mono', value: 'JetBrains Mono, Consolas, monospace' },
];

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function SettingsPage({ onBack, darkMode, onToggleDarkMode }: SettingsProps) {
  const [defaultSpeed, setDefaultSpeed] = useState(() => {
    const saved = localStorage.getItem('open-reader-default-speed');
    return saved ? parseFloat(saved) : 1;
  });
  const [defaultVoice, setDefaultVoice] = useState(() => {
    return localStorage.getItem('open-reader-tts-voice') || '';
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('open-reader-font-family') || FONT_FAMILIES[0].value;
  });
  const [autoPlay, setAutoPlay] = useState(() => {
    return localStorage.getItem('open-reader-autoplay') === 'true';
  });
  const [keepScreenOn, setKeepScreenOn] = useState(() => {
    return localStorage.getItem('open-reader-keep-screen') === 'true';
  });
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // — Engine-Auswahl —
  const allEngines = listEngines();
  const [selectedEngineId, setSelectedEngineId] = useState<TTSEngineId>(() => {
    const stored = localStorage.getItem('open-reader-tts-engine') as TTSEngineId | null;
    return stored || 'web-speech';
  });
  const selectedEngine: TTSEngine = getEngine(selectedEngineId);

  const [engineStatus, setEngineStatus] = useState<EngineStatus>(() => ({
    state: selectedEngine.isReady() ? 'ready' : 'idle',
  }));
  const [engineVoices, setEngineVoices] = useState<EngineVoice[]>(() => selectedEngine.listVoices());
  const [previewVoice, setPreviewVoice] = useState<string | null>(null);
  const previewHandleRef = useRef<{ stop: () => void } | null>(null);
  const [audioCacheInfo, setAudioCacheInfo] = useState<{ count: number; bytes: number }>({ count: 0, bytes: 0 });

  useEffect(() => {
    const unsub = onEngineStatus((id, status) => {
      if (id === selectedEngineId) {
        setEngineStatus(status);
        if (status.state === 'ready') {
          setEngineVoices(selectedEngine.listVoices());
        }
      }
    });
    return () => unsub();
  }, [selectedEngineId, selectedEngine]);

  // Voice-Liste bei Engine-Wechsel neu laden
  useEffect(() => {
    setEngineVoices(selectedEngine.listVoices());
    if (selectedEngineId === 'web-speech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const handler = () => setEngineVoices(selectedEngine.listVoices());
      handler();
      window.speechSynthesis.addEventListener('voiceschanged', handler);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
    }
    return undefined;
  }, [selectedEngineId, selectedEngine]);

  // Audio-Cache-Info laden
  const refreshCacheInfo = useCallback(async () => {
    const info = await getAudioCacheSize();
    setAudioCacheInfo(info);
  }, []);
  useEffect(() => { void refreshCacheInfo(); }, [refreshCacheInfo, selectedEngineId]);

  const handleSpeedChange = (speed: number) => {
    setDefaultSpeed(speed);
    localStorage.setItem('open-reader-default-speed', String(speed));
  };

  const handleVoiceChange = (voiceId: string) => {
    setDefaultVoice(voiceId);
    localStorage.setItem('open-reader-tts-voice', voiceId);
  };

  const handleEngineChange = (id: TTSEngineId) => {
    setSelectedEngineId(id);
    localStorage.setItem('open-reader-tts-engine', id);
    const e = getEngine(id);
    setEngineStatus({ state: e.isReady() ? 'ready' : 'idle' });
    setEngineVoices(e.listVoices());
  };

  const handleActivateEngine = async () => {
    try {
      await selectedEngine.init((s) => setEngineStatus(s));
    } catch (err) {
      // status ist bereits im error-State
      console.error('Engine init failed', err);
    }
  };

  const handleFontChange = (font: string) => {
    setFontFamily(font);
    localStorage.setItem('open-reader-font-family', font);
  };

  const handleAutoPlayToggle = () => {
    const newVal = !autoPlay;
    setAutoPlay(newVal);
    localStorage.setItem('open-reader-autoplay', String(newVal));
  };

  const handleKeepScreenToggle = async () => {
    const newVal = !keepScreenOn;
    setKeepScreenOn(newVal);
    localStorage.setItem('open-reader-keep-screen', String(newVal));
    try {
      if (newVal && 'wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as Navigator & {
          wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        }).wakeLock.request('screen');
      } else if (!newVal && wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch { /* WakeLock not supported */ }
  };

  const previewVoiceFn = (voiceId: string) => {
    if (previewVoice === voiceId) {
      previewHandleRef.current?.stop();
      previewHandleRef.current = null;
      setPreviewVoice(null);
      return;
    }
    if (previewHandleRef.current) {
      previewHandleRef.current.stop();
      previewHandleRef.current = null;
    }
    setPreviewVoice(voiceId);
    selectedEngine.speak({ text: 'Hallo, das ist eine Sprachvorschau.', voiceId, speed: 1 })
      .then(h => {
        previewHandleRef.current = h;
        h.finished.then(() => {
          setPreviewVoice(prev => (prev === voiceId ? null : prev));
          previewHandleRef.current = null;
        });
      })
      .catch(() => setPreviewVoice(null));
  };

  const handleClearAudioCache = async () => {
    await clearAudioCache();
    void refreshCacheInfo();
  };

  const germanVoices = engineVoices.filter(v => v.language?.toLowerCase().startsWith('de'));
  const otherVoices = engineVoices.filter(v => !v.language?.toLowerCase().startsWith('de'));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={onBack}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">Settings</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Eye className="w-4 h-4" /> Appearance
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="w-5 h-5 text-indigo-600" /> : <Sun className="w-5 h-5 text-amber-500" />}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Follows system by default</p>
                </div>
              </div>
              <button
                onClick={onToggleDarkMode}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  darkMode ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <Type className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Schriftart</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Default font for reading</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FONT_FAMILIES.map(font => (
                  <button
                    key={font.value}
                    onClick={() => handleFontChange(font.value)}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      fontFamily === font.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Text-to-Speech
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {/* — Engine-Auswahl — */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">TTS-Engine</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Lokale KI oder System-Stimmen</p>
                </div>
              </div>
              <div className="space-y-2">
                {allEngines.map(engine => {
                  const isActive = selectedEngineId === engine.info.id;
                  return (
                    <button
                      key={engine.info.id}
                      onClick={() => handleEngineChange(engine.info.id)}
                      className={`w-full px-4 py-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium text-sm ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                          {engine.info.name}
                        </span>
                        {engine.info.requiresDownload && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            <Download className="w-3 h-3" /> ~{engine.info.modelSizeMB} MB
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {engine.info.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Engine-Status / Aktivierungs-Button */}
              {(() => {
                if (engineStatus.state === 'ready') {
                  return (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Bereit{engineStatus.device ? ` · ${engineStatus.device}` : ''}
                    </div>
                  );
                }
                if (engineStatus.state === 'downloading') {
                  const pct = Math.round((engineStatus.progress || 0) * 100);
                  return (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 mb-1">
                        <span>Modell wird geladen{engineStatus.device ? ` (${engineStatus.device})` : ''}…</span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-200"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                }
                if (engineStatus.state === 'error') {
                  return (
                    <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                        Fehler: {engineStatus.error || 'Unbekannt'}
                      </p>
                      <button
                        onClick={handleActivateEngine}
                        className="text-xs px-3 py-1.5 rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 font-medium"
                      >
                        Erneut versuchen
                      </button>
                    </div>
                  );
                }
                if ((selectedEngineId === 'kokoro-local' || selectedEngineId === 'piper-local') && engineStatus.state === 'idle') {
                  const label = selectedEngineId === 'piper-local'
                    ? 'Piper herunterladen & aktivieren'
                    : 'Kokoro herunterladen & aktivieren';
                  return (
                    <button
                      onClick={handleActivateEngine}
                      className="mt-3 w-full px-3 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {label}
                    </button>
                  );
                }
                return null;
              })()}

              {/* Audio-Cache-Info (nur für Audio-Engines relevant) */}
              {(selectedEngineId === 'kokoro-local' || selectedEngineId === 'piper-local') && engineStatus.state === 'ready' && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    Audio-Cache: {audioCacheInfo.count} Sätze · {(audioCacheInfo.bytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    onClick={handleClearAudioCache}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                    title="Synthetisierte Sätze aus dem lokalen Cache löschen"
                  >
                    <Trash2 className="w-3 h-3" /> Leeren
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Default Speed</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Playback speed for new articles</p>
                </div>
              </div>
              <div className="flex gap-2">
                {SPEED_OPTIONS.map(speed => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      defaultSpeed === speed
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <Globe className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Default Voice</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Preferred TTS voice</p>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {germanVoices.length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Deutsch</p>
                    {germanVoices.map(voice => (
                      <div key={voice.id} className="flex items-center gap-2">
                        <button
                          onClick={() => handleVoiceChange(voice.id)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                            defaultVoice === voice.id
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {voice.name.split(' ')[0]} <span className="text-gray-400 text-xs">({voice.language})</span>
                        </button>
                        <button
                          onClick={() => previewVoiceFn(voice.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            previewVoice === voice.id
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {previewVoice === voice.id ? 'Stop' : 'Play'}
                        </button>
                      </div>
                    ))}
                  </>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-3">Other</p>
                {otherVoices.slice(0, 5).map(voice => (
                  <div key={voice.id} className="flex items-center gap-2">
                    <button
                      onClick={() => handleVoiceChange(voice.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                        defaultVoice === voice.id
                          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {voice.name.split(' ')[0]} <span className="text-gray-400 text-xs">({voice.language})</span>
                    </button>
                    <button
                      onClick={() => previewVoiceFn(voice.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        previewVoice === voice.id
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {previewVoice === voice.id ? 'Stop' : 'Play'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Reading Preferences
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Auto-play on open</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Start TTS when opening article</p>
                </div>
              </div>
              <button
                onClick={handleAutoPlayToggle}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  autoPlay ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    autoPlay ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Keep screen on</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Prevent screen sleep while reading</p>
                </div>
              </div>
              <button
                onClick={handleKeepScreenToggle}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  keepScreenOn ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    keepScreenOn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Info className="w-4 h-4" /> About
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">Open Reader</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Version 3.0.0</p>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              A beautiful, distraction-free article reader with text-to-speech built right in.
              Paste any URL to start reading.
            </p>
            <div className="pt-2">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Powered by Jina Reader
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

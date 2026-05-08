import { useState, useEffect } from 'react';
import {
  Moon, Sun, Type, Volume2, BookOpen, Clock,
  Play, Eye, Smartphone, Globe, Info
} from 'lucide-react';

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewVoice, setPreviewVoice] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  const handleSpeedChange = (speed: number) => {
    setDefaultSpeed(speed);
    localStorage.setItem('open-reader-default-speed', String(speed));
  };

  const handleVoiceChange = (voiceName: string) => {
    setDefaultVoice(voiceName);
    localStorage.setItem('open-reader-tts-voice', voiceName);
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

  const handleKeepScreenToggle = () => {
    const newVal = !keepScreenOn;
    setKeepScreenOn(newVal);
    localStorage.setItem('open-reader-keep-screen', String(newVal));
  };

  const previewVoiceFn = (voiceName: string) => {
    if (previewVoice) {
      speechSynthesis.cancel();
      setPreviewVoice(null);
      return;
    }
    const voice = voices.find(v => v.name === voiceName);
    if (!voice) return;
    const utterance = new SpeechSynthesisUtterance('Hallo, das ist eine Sprachvorschau.');
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.onend = () => setPreviewVoice(null);
    speechSynthesis.speak(utterance);
    setPreviewVoice(voiceName);
  };

  const germanVoices = voices.filter(v => v.lang.startsWith('de'));
  const otherVoices = voices.filter(v => !v.lang.startsWith('de'));

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
                      <div key={voice.name} className="flex items-center gap-2">
                        <button
                          onClick={() => handleVoiceChange(voice.name)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                            defaultVoice === voice.name
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {voice.name.split(' ')[0]} <span className="text-gray-400 text-xs">({voice.lang})</span>
                        </button>
                        <button
                          onClick={() => previewVoiceFn(voice.name)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            previewVoice === voice.name
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {previewVoice === voice.name ? 'Stop' : 'Play'}
                        </button>
                      </div>
                    ))}
                  </>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-3">Other</p>
                {otherVoices.slice(0, 5).map(voice => (
                  <div key={voice.name} className="flex items-center gap-2">
                    <button
                      onClick={() => handleVoiceChange(voice.name)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                        defaultVoice === voice.name
                          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {voice.name.split(' ')[0]} <span className="text-gray-400 text-xs">({voice.lang})</span>
                    </button>
                    <button
                      onClick={() => previewVoiceFn(voice.name)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        previewVoice === voice.name
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {previewVoice === voice.name ? 'Stop' : 'Play'}
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

export interface Article {
  id: string;
  url?: string;
  title: string;
  content: string;
  author?: string;
  date?: string;
  readingTime?: number;
  savedAt: number;
  source?: 'url' | 'file';
  fileName?: string;
  totalWords?: number;
  favorite?: boolean;
}

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentSentence: number;
  speed: number;
  selectedVoice: string | null;
  sentences: string[];
  sleepTimerMinutes: number | null;
  sleepTimerRemaining: number | null;
}

export type TTSEngineId = 'web-speech' | 'kokoro-local';

export type Tab = 'home' | 'saved' | 'upload' | 'settings';

export interface Bookmark {
  id: string;
  articleId: string;
  sentenceIndex: number;
  text: string;
  createdAt: number;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  title: string;
  content: string;
  uploadedAt: number;
  totalWords: number;
  readingTime: number;
}

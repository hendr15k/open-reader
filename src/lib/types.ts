export interface Article {
  id: string;
  url: string;
  title: string;
  content: string;
  summary?: string;
  author?: string;
  date?: string;
  readingTime?: number;
  savedAt: number;
}

export interface TTSState {
  isPlaying: boolean;
  currentSentence: number;
  speed: number;
  selectedVoice: string | null;
}

export type Tab = 'home' | 'saved' | 'settings';
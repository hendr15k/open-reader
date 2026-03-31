# Open Reader - Distraction-Free Article Reader App

## Overview
A distraction-free reading/listening mobile app that fetches web articles and reads them aloud using text-to-speech.

## Tech Stack
- **Framework**: Capacitor (web app → native mobile)
- **Frontend**: React + TypeScript + Vite
- **UI Framework**: TailwindCSS + shadcn/ui components
- **TTS**: Web Speech API (native browser TTS)
- **Article Parsing**: Jina AI Reader API (https://r.jina.ai/http://...)
- **Offline Storage**: IndexedDB
- **Mobile Build**: Capacitor Android
- **Deployment**: GitHub Pages (web preview) + APK (Android)

## Key Features

### 1. URL Input & Article Fetching
- Clean URL input field with paste button
- Fetch article content using Jina AI Reader API
- Show loading state during fetch
- Error handling for invalid URLs or failed fetches
- Article metadata extraction (title, author, date, reading time)

### 2. Clean Reading View
- Mobile-first, distraction-free reading interface
- Font size controls (small, medium, large)
- Progress indicator (scroll position)
- Article navigation (table of contents if available)
- Dark/light mode toggle

### 3. TTS Playback
- Play/pause/stop controls
- Voice selection (available system voices)
- Speed control (0.5x - 2x)
- Highlight current sentence being read
- Background playback support (Android)
- Playback position persistence

### 4. Save Articles Offline
- Save articles to local storage
- Organize saved articles (recent, favorites, folders)
- Delete articles
- Offline reading capability
- Export articles (text, markdown)

### 5. UI/UX
- Modern, mobile-first design
- Smooth animations and transitions
- Bottom navigation bar
- Home / Saved / Settings tabs
- Responsive layout (works on web and mobile)
- Material Design-inspired aesthetics

## API Usage

### Article Fetching (Jina AI)
```
GET https://r.jina.ai/http://example.com/article
```

## Project Structure
```
open-reader/
├── src/
│   ├── components/
│   │   ├── ArticleView.tsx
│   │   ├── TTSPlayer.tsx
│   │   ├── URLInput.tsx
│   │   └── SavedArticles.tsx
│   ├── hooks/
│   │   ├── useTTS.ts
│   │   └── useArticleStorage.ts
│   ├── lib/
│   │   ├── jina.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   ├── App.tsx
│   └── main.tsx
├── capacitor.config.ts
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Requirements
- Real TTS functionality using Web Speech API
- Real article fetching and parsing
- Working offline article storage
- Mobile-responsive design that works on Android
- Dark mode support
- APK build via Capacitor

## Deployment
1. **GitHub Pages**: Web preview at `https://hendr15k.github.io/open-reader/`
2. **Android APK**: Build via `npm run build:android`
3. **Source Code**: Public repo at `https://github.com/hendr15k/open-reader`

## Success Criteria
- ✅ App successfully fetches and displays articles
- ✅ TTS plays article content with voice/speed controls
- ✅ Articles can be saved and read offline
- ✅ Dark/light mode works
- ✅ APK builds and installs on Android
- ✅ GitHub Pages preview works
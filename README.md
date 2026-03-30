# Open Reader

Distraction-free article reader app with text-to-speech and offline storage. An ElevenReader-style alternative built with Capacitor, React, and TypeScript.

Repo and folder name remain `jules-reader` for now.

## Features

- 📖 **Article Fetching**: Fetch articles from any URL using Jina Reader
- 🎧 **Text-to-Speech**: Full TTS playback with voice selection and speed control
- 💾 **Offline Storage**: Save articles for offline reading using IndexedDB
- 🌙 **Dark Mode**: Clean dark mode support
- 📱 **Mobile-First**: Responsive design optimized for phones
- 🚀 **Cross-Platform**: Web preview via GitHub Pages, Android build via Capacitor

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **TTS**: Web Speech API
- **Article Parsing**: Jina Reader
- **Storage**: IndexedDB via idb
- **Mobile**: Capacitor

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/hendr15k/jules-reader.git
cd jules-reader
npm install
```

### Development

```bash
npm run dev
```

### Build for Web

```bash
npm run build
npm run preview
```

### Build for Android

```bash
npm run android:build
```

## Usage

1. Enter a URL and fetch the article
2. Read in the clean reading view
3. Listen with the built-in TTS controls
4. Save articles for offline access

## Project Structure

```text
jules-reader/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── jina.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── capacitor.config.ts
└── package.json
```

## Deployment

### GitHub Pages

The app is deployed via GitHub Actions to GitHub Pages.

### Android APK

```bash
npm run build
npx cap sync android
npx cap open android
```

Build the APK in Android Studio.

## License

MIT

## Acknowledgments

- Jina for article parsing
- Capacitor for the hybrid app framework

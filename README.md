# Jules Reader

AI-powered article reader app with text-to-speech and AI summarization. An alternative to ElevenReader built with Capacitor, React, and TypeScript.

## Features

- 📖 **Article Fetching**: Fetch articles from any URL using Jina AI Reader API
- 🎧 **Text-to-Speech**: Full TTS playback with voice selection and speed control (0.5x - 2x)
- 💾 **Offline Storage**: Save articles for offline reading using IndexedDB
- ✨ **AI Summarization**: Generate bullet-point summaries using Google Jules API
- 🌙 **Dark Mode**: Beautiful dark mode support
- 📱 **Mobile-First**: Responsive design optimized for mobile devices
- 🚀 **Cross-Platform**: Web preview via GitHub Pages, Android APK via Capacitor

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **TTS**: Web Speech API
- **Article Parsing**: Jina AI Reader API
- **AI Summarization**: Google Jules API
- **Storage**: IndexedDB via idb
- **Mobile**: Capacitor

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/hendr15k/jules-reader.git
cd jules-reader

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

### Build for Web

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Build for Android

```bash
# Sync and open Android Studio
npm run android:build
```

## Usage

1. **Fetch an Article**: Enter a URL in the input field and click "Fetch"
2. **Read**: View the article in the clean reading view
3. **Listen**: Use the TTS controls to listen to the article
4. **Save**: Click the bookmark icon to save for offline reading
5. **Summarize**: Click "Generate Summary" for AI-powered summaries

## API Keys

The app uses the following APIs:

- **Jina AI Reader**: Free, no API key required
- **Google Jules API**: Configure `VITE_JULES_API_KEY` in `.env`

Create a `.env` file:

```env
VITE_JULES_API_KEY=your_jules_api_key_here
```

## Project Structure

```
jules-reader/
├── src/
│   ├── components/      # React components
│   │   ├── ArticleView.tsx
│   │   ├── URLInput.tsx
│   │   └── SavedArticles.tsx
│   ├── hooks/          # Custom React hooks
│   │   ├── useTTS.ts
│   │   └── useArticleStorage.ts
│   ├── lib/            # Utilities and API clients
│   │   ├── jina.ts
│   │   ├── jules.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── public/             # Static assets
├── capacitor.config.ts # Capacitor configuration
└── package.json
```

## Deployment

### GitHub Pages

The app is configured for GitHub Pages. After building, push to the `gh-pages` branch:

```bash
npm run build
# Deploy dist/ to gh-pages branch
```

### Android APK

Use Capacitor to build an APK:

```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Build the APK in Android Studio.

## License

MIT License - feel free to use and modify.

## Acknowledgments

- Jina AI for article parsing
- Google Jules for AI summarization
- Capacitor team for the hybrid app framework
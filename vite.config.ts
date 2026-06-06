import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // piper-tts-web lädt WASM/Phonemize/Worker zur Laufzeit per fetch() aus
    // `node_modules/piper-tts-web/dist/...` — wir kopieren das nach `public/`,
    // sodass es unter `/onnx/`, `/piper/` und `/worker/` ausgeliefert wird.
  viteStaticCopy({
    targets: [
      { src: 'node_modules/piper-tts-web/dist/onnx', dest: '.' },
      { src: 'node_modules/piper-tts-web/dist/piper', dest: '.' },
      { src: 'node_modules/piper-tts-web/dist/worker', dest: '.' },
    ],
  }),
  ],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
  },
});

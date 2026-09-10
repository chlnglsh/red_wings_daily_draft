import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [react(), tailwind(), devvit()],
  resolve: {
    // src/client/app is a symlink to the top-level game's src/ (a separate
    // package with its own node_modules) — without this, React resolved through
    // the symlink's real path differs from the React react-dom renders with,
    // and every hook call in the ported app throws (null dispatcher).
    dedupe: ['react', 'react-dom'],
    // Same build-time team selection as the standalone app's vite.config.ts:
    // `@team` -> src/teams/<TEAM>/ inside the symlinked game source. This Devvit
    // app is the Red Wings one; other teams get their own app (later phase).
    alias: { '@team': resolve(__dirname, 'src/client/app/teams', process.env.TEAM || 'redwings') },
  },
});

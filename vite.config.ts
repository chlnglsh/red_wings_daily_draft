import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { gameTitle } from './src/data/team.ts'

// The standalone build (GitHub Pages) is a "Dynasty Draft"; every other target
// (Reddit/Devvit, local dev) is the "Daily Draft". The runtime UI already gates
// on platform.showsLeaderboard, but the static <title> in index.html can't see
// that, so rewrite it at build time from the same gameTitle() source of truth.
// GITHUB_PAGES is set only for the standalone build (see base below).
function htmlTitlePlugin(): Plugin {
  const title = gameTitle(!process.env.GITHUB_PAGES)
  return {
    name: 'html-game-title',
    transformIndexHtml(html) {
      return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), htmlTitlePlugin()],
  // GitHub Pages serves project sites from a /<repo-name>/ subpath; every
  // other target (local dev, Vercel, Netlify) serves from the root.
  base: process.env.GITHUB_PAGES ? '/red_wings_daily_draft/' : '/',
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})

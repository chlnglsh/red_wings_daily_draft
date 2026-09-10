import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { formatGameTitle } from './src/teams/gameTitle.ts'
import { TEAM_IDENTITIES, type TeamIdentity } from './src/teams/registry.ts'

// ---- Build-time team selection -------------------------------------------------
// TEAM=<team> (default redwings) picks which src/teams/<team>/ folder the `@team`
// alias resolves to, so only that team's data, art, and event modules are bundled.
// Everything else that differs per team is derived from it here: the deploy
// subpath, the static <title>, and the public/ folder (favicon etc.).
const team = process.env.TEAM || 'redwings'
const teamDir = resolve(import.meta.dirname, 'src/teams', team)
const registered = (TEAM_IDENTITIES as Record<string, TeamIdentity | undefined>)[team]
if (!registered || !existsSync(resolve(teamDir, 'index.ts'))) {
  throw new Error(`Unknown TEAM "${team}": needs src/teams/${team}/index.ts and an entry in src/teams/registry.ts`)
}
const IDENTITY: TeamIdentity = registered

// ---- Deploy paths --------------------------------------------------------------
// The GitHub Pages project site lives at /red_wings_daily_draft/ and that URL is
// frozen with the Red Wings at its root. Every other team deploys to a subfolder
// of it (/red_wings_daily_draft/<team>/). Local dev and other hosts serve from /.
const PAGES_ROOT = '/red_wings_daily_draft/'
const base = process.env.GITHUB_PAGES ? (team === 'redwings' ? PAGES_ROOT : `${PAGES_ROOT}${team}/`) : '/'

// The standalone build (GitHub Pages) is a "Dynasty Draft"; every other target
// (Reddit/Devvit, local dev) is the "Daily Draft". The runtime UI already gates
// on platform.showsLeaderboard, but the static <title> in index.html can't see
// that, so rewrite it at build time from the same formatGameTitle() source of truth.
function htmlTitlePlugin(): Plugin {
  const title = formatGameTitle(IDENTITY.name, !process.env.GITHUB_PAGES)
  return {
    name: 'html-game-title',
    transformIndexHtml(html) {
      return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    },
  }
}

// Per-team static files (favicon, apple-touch-icon) copied verbatim to the output
// root. A team without one (a dev fixture) simply ships none.
const teamPublicDir = resolve(teamDir, 'public')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), htmlTitlePlugin()],
  base,
  publicDir: existsSync(teamPublicDir) ? teamPublicDir : false,
  resolve: {
    alias: { '@team': teamDir },
  },
  optimizeDeps: {
    // Only crawl the standalone app's entry. The Devvit app under red-wings-daily/
    // has its own HTML entries and its own node_modules; letting the default
    // crawl find them pre-bundles a second copy of React in dev ("Invalid hook call").
    entries: ['index.html'],
  },
  build: {
    // Non-root teams build into a subfolder so one dist/ can hold every team's
    // site for a single GitHub Pages deploy (see .github/workflows/deploy-pages.yml).
    outDir: team === 'redwings' ? 'dist' : `dist/${team}`,
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';
import { TEAM_IDENTITIES, type TeamIdentity } from './src/client/app/teams/registry';

// Build-time team selection, mirroring the standalone app's vite.config.ts: TEAM
// (default redwings) picks the src/teams/<team>/ folder behind the `@team` alias,
// the static <title> of both entry pages, and the server's post title. Each team
// is its own Devvit app; tools/with-team.mjs sets TEAM and swaps devvit.json's app
// name for the duration of a build/playtest/upload.
const team = process.env.TEAM || 'redwings';
const teamDir = resolve(__dirname, 'src/client/app/teams', team);
const registered = (TEAM_IDENTITIES as Record<string, TeamIdentity | undefined>)[team];
if (!registered || !existsSync(resolve(teamDir, 'index.ts'))) {
  throw new Error(`Unknown TEAM "${team}": needs src/teams/${team}/index.ts and an entry in src/teams/registry.ts`);
}
const IDENTITY: TeamIdentity = registered;
// The Reddit build is always the once-a-day "Daily Draft" (see gameTitle in the game source).
const title = `${IDENTITY.name} Daily Draft`;

function htmlTitlePlugin(): Plugin {
  return {
    name: 'html-game-title',
    transformIndexHtml(html) {
      return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwind(), devvit(), htmlTitlePlugin()],
  // Server code stays isolated from the symlinked app/ tree, so it gets the team
  // name as a compile-time constant instead of importing the config.
  define: {
    __TEAM_NAME__: JSON.stringify(IDENTITY.name),
  },
  resolve: {
    // src/client/app is a symlink to the top-level game's src/ (a separate
    // package with its own node_modules) — without this, React resolved through
    // the symlink's real path differs from the React react-dom renders with,
    // and every hook call in the ported app throws (null dispatcher).
    dedupe: ['react', 'react-dom'],
    alias: { '@team': teamDir },
  },
});

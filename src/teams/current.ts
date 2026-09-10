// The one place the build-selected team enters the engine. `@team` is a Vite alias
// resolved from the TEAM env var (default redwings) — see vite.config.ts — so only
// the selected team's data, art, and event modules are ever bundled. TypeScript
// resolves the same alias to src/teams/redwings via tsconfig paths; every team
// satisfies the same TeamConfig, so type-checking against one covers all.
import { TEAM } from '@team';
import { formatGameTitle } from './gameTitle';

export { TEAM };
export const gameTitle = (showsLeaderboard: boolean) => formatGameTitle(TEAM.identity.name, showsLeaderboard);

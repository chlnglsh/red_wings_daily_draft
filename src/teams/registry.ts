// Build-time registry of team identities, one entry per team. vite.config.ts reads
// it to derive the deploy subpath and static <title> for the selected TEAM without
// importing the team's full config (which pulls in art and React), and each team's
// index.ts reads its own entry back so there is exactly one copy of these strings.
//
// Deliberately import-free: Vite bundles this file into the config at startup, and
// its loader wants every import there to carry a file extension. Pure data only.

export interface TeamIdentity {
  /** e.g. 'Detroit'. Only ever shown combined with `name` (league standings). */
  city: string;
  /** e.g. 'Red Wings'. How the player's team is named everywhere on its own. */
  name: string;
  /** Dev-time default subreddit (no leading r/). A real Reddit install resolves its own. */
  subreddit: string;
}

export const TEAM_IDENTITIES = {
  redwings: { city: 'Detroit', name: 'Red Wings', subreddit: 'RedWings' },
  // Dev-only West fixture, never deployed — see src/teams/devwest/index.ts.
  devwest: { city: 'San Jose', name: 'Sharks', subreddit: 'SanJoseSharks' },
} satisfies Record<string, TeamIdentity>;

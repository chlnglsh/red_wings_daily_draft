// The Reddit build is a one-play-per-day contest, so it's a "Daily Draft". The
// standalone build has no daily lock (a refresh just replays), and it's really a
// build-your-all-time-roster game, so it's a "Dynasty Draft" instead. Gated on the
// same showsLeaderboard flag that separates the two builds everywhere else.
//
// Kept free of any team import so vite.config.ts can call it at build time for the
// static <title> (the runtime UI uses the bound gameTitle() in ./current.ts).
export function formatGameTitle(teamName: string, showsLeaderboard: boolean): string {
  return `${teamName} ${showsLeaderboard ? 'Daily' : 'Dynasty'} Draft`;
}

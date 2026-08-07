import type { DraftPick } from '../types';
import type { SeasonSimResult } from './gameSim';
import type { PostseasonResult } from './postseason';

export interface SavedRun {
  picks: DraftPick[];
  simResult: SeasonSimResult;
  // null in a regular-season-only build (HAS_POSTSEASON off) — no bracket is simulated.
  postseason: PostseasonResult | null;
}

export interface LeaderboardEntry {
  username: string;
  points: number;
  wins: number;
  losses: number;
  otl: number;
}

export interface ChampionEntry {
  username: string;
  achievement: 'Stanley Cup Champion' | 'Conference Champion';
}

// Seam between the shared game (this file's directory, also used standalone for
// web/mobile) and whatever real backend a given build runs on. The default
// implementation (mockPlatform.ts) is pure client-side fakery; a Reddit build
// swaps in one backed by real subreddit data — see red-wings-daily/src/client/redditPlatform.ts.
export interface Platform {
  // False for the standalone web/mobile production build — those screens have
  // no real subreddit behind them, so the leaderboard/Hall of Champions UI is
  // skipped entirely rather than showing fake usernames to real end users.
  readonly showsLeaderboard: boolean;
  // True only for a real community build (Reddit): in-season events like March
  // Collapse fire on a shared *daily* roll (same day for the whole subreddit).
  // False for standalone builds (web/mobile, and dev), where there's no shared
  // community — those roll per *playthrough* instead, so a player who keeps
  // playing eventually hits the event rather than depending on the calendar day.
  // Distinct from showsLeaderboard on purpose: mockPlatform shows a dev
  // leaderboard yet is still a standalone build for event-cadence purposes.
  readonly sharedDailyEvents: boolean;
  getLeaderboard(dateSeed: number): Promise<LeaderboardEntry[]>;
  getHallOfChampions(dateSeed: number): Promise<ChampionEntry[]>;
  submitScore(result: { points: number; wins: number; losses: number; otl: number }): Promise<void>;
  submitAchievement(achievement: ChampionEntry['achievement']): Promise<void>;
  // One-play-per-day is a Reddit-only concept (the standalone web/mobile build has
  // no per-user identity to key it off). getTodaysPlay always resolving to null is
  // what makes a platform ungated — mockPlatform/hiddenPlatform never save a run,
  // so they never have one to return here.
  saveTodaysPlay(run: SavedRun): Promise<void>;
  getTodaysPlay(): Promise<SavedRun | null>;
  // The subreddit this build is actually installed in, at runtime — a real
  // Reddit install could be on any subreddit, not just the one named in
  // data/team.ts (that constant is just this build's dev-time default/fallback,
  // used verbatim by the mock/hidden platforms since neither has a real one).
  getSubreddit(): Promise<string>;
}

export function rankAmong(playerPoints: number, others: LeaderboardEntry[]): { rank: number; total: number } {
  const better = others.filter((e) => e.points > playerPoints).length;
  return { rank: better + 1, total: others.length + 1 };
}

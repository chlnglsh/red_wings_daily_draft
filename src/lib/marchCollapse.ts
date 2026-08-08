// March Collapse: a regular-season-only mid-season event that fires 1-in-8, in one
// of two cadences depending on the build (see Platform.sharedDailyEvents):
//   - Community build (Reddit): a shared *daily* roll keyed to the day's dateSeed,
//     so the whole subreddit gets it on the same day — isMarchCollapseDay.
//   - Standalone build (web/mobile, dev): a per-*playthrough* roll keyed to the
//     run's runSeed, so a player who keeps playing hits it ~1 in 8 runs rather than
//     depending on the calendar day — isMarchCollapsePlay.
// Either way it doesn't touch the roster like Trade Deadline does — it's purely a
// win% modifier hook (see modifierForGame in gameSim.ts), triggered by a live skill
// minigame instead of a random resolution.
import { hashStringToInt } from './prng';

// Matches the real Red Wings' typical March/April games-remaining count.
export const MARCH_COLLAPSE_GAME = 66;

// 1-in-8 odds, shared by both cadences — only the seed differs (date vs playthrough).
const COLLAPSE_ODDS = 8;

function rollsCollapse(seed: number): boolean {
  return hashStringToInt(`${seed}:marchCollapse`) % COLLAPSE_ODDS === 0;
}

// Community (Reddit) cadence: same result for everyone on a given day.
export function isMarchCollapseDay(dateSeed: number): boolean {
  return rollsCollapse(dateSeed);
}

// Standalone cadence: fresh roll each playthrough (runSeed changes every play).
export function isMarchCollapsePlay(runSeed: number): boolean {
  return rollsCollapse(runSeed);
}

// A downward drag, not a cliff — starts smaller right after the collapse and
// compounds over the remaining stretch, then holds flat once it ramps up. Never
// shown to the player as a number; only ever surfaces as narrative flavor. Sized so
// the failed stand really bites: it maxes at a -0.20 win% hit on the flat stretch
// (up from -0.05), with the onset kept proportionally small (1:5 ramp).
const PENALTY_START = 0.04;
const PENALTY_MAX = 0.2;
const PENALTY_RAMP_GAMES = 8;

export function buildCollapsePenaltyModifier(collapseGame: number): (gameNumber: number) => number {
  return (gameNumber: number) => {
    const gamesSince = gameNumber - collapseGame;
    if (gamesSince < 0) return 0;
    const t = Math.min(1, gamesSince / PENALTY_RAMP_GAMES);
    return -(PENALTY_START + (PENALTY_MAX - PENALTY_START) * t);
  };
}

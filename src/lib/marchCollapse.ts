// March Collapse: a regular-season-only mid-season event. Fires on 1-in-8 days,
// tied to the day's dateSeed (not the per-playthrough runSeed) so it's the same day
// for the whole subreddit, not a per-user roll. Doesn't touch the roster like Trade
// Deadline does — it's purely a win% modifier hook (see modifierForGame in gameSim.ts),
// triggered by a live skill minigame instead of a random resolution.
import { hashStringToInt } from './prng';

// Matches the real Red Wings' typical March/April games-remaining count.
export const MARCH_COLLAPSE_GAME = 66;

export function isMarchCollapseDay(dateSeed: number): boolean {
  return hashStringToInt(`${dateSeed}:marchCollapse`) % 8 === 0;
}

// A soft downward drag, not a cliff — starts small right after the collapse and
// compounds gently over the remaining stretch, then holds flat once it ramps up.
// Never shown to the player as a number; only ever surfaces as narrative flavor.
const PENALTY_START = 0.01;
const PENALTY_MAX = 0.05;
const PENALTY_RAMP_GAMES = 8;

export function buildCollapsePenaltyModifier(collapseGame: number): (gameNumber: number) => number {
  return (gameNumber: number) => {
    const gamesSince = gameNumber - collapseGame;
    if (gamesSince < 0) return 0;
    const t = Math.min(1, gamesSince / PENALTY_RAMP_GAMES);
    return -(PENALTY_START + (PENALTY_MAX - PENALTY_START) * t);
  };
}

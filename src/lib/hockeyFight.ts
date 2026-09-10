// Hockey Fight: an UPSIDE-ONLY, regular-season, first-half-only in-season event.
// Unlike March Collapse (a downside-only defensive stand), a fight only ever helps:
// the whole bench gets fired up regardless of who wins the scrap, so the graded
// outcome is just different sizes of a temporary win% boost, never a penalty.
//
// Cadence mirrors March Collapse's two builds (see Platform.sharedDailyEvents):
//   - Community build (Reddit): a shared *daily* roll keyed to the day's dateSeed,
//     so the whole subreddit gets the same fight (and the same variant) that day —
//     isHockeyFightDay.
//   - Standalone build (web/mobile, dev): a per-*playthrough* roll keyed to the
//     run's runSeed, so a repeat player hits it ~1 in 3 runs rather than waiting on
//     the calendar — isHockeyFightPlay.
// Fights are common in the sport, so the odds are deliberately higher than March
// Collapse's 1-in-8. Like the collapse, the boost is never shown to the player as a
// number — it only surfaces as narrative flavor in the game log.
import { hashStringToInt } from './prng';

// 1-in-3 odds, shared by both cadences — only the seed differs (date vs playthrough).
const FIGHT_ODDS = 3;

// The fight fires at a random game in this inclusive window: after the opening five
// games have settled, and constrained to the first half of the season so any
// boost has room to fully play out before the midpoint. Both bounds derive from the
// same seed the roll uses, so the whole subreddit gets the same fight game that day.
export const FIGHT_WINDOW_START = 6;
export const FIGHT_WINDOW_END = 41;

// Three distinct minigame concepts, chosen per fight-day by the daily seed and
// rotating across the three over time. A deliberate lightweight A/B test: all three
// ship, and real usage (plus out-of-app subreddit feedback) decides which stays.
export type FightVariant = 0 | 1 | 2;
export const FIGHT_VARIANT_COUNT = 3;

// Graded outcome. There is no penalty tier — a bad loss simply grants no boost.
export type FightOutcome = 'loss' | 'tie' | 'win';

// Flat win% boost per boosted game (never shown to the player). A tie boosts the next
// game only; a win boosts the next three. Magnitude is a first-pass default, sized
// between the GM/Coach flat nudges (~0.05) and the March Collapse max drag (0.20);
// tune once there's real playtest feedback.
const FIGHT_BOOST = 0.1;
const TIE_BOOST_GAMES = 1;
const WIN_BOOST_GAMES = 3;

function rollsFight(seed: number): boolean {
  return hashStringToInt(`${seed}:hockeyFight`) % FIGHT_ODDS === 0;
}

// Community (Reddit) cadence: same result for everyone on a given day.
export function isHockeyFightDay(dateSeed: number): boolean {
  return rollsFight(dateSeed);
}

// Standalone cadence: fresh roll each playthrough (runSeed changes every play).
export function isHockeyFightPlay(runSeed: number): boolean {
  return rollsFight(runSeed);
}

// Which game (within FIGHT_WINDOW_START..FIGHT_WINDOW_END) the fight fires at.
export function hockeyFightGame(seed: number): number {
  const span = FIGHT_WINDOW_END - FIGHT_WINDOW_START + 1;
  return FIGHT_WINDOW_START + (hashStringToInt(`${seed}:hockeyFightGame`) % span);
}

// Which of the three minigame variants shows this fight-day.
export function hockeyFightVariant(seed: number): FightVariant {
  return (hashStringToInt(`${seed}:hockeyFightVariant`) % FIGHT_VARIANT_COUNT) as FightVariant;
}

// The regulation minute the scrap breaks out at, within the fight game. Kept to the
// mid stretch of the 60-minute game (not the opening or dying minutes) so it clearly
// reads as interrupting a game in progress. The game's opponent becomes the fight's
// challenger, and the win% boost applies to the games *after* this one.
export const FIGHT_MINUTE_MIN = 15;
export const FIGHT_MINUTE_MAX = 45;
export function hockeyFightMinute(seed: number): number {
  const span = FIGHT_MINUTE_MAX - FIGHT_MINUTE_MIN + 1;
  return FIGHT_MINUTE_MIN + (hashStringToInt(`${seed}:hockeyFightMinute`) % span);
}

// How many games the outcome boosts (0 for a loss — upside-only, so a loss is just neutral).
export function boostGamesForOutcome(outcome: FightOutcome): number {
  return outcome === 'win' ? WIN_BOOST_GAMES : outcome === 'tie' ? TIE_BOOST_GAMES : 0;
}

// A flat positive win% bump applied to the boosted stretch [fightGame, fightGame+N),
// then nothing. No ramp or decay — the spec frames it as a clean "next N games" boost.
export function buildFightBoostModifier(
  fightGame: number,
  outcome: FightOutcome,
): (gameNumber: number) => number {
  const boostedGames = boostGamesForOutcome(outcome);
  return (gameNumber: number) => {
    const gamesSince = gameNumber - fightGame;
    if (gamesSince < 0 || gamesSince >= boostedGames) return 0;
    return FIGHT_BOOST;
  };
}

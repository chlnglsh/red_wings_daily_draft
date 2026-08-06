import type { SeasonEra } from '../types';
import { FLAVOR } from '../data/flavorText';

// Real game-by-game season simulation. Hockey has no draws — every game is decided
// in regulation, overtime, or a shootout — so each game here is a plain win or loss,
// with OT/SO games flagged separately since a loss there is worth 1 standings point
// (an "OTL") instead of 0. Winner always gets 2 points.
export const SEASON_LENGTH = 82;
const OT_RATE = 0.23; // share of decided games that go to OT/SO, real NHL league norm
const OT_VS_SHOOTOUT = 0.65; // of those, share that end in OT rather than a shootout

// Same win% derivation as the closed-form "predicted" calculator in simulate.ts —
// kept in sync so the prediction and the real simulation agree on what a given
// roster score means, even though the real simulation lets individual games swing.
const BASELINE_SCORE = 375;
const SCORE_TO_WINPCT = 0.00171;
export const MIN_WINPCT = 0.15;
export const MAX_WINPCT = 0.85;

export function deriveWinPct(rosterScore: number): number {
  const raw = 0.5 + (rosterScore - BASELINE_SCORE) * SCORE_TO_WINPCT;
  return Math.min(MAX_WINPCT, Math.max(MIN_WINPCT, raw));
}

// Postseason opponent-vs-opponent games (neither side is the player's roster) don't
// have a roster score to compare against a baseline — instead this derives a win%
// straight from the gap between the two sides' sampled standings-point totals.
// DIFF_TO_WINPCT is a first estimate (an ~18-point gap, a typical division-winner-vs
// -bubble-wildcard spread, lands around 68%) — tune empirically like TEAM_GOAL_MEAN was.
const DIFF_TO_WINPCT = 0.01;

export function deriveOpponentWinPct(pointsA: number, pointsB: number): number {
  const raw = 0.5 + (pointsA - pointsB) * DIFF_TO_WINPCT;
  return Math.min(MAX_WINPCT, Math.max(MIN_WINPCT, raw));
}

// Flavor opponents only — not real schedules or opposing rosters. One rotating pool
// per era so old seasons face period-appropriate rivals instead of expansion teams
// that didn't exist yet. See data/flavorText.ts for the reskin-swappable source.
const ORIGINAL_SIX_RIVALS = FLAVOR.rivalPools.originalSix;
const MODERN_RIVALS = FLAVOR.rivalPools.modern;

// Regulation is minute 0-60 (three 20-min periods). OT/SO games carry one extra
// marker past 60 for the deciding moment, so the live reveal can show "OT"/"SO"
// instead of a period+clock time for it.
export const REGULATION_END = 60;
export const OT_MARK = 61;
export const SO_MARK = 62;

export interface GoalEvent {
  minute: number; // 0-60 in regulation, or OT_MARK/SO_MARK
  label: string; // e.g. "14:32 · 2nd" or "OT" or "SO"
  scorer: string | null; // null = scored by an unnamed rest-of-roster teammate
}

export interface OpponentGoalEvent {
  minute: number;
  label: string;
}

export interface GameResult {
  gameNumber: number;
  opponent: string;
  home: boolean;
  result: 'W' | 'L';
  decidedIn: 'REG' | 'OT' | 'SO';
  teamGoals: number;
  oppGoals: number;
  goalEvents: GoalEvent[]; // our team's goals, every one — sorted by minute
  oppGoalEvents: OpponentGoalEvent[]; // opponent's goals, timed but unnamed (no opposing roster data)
  endMinute: number; // REGULATION_END, OT_MARK, or SO_MARK — how far the live clock needs to run
}

export interface SeasonSimResult {
  games: GameResult[];
  wins: number;
  losses: number;
  otl: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface WeightedSkater {
  name: string;
  weight: number; // that player's season GOALS (not points) — higher scorers get "credited" more often
}

// Your 5 drafted skaters are the stars of a full ~20-man lineup, not the whole team —
// crediting every single goal to one of just 5 names would inflate any decent scorer
// into a fictional 70-80 goal season. Only this share of our goals get a named
// scorer; the rest still count (and still show up as a timed event, just unnamed),
// same as a real team where depth players score plenty too.
const SKATER_ATTRIBUTION_RATE = 0.55;

function formatMinute(minute: number): string {
  if (minute >= OT_MARK) return 'OT'; // shown as OT even for shootout games — see gameLine() in the UI
  const period = Math.min(3, Math.floor(minute / 20) + 1);
  const timeInPeriod = minute % 20;
  const mm = Math.floor(timeInPeriod).toString().padStart(2, '0');
  const ss = Math.floor((timeInPeriod % 1) * 60).toString().padStart(2, '0');
  const periodLabel = period === 1 ? '1st' : period === 2 ? '2nd' : '3rd';
  return `${mm}:${ss} · ${periodLabel}`;
}

// Real NHL team scoring is close to Poisson-distributed around ~3 goals/game —
// this replaces an earlier uniform 1-4 model that made shutouts impossible (it
// never generated 0) and 7-goal games far too common (~8% of games).
const TEAM_GOAL_MEAN = 2.7;

function poissonSample(mean: number, rng: () => number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

// Regulation needs a genuine winner, so resample until the two independent
// Poisson draws aren't tied — converges almost immediately in practice.
function sampleRegulationScore(rng: () => number): { winnerGoals: number; loserGoals: number } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = poissonSample(TEAM_GOAL_MEAN, rng);
    const b = poissonSample(TEAM_GOAL_MEAN, rng);
    if (a > b) return { winnerGoals: a, loserGoals: b };
    if (b > a) return { winnerGoals: b, loserGoals: a };
  }
  return { winnerGoals: 1, loserGoals: 0 }; // pathological fallback, should never actually hit
}

// Distributes a team's goal count across regulation minutes (plus one deciding
// OT/SO marker if that team is the one who won it there), sorted ascending.
function buildGoalMinutes(goalCount: number, hasDecidingGoal: boolean, endMinute: number, rng: () => number): number[] {
  const regulationCount = hasDecidingGoal ? goalCount - 1 : goalCount;
  const minutes: number[] = [];
  for (let g = 0; g < regulationCount; g++) minutes.push(rng() * REGULATION_END);
  minutes.sort((a, b) => a - b);
  if (hasDecidingGoal) minutes.push(endMinute);
  return minutes;
}

/** Builds a scorer-picker closure once per season/series so totalWeight isn't recomputed per game. */
export function buildScorerPicker(skaters: WeightedSkater[], rng: () => number): () => string | null {
  const totalWeight = skaters.reduce((sum, s) => sum + Math.max(1, s.weight), 0) || 1;
  return function pickScorer(): string | null {
    if (skaters.length === 0) return null;
    if (rng() > SKATER_ATTRIBUTION_RATE) return null; // scored by an unnamed teammate instead
    let roll = rng() * totalWeight;
    for (const s of skaters) {
      roll -= Math.max(1, s.weight);
      if (roll <= 0) return s.name;
    }
    return skaters[skaters.length - 1].name;
  };
}

// One game's worth of the engine — regulation/OT/SO, goal-by-goal detail, everything
// the live sim screen needs. Extracted from simulateSeason so playoff series (best-of-7,
// fixed real opponents, alternating home/away) can reuse the exact same engine one game
// at a time instead of duplicating it.
export function simulateGame(params: {
  rng: () => number;
  gameNumber: number;
  winPct: number;
  opponent: string;
  home: boolean;
  pickScorer: () => string | null;
}): GameResult {
  const { rng, gameNumber, winPct, opponent, home, pickScorer } = params;
  const isWin = rng() < winPct;
  const wentExtra = rng() < OT_RATE;
  const decidedIn: GameResult['decidedIn'] = wentExtra ? (rng() < OT_VS_SHOOTOUT ? 'OT' : 'SO') : 'REG';
  const endMinute = decidedIn === 'REG' ? REGULATION_END : decidedIn === 'OT' ? OT_MARK : SO_MARK;

  let winnerGoals: number;
  let loserGoals: number;
  if (decidedIn === 'REG') {
    ({ winnerGoals, loserGoals } = sampleRegulationScore(rng));
  } else {
    loserGoals = poissonSample(TEAM_GOAL_MEAN, rng); // OT/SO always a 1-goal final margin
    winnerGoals = loserGoals + 1;
  }

  const teamGoals = isWin ? winnerGoals : loserGoals;
  const oppGoals = isWin ? loserGoals : winnerGoals;

  // The deciding OT/SO goal only exists as a distinct event for whichever side won it.
  const ourMinutes = buildGoalMinutes(teamGoals, isWin && decidedIn !== 'REG', endMinute, rng);
  const oppMinutes = buildGoalMinutes(oppGoals, !isWin && decidedIn !== 'REG', endMinute, rng);

  const goalEvents: GoalEvent[] = ourMinutes.map((minute) => ({ minute, label: formatMinute(minute), scorer: pickScorer() }));
  const oppGoalEvents: OpponentGoalEvent[] = oppMinutes.map((minute) => ({ minute, label: formatMinute(minute) }));

  return {
    gameNumber,
    opponent,
    home,
    result: isWin ? 'W' : 'L',
    decidedIn,
    teamGoals,
    oppGoals,
    goalEvents,
    oppGoalEvents,
    endMinute,
  };
}

// Games are generated in ranges rather than all 82 at once, so a mid-season event
// (Trade Deadline today; GM/Coach, Hockey Fight, and March Collapse later) can change
// the roster or apply a win% modifier partway through and have it actually affect the
// remaining games — not just be cosmetic. Callers share one persistent `rng` instance
// across every call for a given day's sim, so the overall sequence stays a single
// continuous deterministic stream regardless of how many ranges it's split into.
export function simulateGamesInRange(params: {
  rng: () => number;
  pickScorer: () => string | null;
  startGame: number; // inclusive
  endGame: number; // inclusive
  baseWinPct: number;
  era: SeasonEra;
  // Additive per-game adjustment, e.g. a Hockey Fight streak boost or a March Collapse
  // penalty. Defaults to 0 — no modifier features exist yet, this is just the hook.
  modifierForGame?: (gameNumber: number) => number;
}): GameResult[] {
  const { rng, pickScorer, startGame, endGame, baseWinPct, era, modifierForGame } = params;
  const opponentPool = era === 'yzermanOnward' ? MODERN_RIVALS : ORIGINAL_SIX_RIVALS;
  const games: GameResult[] = [];

  for (let i = startGame; i <= endGame; i++) {
    const modifier = modifierForGame ? modifierForGame(i) : 0;
    const winPct = Math.min(MAX_WINPCT, Math.max(MIN_WINPCT, baseWinPct + modifier));
    const opponent = opponentPool[Math.floor(rng() * opponentPool.length)];
    const home = rng() < 0.5;
    games.push(simulateGame({ rng, gameNumber: i, winPct, opponent, home, pickScorer }));
  }
  return games;
}

/** Tallies a full (or partial) games array into the W/L/OTL/points/goals bundle the UI displays. */
export function aggregateGames(games: GameResult[]): SeasonSimResult {
  let wins = 0;
  let losses = 0;
  let otl = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const game of games) {
    if (game.result === 'W') wins++;
    else if (game.decidedIn !== 'REG') otl++;
    else losses++;
    goalsFor += game.teamGoals;
    goalsAgainst += game.oppGoals;
  }
  return { games, wins, losses, otl, points: wins * 2 + otl, goalsFor, goalsAgainst };
}

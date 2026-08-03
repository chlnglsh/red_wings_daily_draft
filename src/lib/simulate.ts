// Translates a roster_score into a simulated 82-game record against the rest of the
// league, so the payoff reads as "this team would've gone 54-21-7" rather than an
// abstract point total. Placeholder calibration — tune once real score distributions
// exist across the full season pool.
const SEASON_GAMES = 82;
const BASELINE_SCORE = 375; // roughly the midpoint of the placeholder pool's score range
const SCORE_TO_WINPCT = 0.00171; // shifts win% by ~0.35 at the pool's observed extremes
const MIN_WINPCT = 0.15;
const MAX_WINPCT = 0.85;
const OTL_RATE = 0.23; // rough share of losses that go to overtime, league-wide norm

export interface SimulatedRecord {
  wins: number;
  losses: number;
  otl: number;
  points: number;
  winPct: number;
}

export function simulateRecord(rosterScore: number): SimulatedRecord {
  const rawWinPct = 0.5 + (rosterScore - BASELINE_SCORE) * SCORE_TO_WINPCT;
  const winPct = Math.min(MAX_WINPCT, Math.max(MIN_WINPCT, rawWinPct));

  const wins = Math.round(winPct * SEASON_GAMES);
  const totalLosses = SEASON_GAMES - wins;
  const otl = Math.round(totalLosses * OTL_RATE);
  const losses = totalLosses - otl;
  const points = wins * 2 + otl;

  return { wins, losses, otl, points, winPct };
}

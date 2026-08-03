import type { DraftPick, Player, Season, StrengthLabel } from '../types';

// Reference scoring environment (total goals/game, both teams) we normalize every
// season against, so a dominant Original Six season isn't punished or inflated
// purely by playing a 70-game slate in a higher- or lower-scoring era.
const BASELINE_GOALS_PER_GAME = 6.0;
const SCORE_SCALE = 100; // just makes scores read as friendly whole-ish numbers

// Save percentage wasn't tracked before 1955-56, so a handful of goalies in the
// oldest seasons have no savePct on record. Falling back to 0 would score them as
// worthless (and make them impossible to compare); this neutral default keeps
// them roughly average instead of fabricating a specific stat for the data file.
const UNKNOWN_SAVE_PCT_DEFAULT = 0.9;

function gamesPlayedWeight(player: Player, season: Season): number {
  return Math.min(1, player.gp / season.scheduledGames);
}

function eraScale(season: Season): number {
  return BASELINE_GOALS_PER_GAME / season.leagueAvgGoalsPerGame;
}

/** Points-per-game scaled into the common scoring environment. Skaters only. */
export function normalizedPpg(player: Player, season: Season): number {
  return (player.pts / player.gp) * eraScale(season);
}

/**
 * Save percentage scaled into the common scoring environment — goalies' equivalent
 * of points-per-game. Scales the opposite direction from skaters: a given save%
 * is more impressive in a high-scoring era, less impressive in a stingy one, so we
 * scale by leagueAvg/baseline instead of baseline/leagueAvg.
 */
function normalizedSavePct(player: Player, season: Season): number {
  const savePct = player.savePct ?? UNKNOWN_SAVE_PCT_DEFAULT;
  return savePct * (season.leagueAvgGoalsPerGame / BASELINE_GOALS_PER_GAME);
}

export function playerScore(player: Player, season: Season): number {
  const rate = player.position === 'G' ? normalizedSavePct(player, season) : normalizedPpg(player, season);
  return rate * gamesPlayedWeight(player, season) * SCORE_SCALE;
}

export function rosterScore(picks: DraftPick[], seasonsById: Map<string, Season>): number {
  return picks.reduce((sum, pick) => {
    const season = seasonsById.get(pick.seasonId);
    if (!season) return sum;
    return sum + playerScore(pick.player, season);
  }, 0);
}

/** Quick "stacked vs thin" read shown before drafting, from team points that season. */
export function getStrengthSignal(season: Season): { label: StrengthLabel; pointPct: number } {
  const pointPct = season.teamPoints / (season.scheduledGames * 2);
  const label: StrengthLabel = pointPct >= 0.65 ? 'Stacked' : pointPct >= 0.5 ? 'Solid' : 'Thin';
  return { label, pointPct };
}

/** Percentile of a player's rate stat within their season's full roster at similar positions — powers the share-card squares. */
export function pickPercentile(player: Player, season: Season): number {
  const pool = season.roster.filter((p) => (p.position === 'G') === (player.position === 'G'));
  const rates = pool.map((p) => (p.position === 'G' ? normalizedSavePct(p, season) : normalizedPpg(p, season)));
  const playerRate = player.position === 'G' ? normalizedSavePct(player, season) : normalizedPpg(player, season);
  const below = rates.filter((r) => r <= playerRate).length;
  return below / rates.length;
}

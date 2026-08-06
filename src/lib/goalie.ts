import type { Player } from '../types';

// The March Collapse "Defensive Stand" holds the player to a target save
// percentage: the selected goalie's real save% for that season. Most goalies have
// it (Player.savePct), but early-era/stub goalies predate save% tracking — they
// still have a GAA, so approximate from that assuming a typical shots-against
// volume, clamped to a sane range.
const APPROX_SHOTS_AGAINST_PER_GAME = 30;
const APPROX_MIN = 0.86;
const APPROX_MAX = 0.94;
const FALLBACK_SAVE_PCT = 0.905; // last resort (no savePct and no gaa)

export function goalieTargetSavePct(goalie: Player): number {
  if (goalie.savePct != null) return goalie.savePct;
  if (goalie.gaa != null) {
    const approx = 1 - goalie.gaa / APPROX_SHOTS_AGAINST_PER_GAME;
    return Math.min(APPROX_MAX, Math.max(APPROX_MIN, approx));
  }
  return FALLBACK_SAVE_PCT;
}

// Hockey convention: ".910", no leading zero; a perfect stand stays "1.000".
export function formatSavePct(pct: number): string {
  if (pct >= 1) return '1.000';
  return pct.toFixed(3).replace(/^0/, '');
}

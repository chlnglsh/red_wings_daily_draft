// GM/Coach mechanic (V2 priority 5): the simplest of the season modifiers. Once the
// draft's six positions are filled, roll a GM and a Coach independently from the
// team's tiered pools of real franchise figures (TeamConfig.frontOffice). A figure's
// tier sets a FLAT season-long win% nudge; the two stack additively on top of
// baseWinPct and apply across the whole season (no roster mutation, no time-windowed effect).
//
// Two design rules baked in here:
//   - Recency weighting: figures whose tenure started in the team's cutoff year or
//     later roll twice as often (they're the names players recognize). A pool entry
//     can override that with an explicit weight (a named legend). Each team's pools
//     are tiered and sized so that, even with the weighting, the combined GM+Coach
//     modifier lands in a roughly normal curve centered near zero.
//   - Same-person bar: several people held both jobs, so the Coach is drawn from the
//     pool minus whoever was rolled as GM (no "Jack Adams reports to Jack Adams").
//
// Tone: every summary is strictly performance-based and light. Never reference off-ice
// conduct or personal controversy for any real figure, regardless of public record.
import type { FrontOfficeConfig, FrontOfficeEntry, FrontOfficeTier } from '../teams/types';

export type { FrontOfficeTier };

export interface FrontOfficeRoll {
  name: string;
  tier: FrontOfficeTier;
  modifier: number;
  summary: string;
}

export interface GmCoachResult {
  gm: FrontOfficeRoll;
  coach: FrontOfficeRoll;
  // Combined flat win% adjustment (gm.modifier + coach.modifier), applied to every
  // game's baseWinPct for the whole season.
  totalModifier: number;
}

// Per-roll flat win% nudge by tier (1 tier step = 0.0125 win%). Each roll spans
// +/-0.025, so the two rolls together swing at most +/-0.05 — a modest luck nudge,
// deliberately decoupled from (and much smaller than) the March Collapse skill event.
// Tune here.
export const TIER_MODIFIER: Record<FrontOfficeTier, number> = {
  elite: 0.025,
  strong: 0.0125,
  average: 0,
  weak: -0.0125,
  rough: -0.025,
};

function weightOf(entry: FrontOfficeEntry, recencyCutoffYear: number): number {
  return entry.weight ?? (entry.startYear >= recencyCutoffYear ? 2 : 1);
}

function toRoll(entry: FrontOfficeEntry): FrontOfficeRoll {
  return { name: entry.name, tier: entry.tier, modifier: TIER_MODIFIER[entry.tier], summary: entry.summary };
}

// Weighted pick from a pool: draws one rng value and walks the cumulative weights.
function weightedPick(pool: FrontOfficeEntry[], recencyCutoffYear: number, rng: () => number): FrontOfficeEntry {
  const total = pool.reduce((sum, e) => sum + weightOf(e, recencyCutoffYear), 0);
  let r = rng() * total;
  for (const entry of pool) {
    r -= weightOf(entry, recencyCutoffYear);
    if (r < 0) return entry;
  }
  return pool[pool.length - 1]; // rng===1 fallback (never with mulberry32, which is [0,1))
}

/**
 * Rolls the GM and Coach for a season. Consumes exactly two draws from the given rng
 * (GM first, then Coach), so callers must invoke it at a fixed point in a deterministic
 * rng stream. The Coach is drawn from the pool minus whoever was rolled as GM.
 */
export function rollGmCoach(frontOffice: FrontOfficeConfig, rng: () => number): GmCoachResult {
  const { gmPool, coachPool, recencyCutoffYear } = frontOffice;
  const gm = weightedPick(gmPool, recencyCutoffYear, rng);
  const coach = weightedPick(coachPool.filter((e) => e.name !== gm.name), recencyCutoffYear, rng);
  const gmRoll = toRoll(gm);
  const coachRoll = toRoll(coach);
  return { gm: gmRoll, coach: coachRoll, totalModifier: gmRoll.modifier + coachRoll.modifier };
}

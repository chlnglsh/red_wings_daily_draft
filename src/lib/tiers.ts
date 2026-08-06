import { FLAVOR, type TierId } from '../data/flavorText';

export interface Tier {
  label: string;
  flavor: string;
  emoji: string;
}

function tierFor(id: TierId): Tier {
  return FLAVOR.tiers[id];
}

// Placeholder thresholds — TBD per spec, tune once real score/points distributions
// are known from actual play.
const ROSTER_SCORE_TIER_ORDER: Array<{ min: number; id: TierId }> = [
  { min: 0, id: 'rebuildYear' },
  { min: 260, id: 'bubbleTeam' },
  { min: 330, id: 'playoffPush' },
  { min: 390, id: 'contender' },
  { min: 450, id: 'cupContender' },
  { min: 510, id: 'dynasty' },
];

/** Roster-quality estimate, shown as the "predicted standing" before simulating. */
export function getTierFromRosterScore(rosterScore: number): Tier {
  let result = ROSTER_SCORE_TIER_ORDER[0].id;
  for (const { min, id } of ROSTER_SCORE_TIER_ORDER) {
    if (rosterScore >= min) result = id;
  }
  return tierFor(result);
}

// Thresholds on points-percentage (points / max possible points), so they apply
// regardless of season length. Centered around the same win% range the roster-score
// tiers loosely target, recalibrated once real play data exists.
const POINTS_PCT_TIER_ORDER: Array<{ min: number; id: TierId }> = [
  { min: 0, id: 'rebuildYear' },
  { min: 0.35, id: 'bubbleTeam' },
  { min: 0.45, id: 'playoffPush' },
  { min: 0.55, id: 'contender' },
  { min: 0.65, id: 'cupContender' },
  { min: 0.75, id: 'dynasty' },
];

/** The real outcome, from the simulated season's actual points percentage. */
export function getTierFromPoints(pointsPct: number): Tier {
  let result = POINTS_PCT_TIER_ORDER[0].id;
  for (const { min, id } of POINTS_PCT_TIER_ORDER) {
    if (pointsPct >= min) result = id;
  }
  return tierFor(result);
}

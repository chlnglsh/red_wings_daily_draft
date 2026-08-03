export interface Tier {
  label: string;
  flavor: string;
  emoji: string;
}

// Placeholder thresholds — TBD per spec, tune once real score/points distributions
// are known from actual play.
const ROSTER_SCORE_TIERS: Array<{ min: number; tier: Tier }> = [
  { min: 0, tier: { label: 'Rebuild Year', flavor: 'This one\'s going in the record books for the wrong reasons.', emoji: '🛠️' } },
  { min: 260, tier: { label: 'Bubble Team', flavor: 'Scrapping for a wild card spot every night.', emoji: '⚖️' } },
  { min: 330, tier: { label: 'Playoff Push', flavor: 'In the mix down the stretch.', emoji: '📈' } },
  { min: 390, tier: { label: 'Contender', flavor: 'A legitimate threat come April.', emoji: '🔥' } },
  { min: 450, tier: { label: 'Cup Contender', flavor: 'One hot goalie away from a parade.', emoji: '🏆' } },
  { min: 510, tier: { label: 'Dynasty', flavor: 'Hockeytown special. Hang another banner.', emoji: '👑' } },
];

/** Roster-quality estimate, shown as the "predicted standing" before simulating. */
export function getTierFromRosterScore(rosterScore: number): Tier {
  let result = ROSTER_SCORE_TIERS[0].tier;
  for (const { min, tier } of ROSTER_SCORE_TIERS) {
    if (rosterScore >= min) result = tier;
  }
  return result;
}

// Thresholds on points-percentage (points / max possible points), so they apply
// regardless of season length. Centered around the same win% range the roster-score
// tiers loosely target, recalibrated once real play data exists.
const POINTS_PCT_TIERS: Array<{ min: number; tier: Tier }> = [
  { min: 0, tier: { label: 'Rebuild Year', flavor: 'This one\'s going in the record books for the wrong reasons.', emoji: '🛠️' } },
  { min: 0.35, tier: { label: 'Bubble Team', flavor: 'Scrapping for a wild card spot every night.', emoji: '⚖️' } },
  { min: 0.45, tier: { label: 'Playoff Push', flavor: 'In the mix down the stretch.', emoji: '📈' } },
  { min: 0.55, tier: { label: 'Contender', flavor: 'A legitimate threat come April.', emoji: '🔥' } },
  { min: 0.65, tier: { label: 'Cup Contender', flavor: 'One hot goalie away from a parade.', emoji: '🏆' } },
  { min: 0.75, tier: { label: 'Dynasty', flavor: 'Hockeytown special. Hang another banner.', emoji: '👑' } },
];

/** The real outcome, from the simulated season's actual points percentage. */
export function getTierFromPoints(pointsPct: number): Tier {
  let result = POINTS_PCT_TIERS[0].tier;
  for (const { min, tier } of POINTS_PCT_TIERS) {
    if (pointsPct >= min) result = tier;
  }
  return result;
}

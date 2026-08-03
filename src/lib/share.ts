import type { DraftPick, Season, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import { pickPercentile } from './scoring';
import type { Tier } from './tiers';

function squareFor(percentile: number): string {
  if (percentile >= 0.75) return '🟩';
  if (percentile >= 0.4) return '🟨';
  return '⬜';
}

interface RecordLike {
  wins: number;
  losses: number;
  otl: number;
  points: number;
}

export function buildShareText(options: {
  dateStr: string;
  tier: Tier;
  record: RecordLike;
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  rank: number;
  totalPlayers: number;
}): string {
  const { dateStr, tier, record, picks, seasonsById, rank, totalPlayers } = options;
  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));
  const squares = SLOT_ORDER.map((slot) => {
    const pick = bySlot.get(slot);
    if (!pick) return '⬛';
    const season = seasonsById.get(pick.seasonId);
    if (!season) return '⬛';
    return squareFor(pickPercentile(pick.player, season));
  }).join(' ');

  return [
    `Red Wings Daily Draft — ${dateStr}`,
    `${tier.emoji} ${tier.label} — ${record.wins}-${record.losses}-${record.otl} (${record.points} PTS)`,
    squares,
    `Rank #${rank} of ${totalPlayers} in r/RedWings today`,
  ].join('\n');
}

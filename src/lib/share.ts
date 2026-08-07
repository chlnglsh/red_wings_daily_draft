import type { DraftPick, Season, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import { pickPercentile } from './scoring';
import type { Tier } from './tiers';
import { gameTitle } from '../data/team';

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
  subreddit: string;
  // The Reddit build shares a dated, daily-leaderboard result; the standalone build
  // has no daily gate or subreddit, so it drops the date from the header (the
  // r/subreddit rank line is already Reddit-only, gated by rank below).
  showDate: boolean;
  // Omitted where there's no real subreddit leaderboard behind the rank (standalone
  // web/mobile, or Reddit before the leaderboard fetch resolves) — the rank line
  // is left out of the share text entirely rather than showing a fake number.
  rank?: number;
  totalPlayers?: number;
}): string {
  const { dateStr, tier, record, picks, seasonsById, subreddit, showDate, rank, totalPlayers } = options;
  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));
  const squares = SLOT_ORDER.map((slot) => {
    const pick = bySlot.get(slot);
    if (!pick) return '⬛';
    const season = seasonsById.get(pick.seasonId);
    if (!season) return '⬛';
    return squareFor(pickPercentile(pick.player, season));
  }).join(' ');

  const lines = [
    showDate ? `${gameTitle(showDate)} — ${dateStr}` : gameTitle(showDate),
    `${tier.emoji} ${tier.label} — ${record.wins}-${record.losses}-${record.otl} (${record.points} PTS)`,
    squares,
  ];
  if (rank !== undefined && totalPlayers !== undefined) {
    lines.push(`Rank #${rank} of ${totalPlayers} in r/${subreddit} today`);
  }
  return lines.join('\n');
}

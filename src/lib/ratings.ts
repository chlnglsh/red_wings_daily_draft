import type { DraftPick, Season, SlotId } from '../types';
import { playerScore } from './scoring';

// Cosmetic 40-99 "rating" for squad-quality bars (same spirit as FIFA/38-0 ratings) —
// purely a rescale of playerScore for display, doesn't feed back into any formula.
const RATING_MIN = 40;
const RATING_MAX = 99;
const PLAYER_SCORE_CEILING = 140; // roughly the best a skater/goalie hits in the dataset

export function toRating(rawScore: number): number {
  const pct = Math.max(0, Math.min(1, rawScore / PLAYER_SCORE_CEILING));
  return Math.round(RATING_MIN + pct * (RATING_MAX - RATING_MIN));
}

export interface SquadRatings {
  attack: number;
  defense: number;
  goaltending: number;
  overall: number;
}

const ATTACK_SLOTS: SlotId[] = ['LW', 'C', 'RW'];
const DEFENSE_SLOTS: SlotId[] = ['LD', 'RD'];

export function computeSquadRatings(picks: DraftPick[], seasonsById: Map<string, Season>): SquadRatings {
  const ratingBySlot = new Map<SlotId, number>();
  for (const pick of picks) {
    const season = seasonsById.get(pick.seasonId);
    if (!season) continue;
    ratingBySlot.set(pick.slot, toRating(playerScore(pick.player, season)));
  }

  const avg = (slots: SlotId[]) => {
    const values = slots.map((s) => ratingBySlot.get(s)).filter((v): v is number => v != null);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const allValues = [...ratingBySlot.values()];
  const overall = allValues.length ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length) : 0;

  return {
    attack: avg(ATTACK_SLOTS),
    defense: avg(DEFENSE_SLOTS),
    goaltending: ratingBySlot.get('G') ?? 0,
    overall,
  };
}

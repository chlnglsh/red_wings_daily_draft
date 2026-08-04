// Derives the game-sim-facing state (win%, skater weights, era) from a roster. Pulled
// out of SeasonSimScreen so it can be recomputed after a mid-season roster change
// (Trade Deadline) instead of only ever being calculated once at the top of the sim.
import type { DraftPick, Season, SeasonEra } from '../types';
import { rosterScore } from './scoring';
import { deriveWinPct, type WeightedSkater } from './gameSim';

export interface RosterGameState {
  winPct: number;
  skaters: WeightedSkater[];
  era: SeasonEra;
}

function majorityEra(picks: DraftPick[], seasonsById: Map<string, Season>): SeasonEra {
  const counts = new Map<SeasonEra, number>();
  for (const pick of picks) {
    const era = seasonsById.get(pick.seasonId)?.era;
    if (!era) continue;
    counts.set(era, (counts.get(era) ?? 0) + 1);
  }
  let best: SeasonEra = 'yzermanOnward';
  let bestCount = 0;
  for (const [era, count] of counts) {
    if (count > bestCount) {
      best = era;
      bestCount = count;
    }
  }
  return best;
}

export function deriveRosterGameState(picks: DraftPick[], seasonsById: Map<string, Season>): RosterGameState {
  const score = rosterScore(picks, seasonsById);
  const winPct = deriveWinPct(score);
  const era = majorityEra(picks, seasonsById);
  const skaters: WeightedSkater[] = picks
    .filter((p) => p.player.position !== 'G')
    .map((p) => ({ name: p.player.name, weight: p.player.g }));
  return { winPct, skaters, era };
}

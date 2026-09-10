// Derives the game-sim-facing state (win%, skater weights, era + its rival pool)
// from a roster. Pulled out of SeasonSimScreen so it can be recomputed after a
// mid-season roster change (Trade Deadline) instead of only ever being calculated
// once at the top of the sim.
import type { DraftPick, Season } from '../types';
import { TEAM } from '../teams/current';
import { rosterScore } from './scoring';
import { deriveWinPct, type WeightedSkater } from './gameSim';

export interface RosterGameState {
  winPct: number;
  skaters: WeightedSkater[];
  /** The roster's majority era (a TeamEra id). */
  era: string;
  /** That era's flavor-only opponent pool for the game feed. */
  rivals: string[];
}

// Ties go to whichever era was drafted first; an empty roster defaults to the
// team's most recent era (the last one declared).
function majorityEra(picks: DraftPick[], seasonsById: Map<string, Season>): string {
  const counts = new Map<string, number>();
  for (const pick of picks) {
    const era = seasonsById.get(pick.seasonId)?.era;
    if (!era) continue;
    counts.set(era, (counts.get(era) ?? 0) + 1);
  }
  let best = TEAM.eras[TEAM.eras.length - 1].id;
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
  const rivals = TEAM.eras.find((e) => e.id === era)!.rivals;
  const skaters: WeightedSkater[] = picks
    .filter((p) => p.player.position !== 'G')
    .map((p) => ({ name: p.player.name, weight: p.player.g }));
  return { winPct, skaters, era, rivals };
}

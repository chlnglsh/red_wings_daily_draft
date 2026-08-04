import type { Season, SeasonEra } from '../types';
import { mulberry32, hashStringToInt } from './prng';

// Spin weighting per spec: recent (Yzerman-onward) seasons come up most often,
// Original Six-through-pre-Yzerman is baseline, pre-Howe is rare texture.
// These are ERA-level weights (normalize to ~11.8% / 35.3% / 52.9%) — each era
// gets a fixed slice of the pie, split evenly among whichever seasons currently
// exist in that era. That keeps era-level odds stable no matter how the season
// pool grows, instead of drifting based on how many seasons land in each era.
export const ERA_WEIGHTS: Record<SeasonEra, number> = {
  preHowe: 0.4,
  howeToPreYzerman: 1.2,
  yzermanOnward: 1.8,
};

/** Era-weighted season spin — same odds the initial draft uses, reused by Trade Deadline sourcing. */
export function weightedPick(seasons: Season[], rng: () => number): Season {
  const eraGroups = new Map<SeasonEra, Season[]>();
  for (const season of seasons) {
    const group = eraGroups.get(season.era);
    if (group) group.push(season);
    else eraGroups.set(season.era, [season]);
  }

  const eras = [...eraGroups.keys()];
  const totalEraWeight = eras.reduce((sum, era) => sum + ERA_WEIGHTS[era], 0);

  let roll = rng() * totalEraWeight;
  let chosenEra = eras[eras.length - 1];
  for (const era of eras) {
    roll -= ERA_WEIGHTS[era];
    if (roll < 0) {
      chosenEra = era;
      break;
    }
  }

  const group = eraGroups.get(chosenEra)!;
  return group[Math.floor(rng() * group.length)];
}

/** The 6 spins for this playthrough, one per round (in SLOT_ORDER) — freshly random every play. */
export function generateRoundSeasons(seed: number, seasons: Season[]): Season[] {
  const rng = mulberry32(seed);
  return Array.from({ length: 6 }, () => weightedPick(seasons, rng));
}

/** Reroll alternate for one round — seeded off this run's seed + round index, distinct from the primary spins. */
export function getRerollAlternate(seed: number, roundIndex: number, seasons: Season[]): Season {
  const rerollSeed = hashStringToInt(`${seed}:reroll:${roundIndex}`);
  const rng = mulberry32(rerollSeed);
  return weightedPick(seasons, rng);
}

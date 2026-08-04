import { mulberry32, hashStringToInt } from './prng';
import { MOCK_USERNAMES } from './leaderboard';

// Same "no backend yet" mock pattern as the regular-season leaderboard — a badge
// board, not a ranking, since postseason outcomes don't affect the daily score.
// Everyone who becomes Conference Champion made the Final; a subset of those also
// go on to win the Cup.
export interface HallOfChampionsEntry {
  username: string;
  achievement: 'Stanley Cup Champion' | 'Conference Champion';
}

const CUP_CHANCE = 0.02;
const CONFERENCE_CHANCE = 0.08; // on top of CUP_CHANCE — reached the Final but lost it

export function generateHallOfChampions(dailySeed: number, poolSize = 400): HallOfChampionsEntry[] {
  const rng = mulberry32(hashStringToInt(`${dailySeed}:hallofchampions`));
  const entries: HallOfChampionsEntry[] = [];
  for (let i = 0; i < poolSize; i++) {
    const roll = rng();
    const username = MOCK_USERNAMES[i % MOCK_USERNAMES.length] + (i >= MOCK_USERNAMES.length ? `_${i}` : '');
    if (roll < CUP_CHANCE) {
      entries.push({ username, achievement: 'Stanley Cup Champion' });
    } else if (roll < CUP_CHANCE + CONFERENCE_CHANCE) {
      entries.push({ username, achievement: 'Conference Champion' });
    }
  }
  return entries;
}

import { mulberry32, hashStringToInt } from './prng';
import { simulateRecord } from './simulate';

// Phase 1 has no backend, so the leaderboard is simulated: a deterministic set
// of "other players" for the day, seeded off the same daily seed everyone shares.
// Replace with real Redis-backed aggregation in Phase 3.
const MOCK_USERNAMES = [
  'zetterberg_stan', 'HockeytownHermit', 'wings_since_97', 'OctopusThrower',
  'yzerman_captain', 'lidstrom_perfect', 'GordieHoweHatTrick', 'winged_wheel_fan',
  'joelouisghost', 'PavelD13', 'RedWingsOrBust', 'ShanahanShot', 'sawchuk_stonewall',
  'DetroitDraftDodger', 'no_cup_since_08', 'FedorovFlyer', 'ProbertPunches',
  'KozlovKid', 'ChelsGreat', 'LCArenaRegular', 'AbelAndKelly', 'BigCityHockey',
  'grindline4life', 'DelvecchioDeke', 'MotorCityMiracle',
];

export interface MockLeaderboardEntry {
  username: string;
  score: number;
}

export function generateMockLeaderboard(dailySeed: number, count = 120): MockLeaderboardEntry[] {
  const rng = mulberry32(hashStringToInt(`${dailySeed}:leaderboard`));
  const entries: MockLeaderboardEntry[] = [];
  for (let i = 0; i < count; i++) {
    // Roughly bell-shaped spread around a plausible mid-pack score.
    const spread = (rng() + rng() + rng() + rng()) / 4; // ~ triangular/normal-ish, [0,1)
    const score = Math.round(180 + spread * 400);
    entries.push({ username: MOCK_USERNAMES[i % MOCK_USERNAMES.length] + (i >= MOCK_USERNAMES.length ? `_${i}` : ''), score });
  }
  return entries;
}

// Ranked by actual simulated standings points, against mock entries' own (closed-form
// approximated) points — the real player's number now comes from a real game-by-game
// simulation, not this shortcut, but the mock pool doesn't need full simulations run.
export function rankAmong(playerPoints: number, others: MockLeaderboardEntry[]): { rank: number; total: number } {
  const better = others.filter((e) => simulateRecord(e.score).points > playerPoints).length;
  return { rank: better + 1, total: others.length + 1 };
}

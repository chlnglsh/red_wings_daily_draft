import { mulberry32, hashStringToInt } from './prng';
import { simulateRecord } from './simulate';
import type { ChampionEntry, LeaderboardEntry, Platform } from './platform';
import { FLAVOR } from '../data/flavorText';
import { SUBREDDIT } from '../data/team';

// No backend to talk to outside Reddit — deterministic fake pool of "other
// players" for the day, seeded off the same daily seed everyone shares. Used
// for local dev only; the real production web/mobile build uses hiddenPlatform.
export const MOCK_USERNAMES = FLAVOR.mockUsernames;

function mockUsername(i: number): string {
  return MOCK_USERNAMES[i % MOCK_USERNAMES.length] + (i >= MOCK_USERNAMES.length ? `_${i}` : '');
}

function generateLeaderboard(dailySeed: number, count = 120): LeaderboardEntry[] {
  const rng = mulberry32(hashStringToInt(`${dailySeed}:leaderboard`));
  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < count; i++) {
    // Roughly bell-shaped spread around a plausible mid-pack roster score.
    const spread = (rng() + rng() + rng() + rng()) / 4; // ~ triangular/normal-ish, [0,1)
    const score = Math.round(180 + spread * 400);
    const record = simulateRecord(score);
    entries.push({ username: mockUsername(i), points: record.points, wins: record.wins, losses: record.losses, otl: record.otl });
  }
  return entries;
}

const CUP_CHANCE = 0.02;
const CONFERENCE_CHANCE = 0.08; // on top of CUP_CHANCE — reached the Final but lost it

function generateHallOfChampions(dailySeed: number, poolSize = 400): ChampionEntry[] {
  const rng = mulberry32(hashStringToInt(`${dailySeed}:hallofchampions`));
  const entries: ChampionEntry[] = [];
  for (let i = 0; i < poolSize; i++) {
    const roll = rng();
    const username = mockUsername(i);
    if (roll < CUP_CHANCE) {
      entries.push({ username, achievement: 'Stanley Cup Champion' });
    } else if (roll < CUP_CHANCE + CONFERENCE_CHANCE) {
      entries.push({ username, achievement: 'Conference Champion' });
    }
  }
  // Stanley Cup champions are the bigger achievement — list them first.
  return entries.sort((a, b) => (a.achievement === b.achievement ? 0 : a.achievement === 'Stanley Cup Champion' ? -1 : 1));
}

export const mockPlatform: Platform = {
  showsLeaderboard: true,
  sharedDailyEvents: false, // standalone (dev): March Collapse rolls per playthrough
  async getLeaderboard(dateSeed) {
    return generateLeaderboard(dateSeed);
  },
  async getHallOfChampions(dateSeed) {
    return generateHallOfChampions(dateSeed);
  },
  async submitScore() {
    // no backend outside Reddit
  },
  async submitAchievement() {
    // no backend outside Reddit
  },
  async saveTodaysPlay() {
    // no backend outside Reddit
  },
  async getTodaysPlay() {
    return null; // standalone dev build is never gated to one play per day
  },
  async getSubreddit() {
    return SUBREDDIT; // no real subreddit outside Reddit — this build's dev-time default
  },
};

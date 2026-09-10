import type { Platform } from './platform';
import { TEAM } from '../teams/current';

// Production web/mobile build: no real subreddit behind the leaderboard, so
// showsLeaderboard=false tells the results/postseason screens to skip that UI
// entirely rather than show fake usernames to real end users.
export const hiddenPlatform: Platform = {
  showsLeaderboard: false,
  sharedDailyEvents: false, // standalone web/mobile: in-season events roll per playthrough
  async getLeaderboard() {
    return [];
  },
  async getHallOfChampions() {
    return [];
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
    return null; // production web/mobile build is never gated to one play per day
  },
  async getSubreddit() {
    return TEAM.identity.subreddit; // no real subreddit outside Reddit — this build's default
  },
};

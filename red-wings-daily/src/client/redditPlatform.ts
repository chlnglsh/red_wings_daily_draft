import type { Platform } from './app/lib/platform';

// The only place Reddit-specific data-fetching touches the game — lives outside
// the symlinked app/ tree so it can never leak into the standalone web/mobile build.
export const redditPlatform: Platform = {
  showsLeaderboard: true,
  sharedDailyEvents: true, // real subreddit: March Collapse is a shared daily event

  async getLeaderboard() {
    const res = await fetch('/api/results/leaderboard');
    if (!res.ok) return [];
    return res.json();
  },

  async getHallOfChampions() {
    const res = await fetch('/api/results/champions');
    if (!res.ok) return [];
    return res.json();
  },

  async submitScore(result) {
    await fetch('/api/results/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
  },

  async submitAchievement(achievement) {
    await fetch('/api/results/achievement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievement }),
    });
  },

  async saveTodaysPlay(run) {
    await fetch('/api/results/today', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(run),
    });
  },

  async getTodaysPlay() {
    const res = await fetch('/api/results/today');
    if (!res.ok) return null;
    return res.json();
  },

  async getSubreddit() {
    // Deliberately no local fallback here (this file avoids importing runtime
    // values from the symlinked app/ tree — see the top-of-file comment) — a
    // failed fetch just rejects, and the caller's own default (App.tsx's
    // useState(SUBREDDIT)) is what's shown if this never resolves.
    const res = await fetch('/api/results/subreddit');
    if (!res.ok) throw new Error('failed to fetch subreddit');
    const { subreddit } = await res.json();
    return subreddit;
  },
};

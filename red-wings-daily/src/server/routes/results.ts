import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';

export const results = new Hono();

// Daily-reset feature — keying by UTC date isolates each day's data automatically,
// and a short TTL keeps old days from accumulating in Redis forever.
function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
const RETENTION_SECONDS = 3 * 24 * 60 * 60;

type ScoreBody = { points: number; wins: number; losses: number; otl: number };
type AchievementBody = { achievement: 'Stanley Cup Champion' | 'Conference Champion' };
// Opaque to the server — this is the client's SavedRun shape (src/lib/platform.ts),
// stored and returned as-is so a returning player's screens can be rebuilt exactly
// as they left them instead of re-deriving them (the mid-season Trade Deadline is
// an interactive, RNG-consuming choice, so the result isn't reproducible from just
// a seed — the actual computed outcome has to be the thing we persist).
type SavedRunBody = unknown;

results.post('/score', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json({ status: 'error', message: 'no current user' }, 400);
  }
  const { points, wins, losses, otl } = await c.req.json<ScoreBody>();
  const date = utcDateString();
  const leaderboardKey = `leaderboard:${date}`;
  const recordsKey = `${leaderboardKey}:records`;

  await redis.zAdd(leaderboardKey, { member: username, score: points });
  await redis.hSet(recordsKey, { [username]: JSON.stringify({ points, wins, losses, otl }) });
  await redis.expire(leaderboardKey, RETENTION_SECONDS);
  await redis.expire(recordsKey, RETENTION_SECONDS);

  return c.json({ status: 'ok' });
});

results.post('/achievement', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json({ status: 'error', message: 'no current user' }, 400);
  }
  const { achievement } = await c.req.json<AchievementBody>();
  const key = `champions:${utcDateString()}`;

  await redis.hSet(key, { [username]: achievement });
  await redis.expire(key, RETENTION_SECONDS);

  return c.json({ status: 'ok' });
});

results.get('/leaderboard', async (c) => {
  const username = await reddit.getCurrentUsername();
  const date = utcDateString();
  const leaderboardKey = `leaderboard:${date}`;
  const recordsKey = `${leaderboardKey}:records`;

  const [entries, records] = await Promise.all([
    redis.zRange(leaderboardKey, 0, -1),
    redis.hGetAll(recordsKey),
  ]);

  // rankAmong() (src/lib/platform.ts) treats this list as "everyone but me" and
  // adds the current player back in itself — leaving our own entry in here would
  // double-count us and inflate "rank X of Y" (e.g. a lone player reading as 2 of 2).
  const leaderboard = entries
    .filter(({ member }) => member !== username)
    .map(({ member, score }) => {
      const raw = records[member];
      const record = raw ? JSON.parse(raw) : { points: score, wins: 0, losses: 0, otl: 0 };
      return { username: member, points: record.points, wins: record.wins, losses: record.losses, otl: record.otl };
    })
    .sort((a, b) => b.points - a.points);

  return c.json(leaderboard);
});

results.post('/today', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json({ status: 'error', message: 'no current user' }, 400);
  }
  const run = await c.req.json<SavedRunBody>();
  const key = `today:${utcDateString()}`;

  await redis.hSet(key, { [username]: JSON.stringify(run) });
  await redis.expire(key, RETENTION_SECONDS);

  return c.json({ status: 'ok' });
});

results.get('/today', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json({ status: 'error', message: 'no current user' }, 400);
  }
  const raw = await redis.hGet(`today:${utcDateString()}`, username);
  if (!raw) {
    return c.json({ status: 'error', message: 'not played yet' }, 404);
  }
  return c.json(JSON.parse(raw));
});

results.get('/champions', async (c) => {
  const all = await redis.hGetAll(`champions:${utcDateString()}`);
  const champions = Object.entries(all).map(([username, achievement]) => ({ username, achievement }));
  return c.json(champions);
});

// The actual subreddit this install is running in — a real Reddit install could
// be on any subreddit, not just the one hardcoded as this build's dev-time
// default in data/team.ts.
results.get('/subreddit', (c) => {
  return c.json({ subreddit: context.subredditName });
});

#!/usr/bin/env node
// Run any command as a given team's Devvit app:
//   node tools/with-team.mjs penguins vite build
//   node tools/with-team.mjs penguins devvit playtest
//   node tools/with-team.mjs penguins npm run deploy
// It sets TEAM=<team> (which vite.config.ts turns into the @team alias, the
// <title>s, and the server's post title) and, for the duration of the command,
// rewrites devvit.json's app name / dev subreddit from tools/teams.json so the
// Devvit CLI targets that team's app. devvit.json is restored afterwards, even
// on failure, so the committed file always stays the Red Wings one.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [team, ...cmd] = process.argv.slice(2);
const teams = JSON.parse(readFileSync(resolve(root, 'tools/teams.json'), 'utf8'));
if (!team || !teams[team] || cmd.length === 0) {
  console.error(`usage: node tools/with-team.mjs <${Object.keys(teams).filter((k) => !k.startsWith('_')).join('|')}> <command...>`);
  process.exit(2);
}
const { appName, devSubreddit } = teams[team];
const devvitJsonPath = resolve(root, 'devvit.json');
const original = readFileSync(devvitJsonPath, 'utf8');
const config = JSON.parse(original);
config.name = appName;
for (const item of config.menu?.items ?? []) if (item.description === config.menu.items[0].description) item.description = appName;
config.dev = { ...config.dev, subreddit: devSubreddit };
writeFileSync(devvitJsonPath, JSON.stringify(config, null, 2) + '\n');
let status = 1;
try {
  // Local binaries (vite, devvit) the way npm scripts see them.
  const PATH = `${resolve(root, 'node_modules/.bin')}:${process.env.PATH ?? ''}`;
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', cwd: root, env: { ...process.env, TEAM: team, PATH } });
  if (result.error) console.error(`with-team: could not run ${cmd[0]}: ${result.error.message}`);
  status = result.status ?? 1;
} finally {
  writeFileSync(devvitJsonPath, original);
}
process.exit(status);

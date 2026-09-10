# Red Wings Dynasty Draft

Spin six real seasons from a franchise's history, draft a starting six from those rosters, then watch a full 84-game season and playoff run simulate game by game. Live at **https://chlnglsh.github.io/red_wings_daily_draft/**.

Every team ships in two versions from the same code:

- **Standalone "Dynasty Draft"**: the web build above. Play as often as you like.
- **Reddit "Daily Draft"**: a Reddit-native app on Devvit for the team's subreddit, with one play per day, a daily leaderboard, and a Hall of Champions. In-season events roll once per day so the whole subreddit gets the same day.

The two differ only in platform wiring (leaderboard, daily lock, share text); the draft, the sim, and every screen are shared.

Every roster is real, hand-sourced data (top 4 LW / 4 C / 4 RW / 6 D / 2 G by games played), and every result is procedurally simulated, never scripted.

## How it's built

One shared engine, one repo, and one folder per team. The engine has no idea which team it is running; it reads everything team-specific through a single typed config.

```
src/
  lib/            game engine: spin weighting, ratings, game/season/postseason sim, trade market, GM/Coach roll
  components/     screens: draft rounds, front office, season sim, results, playoffs, recaps
  data/           league-wide real data (NHL alignment)
  teams/
    types.ts      TeamConfig, the contract every team folder satisfies
    current.ts    the ONE place the engine imports the selected team from
    registry.ts   build-time list of team identities (one line per team)
    redwings/     Detroit Red Wings: identity, colors, eras, 37 seasons, flavor copy, front-office pools, art, and its Detroit-only events
    devwest/      dev-only West-conference fixture (never deployed) that exercises the engine from the other conference
red-wings-daily/  the Reddit (Devvit) app for the Red Wings; its client mounts the same src/ tree via a symlink
```

A `TeamConfig` carries:

- **identity, colors, division/conference** (the player's roster replaces the real team's slot in the standings)
- **eras**: spin-weight buckets with their own weight and flavor rival pool, so a 1991-onward franchise can compress to two eras while Detroit keeps three
- **seasons and flavor copy**, **front-office pools** (GM/Coach, with a per-team recency cutoff and per-entry weight overrides)
- **assets**: slot-machine art and the three championship banners (team colors and division name are baked into the pixel art)
- **events**: team-specific in-season mechanics. Detroit registers March Collapse (a late-season skill game) and the octopus playoff flyby. A team without them leaves the slots empty and none of that code or art is bundled.
- **features**: shared mechanics any team can toggle (Trade Deadline, Postseason, Hockey Fight)

## Building a team

```bash
npm run dev                       # Red Wings (default)
TEAM=devwest npm run dev          # any other folder under src/teams/
npm run build                     # typecheck + production build
```

`TEAM` picks which `src/teams/<team>/` folder the `@team` alias resolves to, so only that team's data and art ship. The GitHub Pages deploy builds the Red Wings at the site root and every other team into `/<team>/` under the same URL (see `.github/workflows/deploy-pages.yml`). Each team's Reddit version is its own Devvit app and subreddit, built from the same team folder.

To add a team: copy `src/teams/redwings/` as a starting point, satisfy `TeamConfig` in its `index.ts`, add its identity to `src/teams/registry.ts`, and give it a `theme.css` and `public/` (favicon). The real cost is the season data: rosters are hand-sourced from each season's Wikipedia page, never generated.

## Regression rule

The live Red Wings build is frozen. Any engine change must leave a `TEAM=redwings` build behaviorally identical: same seeded spins, same simulated games, same postseason. The postseason and season simulators are fully deterministic from a run seed, which makes that checkable.

## Stack

React 19, TypeScript, Vite. No runtime dependencies beyond React. Lint with `npm run lint` (oxlint).

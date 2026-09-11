## Devvit React Starter

A starter to build web applications on Reddit's developer platform

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Hono](https://hono.dev/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=react`
2. Go through the installation wizard. You will need to create a Reddit account and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app

## One app per team

This folder is the Reddit (Devvit) version of the game for **every** team, built from the
shared game source in `../src` (symlinked at `src/client/app`). Each team is its own Devvit
app and subreddit; `tools/teams.json` lists them.

- Red Wings (default): `npm run build`, `npm run dev`, `npm run deploy` as before.
- Penguins: `npm run penguins:build`, `npm run penguins:dev`, `npm run penguins:deploy`.

The `penguins:*` scripts go through `tools/with-team.mjs`, which sets `TEAM=penguins` (team
data, art, titles, and the server's post title all follow from it) and swaps `devvit.json`'s
app name and dev subreddit for the duration of the command. The committed `devvit.json` is
always the Red Wings one. Adding a team = one line in `tools/teams.json` plus its scripts.

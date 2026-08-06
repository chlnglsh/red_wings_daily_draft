// Single source of truth for the team this build is skinned for. Porting to a
// different NHL team means: swap these, swap the CSS color variables in
// index.css, and redo the historical roster research in seasons.ts — that last
// one is the real cost, these constants are just wiring.
export const TEAM_CITY = 'Detroit';
export const TEAM_NAME = 'Red Wings';
export const TEAM_FULL_NAME = `${TEAM_CITY} ${TEAM_NAME}`;
export const SUBREDDIT = 'RedWings';

// Real Red Wings playoff folklore (fans throwing an octopus on the ice) — not a
// generic hockey tradition, so it shouldn't fire on a reskinned build unless that
// team has an equivalent of its own wired up to replace it. See OctopusFlyby.tsx
// and the trigger effect in PostseasonScreen.tsx, both gated on this.
export const HAS_OCTOPUS_TRADITION = true;

// Single source of truth for the team this build is skinned for. Porting to a
// different NHL team means: swap these, swap the CSS color variables in
// index.css, redo the historical roster research in seasons.ts (that last one is
// the real cost, these constants are just wiring), and turn off any capability
// flags below that are specific to this team.
export const TEAM_CITY = 'Detroit';
export const TEAM_NAME = 'Red Wings';
export const TEAM_FULL_NAME = `${TEAM_CITY} ${TEAM_NAME}`;
export const SUBREDDIT = 'RedWings';

// The Reddit build is a one-play-per-day contest, so it's a "Daily Draft". The
// standalone build has no daily lock (a refresh just replays), and it's really a
// build-your-all-time-roster game, so it's a "Dynasty Draft" instead. Gate on the
// same showsLeaderboard flag that separates the two builds everywhere else.
export const gameTitle = (showsLeaderboard: boolean) =>
  `${TEAM_NAME} ${showsLeaderboard ? 'Daily' : 'Dynasty'} Draft`;

// Real Red Wings playoff folklore (fans throwing an octopus on the ice) — not a
// generic hockey tradition, so it shouldn't fire on a reskinned build unless that
// team has an equivalent of its own wired up to replace it. See OctopusFlyby.tsx
// and the trigger effect in PostseasonScreen.tsx, both gated on this.
export const HAS_OCTOPUS_TRADITION = true;

// March Collapse: an in-season minigame event (a defensive-stand skill game that,
// if failed, drags win% down the stretch). The mechanic is team-agnostic, but it's
// intentionally a Red Wings-only feature — a reskinned build turns it off here and
// the season sim runs as if it never existed. See lib/marchCollapse.ts,
// MarchCollapseFlow.tsx, and the isCollapseDay gate in SeasonSimScreen.tsx.
export const HAS_MARCH_COLLAPSE = true;

// Trade Deadline: a mid-season interactive gate (swap a drafted player for a
// different season's version before the stretch run). Not team-specific folklore,
// but a pared-back or reskinned build can turn it off here — the season sim then
// runs as one continuous stretch with no gate, keeping the drafted roster. See the
// trade-stage machine in SeasonSimScreen.tsx.
export const HAS_TRADE_DEADLINE = true;

// Postseason: the playoff bracket that follows a qualifying regular season
// (seeding, series, shootout ceremony, Hall of Champions). Turn off for a
// regular-season-only build — the results screen becomes the final screen and the
// "Enter the Playoffs" gate never appears. See handleSimComplete in App.tsx (the
// postseason sim is skipped) and the gated blocks in ResultsScreen.tsx.
export const HAS_POSTSEASON = true;

// GM/Coach: a start-of-season modifier — once the draft is filled, roll a GM and a
// Coach from tiered pools of real franchise figures, each applying a flat season-long
// win% nudge. Team-specific (the pools are real Red Wings names), so a reskinned build
// turns it off here. See lib/gmCoach.ts and the roll wiring in SeasonSimScreen.tsx.
export const HAS_GM_COACH = true;

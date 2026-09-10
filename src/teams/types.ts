// The shape every team folder (src/teams/<team>/index.ts) exports. The engine only
// ever reads the selected team through `TEAM` in src/teams/current.ts — nothing in
// src/lib or src/components imports a team folder directly, so adding a team is
// purely additive: a new folder that satisfies this interface, plus its assets.
//
// What's team-specific vs. shared, in one place:
//   - identity / alignment / colors (theme.css) / seasons / flavor / front office /
//     assets: content, swapped wholesale per team.
//   - events: team-specific in-season mechanics (Detroit = March Collapse + the
//     octopus flyby). A team without them simply leaves the slot empty and the
//     engine never renders or bundles them.
//   - features: shared, team-agnostic mechanics (Trade Deadline, Postseason, Hockey
//     Fight) that any team can turn on or off. GM/Coach is on whenever a team
//     supplies a `frontOffice` block.
import type { ComponentType } from 'react';
import type { DraftPick, Season } from '../types';
import type { Conference, Division } from '../data/nhlAlignment';
import type { TeamIdentity } from './registry';

export type { TeamIdentity };

/** The player's roster replaces the real team's slot in this division/conference. */
export interface TeamAlignment {
  division: Division;
  conference: Conference;
}

// Spin-weight eras. Each era gets a fixed share of the spin (its weight, normalized
// against the other eras), split evenly among whichever seasons carry its id — so
// era-level odds stay stable no matter how the season pool grows. Three is a
// default, not a rule: a 1991-onward franchise might compress to two.
export interface TeamEra {
  /** Referenced by Season.era. */
  id: string;
  /** Human label, for docs/dev tooling. */
  label: string;
  weight: number;
  /** Flavor-only opponent names for the regular-season feed while the roster's
   *  majority era is this one — period-appropriate rivals, never the team itself.
   *  Purely cosmetic; never affects sim outcomes. */
  rivals: string[];
}

export interface TierCopy {
  label: string;
  flavor: string;
  emoji: string;
}

// Six quality tiers, from worst to best — shared by the roster-score "predicted
// standing" read and the real final-points-percentage read (see lib/tiers.ts).
export type TierId = 'rebuildYear' | 'bubbleTeam' | 'playoffPush' | 'contender' | 'cupContender' | 'dynasty';

// Every piece of team-flavored copy (jokes, tier labels, mock usernames) —
// everything EXCEPT actual game-result data, which is always procedurally generated.
export interface FlavorPack {
  /** Dev-only mock "other players" leaderboard usernames (lib/mockPlatform.ts).
   *  Never shown on the real Reddit build, but still worth reskinning so local
   *  dev actually feels like the team you're building for. */
  mockUsernames: string[];
  /** Tier label + flavor line + emoji, keyed by tier id. */
  tiers: Record<TierId, TierCopy>;
}

export type FrontOfficeTier = 'elite' | 'strong' | 'average' | 'weak' | 'rough';

// A GM or coach pool entry: tier drives the win% modifier, startYear drives the
// recency weight (2x from the team's cutoff year onward), summary is the one-line
// reveal blurb. `weight` overrides the recency rule outright for a named legend.
//
// Tone: every summary is strictly performance-based and light. Never reference
// off-ice conduct or personal controversy for any real figure, regardless of public record.
export interface FrontOfficeEntry {
  name: string;
  tier: FrontOfficeTier;
  startYear: number;
  summary: string;
  weight?: number;
}

export interface FrontOfficeConfig {
  gmPool: FrontOfficeEntry[];
  coachPool: FrontOfficeEntry[];
  /** Figures whose tenure started in this year or later roll 2x (the names players recognize). */
  recencyCutoffYear: number;
}

export interface TeamAssets {
  /** Intro-screen slot machine art. */
  slotMachine: string;
  /** Championship banners: the division name and team colors are baked into the
   *  pixel art, so every team draws its own three. */
  banners: {
    division: string;
    conference: string;
    stanleyCup: string;
  };
}

export interface LateSeasonEventFlowProps {
  /** The roster as of the pause point (post-trade), for event-specific context. */
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  /** Player opted out of flashing effects on the intro screen. */
  reduceFlashing: boolean;
  onResolved: (success: boolean) => void;
}

// A late-season pause point: the sim stops before `game`, the team's Flow plays
// out (a skill minigame, say), and the outcome shapes the remaining games via a
// win% modifier. Rolled per day on Reddit (everyone gets the same day) and per
// playthrough standalone. Detroit's is March Collapse.
export interface LateSeasonEvent {
  /** Display name for dev tooling, e.g. 'March Collapse'. */
  name: string;
  /** The sim pauses before this game number; the modifier applies from it onward. */
  game: number;
  /** Community (Reddit) cadence: same answer for everyone on a given day. */
  firesOnDay: (dateSeed: number) => boolean;
  /** Standalone cadence: fresh roll each playthrough. */
  firesOnPlay: (runSeed: number) => boolean;
  /** Per-game win% adjustment for the stretch after the event, or undefined for none. */
  modifierForOutcome: (success: boolean) => ((gameNumber: number) => number) | undefined;
  /** Shows the "Remove flashing effects" opt-out on the intro screen. */
  hasFlashingIntro: boolean;
  Flow: ComponentType<LateSeasonEventFlowProps>;
}

// An atmospheric overlay before Game 1 of Round 1 (flies left to right) and Game 1
// of the Stanley Cup Final (right to left). No effect on outcomes. Detroit's is the
// Legend of the Octopus.
export interface PlayoffFlybyEvent {
  Flyby: ComponentType<{ direction: 'ltr' | 'rtl'; onComplete: () => void }>;
}

/** Team-specific in-season event modules. Every slot is optional. */
export interface TeamEvents {
  lateSeason?: LateSeasonEvent;
  playoffFlyby?: PlayoffFlybyEvent;
}

/** Shared, team-agnostic mechanics any team can turn on or off. */
export interface TeamFeatures {
  /** Mid-season interactive gate: swap a drafted player for a different season's
   *  version before the stretch run. Off = one continuous sim with the drafted roster. */
  tradeDeadline: boolean;
  /** The playoff bracket after a qualifying regular season. Off = the results
   *  screen is the final screen and no bracket or standings are simulated. */
  postseason: boolean;
  /** Upside-only first-half minigame (WIP; dev buttons force it regardless). */
  hockeyFight: boolean;
}

export interface TeamConfig {
  /** Folder name under src/teams/, the TEAM env value, and the deploy subpath. */
  id: string;
  identity: TeamIdentity;
  alignment: TeamAlignment;
  eras: TeamEra[];
  seasons: Season[];
  flavor: FlavorPack;
  /** Present = GM/Coach is on for this team. */
  frontOffice?: FrontOfficeConfig;
  features: TeamFeatures;
  events: TeamEvents;
  assets: TeamAssets;
}

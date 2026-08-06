// Single swap point for every piece of hardcoded team-flavored copy (jokes, tier
// labels, mock usernames, flavor opponents) — everything EXCEPT actual game-result
// data, which is always procedurally generated and never needs reskinning.
//
// To reskin for a new team: write a new file matching FlavorPack (copy
// flavorText.generic.ts as a starting point, or flavorText.redwings.ts if you want
// real examples to riff on), then change the one import below to point at it.
// Nothing else in the app needs to change — every consumer imports FLAVOR from
// this file, never a team-specific file directly.
import { FLAVOR_TEXT_REDWINGS } from './flavorText.redwings';

export interface TierCopy {
  label: string;
  flavor: string;
  emoji: string;
}

// Six quality tiers, from worst to best — shared by the roster-score "predicted
// standing" read and the real final-points-percentage read (see lib/tiers.ts).
export type TierId = 'rebuildYear' | 'bubbleTeam' | 'playoffPush' | 'contender' | 'cupContender' | 'dynasty';

export interface FlavorPack {
  /** Dev-only mock "other players" leaderboard usernames (lib/mockPlatform.ts).
   *  Never shown on the real Reddit build, but still worth reskinning so local
   *  dev actually feels like the team you're building for. */
  mockUsernames: string[];
  /** Tier label + flavor line + emoji, keyed by tier id. */
  tiers: Record<TierId, TierCopy>;
  /** Flavor-only opponent name pools for the regular-season game feed (lib/gameSim.ts)
   *  — purely cosmetic, never affects sim outcomes. If your own team appears in
   *  either list (e.g. a Penguins build inheriting the Red Wings' modern-rivals
   *  pool), remove it — otherwise the feed can show you playing yourself. */
  rivalPools: {
    originalSix: string[];
    modern: string[];
  };
}

export const FLAVOR: FlavorPack = FLAVOR_TEXT_REDWINGS;

// Detroit's registered team events. Both are Red Wings folklore, never reskinned:
// a new team leaves these slots empty (see TeamEvents in src/teams/types.ts), and
// none of this code or art is bundled for it.
import type { TeamEvents } from '../../types';
import { MarchCollapseEvent } from './MarchCollapseFlow';
import { OctopusFlyby } from './OctopusFlyby';
import { MARCH_COLLAPSE_GAME, isMarchCollapseDay, isMarchCollapsePlay, buildCollapsePenaltyModifier } from './marchCollapse';

export const REDWINGS_EVENTS: TeamEvents = {
  // March Collapse: a defensive-stand skill game late in the regular season that,
  // if failed, drags win% down the stretch. See ./marchCollapse.ts.
  lateSeason: {
    name: 'March Collapse',
    game: MARCH_COLLAPSE_GAME,
    firesOnDay: isMarchCollapseDay,
    firesOnPlay: isMarchCollapsePlay,
    modifierForOutcome: (success) => (success ? undefined : buildCollapsePenaltyModifier(MARCH_COLLAPSE_GAME)),
    hasFlashingIntro: true,
    Flow: MarchCollapseEvent,
  },
  // Legend of the Octopus: real playoff folklore (fans throwing an octopus on the
  // ice). Purely atmospheric. See ./OctopusFlyby.tsx.
  playoffFlyby: { Flyby: OctopusFlyby },
};

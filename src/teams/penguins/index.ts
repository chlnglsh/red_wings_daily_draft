// Pittsburgh Penguins. Built on the Phase 0 team contract (src/teams/types.ts);
// every decision here is from the Penguins spec locked 2026-09-10.
//
// STATUS: scaffold. Seasons are empty until real, approved rosters land in
// ./seasons.ts (defineTeam refuses to boot without one). The three banners are
// real Penguins art; the slot machine is still Detroit's as an explicit PLACEHOLDER,
// and there is no favicon yet. Not in the deploy list.
import { defineTeam } from '../defineTeam';
import { TEAM_IDENTITIES } from '../registry';
import { SEASONS } from './seasons';
import { FLAVOR_TEXT_PENGUINS, EXPANSION_ERA_RIVALS, LEMIEUX_ERA_RIVALS, CROSBY_ERA_RIVALS } from './flavor';
import { FRONT_OFFICE } from './frontOffice';
// PLACEHOLDER ART (Detroit's slot machine) — replace with ./assets/ once drawn.
import slotMachine from '../redwings/assets/lucky-red-slot-machine.png';
// Penguins banners (user art, 2026-09-10): split from one sheet, chroma-keyed to
// transparent, and upscaled 2x nearest-neighbour to sit at Detroit's banner height.
import divisionBanner from './assets/division-champions-banner.png';
import conferenceBanner from './assets/conference-champions-banner.png';
import stanleyCupBanner from './assets/stanleycup-champions-banner.png';
import './theme.css';

export const TEAM = defineTeam({
  id: 'penguins',
  identity: TEAM_IDENTITIES.penguins,
  // The real Penguins' Metropolitan slot is replaced by the player's simulated roster.
  alignment: { division: 'Metropolitan', conference: 'East' },
  // Era-level spin shares (0.6 / 1.2 / 1.8 normalize to about 17% / 33% / 50%).
  // The early era is 8 chosen living-memory seasons, not 3 pre-history ones like
  // Detroit's, so it gets 0.6 rather than 0.4.
  eras: [
    { id: 'expansion', label: 'Expansion era (1967-84)', weight: 0.6, rivals: EXPANSION_ERA_RIVALS },
    { id: 'lemieux', label: 'Lemieux era (1984-2004)', weight: 1.2, rivals: LEMIEUX_ERA_RIVALS },
    { id: 'crosby', label: 'Crosby era (2005-)', weight: 1.8, rivals: CROSBY_ERA_RIVALS },
  ],
  seasons: SEASONS,
  flavor: FLAVOR_TEXT_PENGUINS,
  frontOffice: FRONT_OFFICE,
  features: {
    tradeDeadline: true,
    postseason: true,
    hockeyFight: false, // team-agnostic WIP; follows the global default once it ships
  },
  // No team events: March Collapse and the octopus are Detroit-only, always.
  events: {},
  assets: {
    slotMachine,
    banners: { division: divisionBanner, conference: conferenceBanner, stanleyCup: stanleyCupBanner },
  },
});

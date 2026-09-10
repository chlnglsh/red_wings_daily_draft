// Detroit Red Wings — the team this game was first built for, and the one at the
// root of the live URL. Everything Detroit-specific lives in this folder; the
// engine reads it only through src/teams/current.ts.
import { defineTeam } from '../defineTeam';
import { TEAM_IDENTITIES } from '../registry';
import { SEASONS } from './seasons';
import { FLAVOR_TEXT_REDWINGS, ORIGINAL_SIX_RIVALS, MODERN_RIVALS } from './flavor';
import { FRONT_OFFICE } from './frontOffice';
import { REDWINGS_EVENTS } from './events';
import slotMachine from './assets/lucky-red-slot-machine.png';
import divisionBanner from './assets/division-champions-banner.png';
import conferenceBanner from './assets/conference-champions-banner.png';
import stanleyCupBanner from './assets/stanleycup-champions-banner.png';
import './theme.css';

export const TEAM = defineTeam({
  id: 'redwings',
  identity: TEAM_IDENTITIES.redwings,
  // The real Red Wings' Atlantic slot is replaced by the player's simulated roster.
  alignment: { division: 'Atlantic', conference: 'East' },
  // Spin weighting: recent (Yzerman-onward) seasons come up most often, Original
  // Six-through-pre-Yzerman is baseline, pre-Howe is rare texture. These are
  // era-level shares (normalize to ~11.8% / 35.3% / 52.9%).
  eras: [
    { id: 'preHowe', label: 'Pre-Howe (1930s-40s)', weight: 0.4, rivals: ORIGINAL_SIX_RIVALS },
    { id: 'howeToPreYzerman', label: 'Howe to pre-Yzerman (1949-83)', weight: 1.2, rivals: ORIGINAL_SIX_RIVALS },
    { id: 'yzermanOnward', label: 'Yzerman onward (1983-)', weight: 1.8, rivals: MODERN_RIVALS },
  ],
  seasons: SEASONS,
  flavor: FLAVOR_TEXT_REDWINGS,
  frontOffice: FRONT_OFFICE,
  features: {
    tradeDeadline: true,
    postseason: true,
    // Hockey Fight is WORK IN PROGRESS — kept off so the half-built feature stays
    // dormant in the shipping build. Flip to true to work on it live, or use the
    // dev "Force Hockey Fight" buttons, which bypass this flag.
    hockeyFight: false,
  },
  events: REDWINGS_EVENTS,
  assets: {
    slotMachine,
    banners: { division: divisionBanner, conference: conferenceBanner, stanleyCup: stanleyCupBanner },
  },
});

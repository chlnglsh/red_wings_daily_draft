// DEV FIXTURE, NEVER DEPLOYED: a Western Conference team (Sharks-shaped: Pacific /
// West, no front office, no team events) laid over the Red Wings' season data and
// art. It exists to exercise the engine's conference/division generalization —
// standings, seeding labels, bracket, results copy — from the other side of the
// league before a real West team lands. Run it with `TEAM=devwest npm run dev`.
// Rosters and labels still say Red Wings; that's expected.
import { defineTeam } from '../defineTeam';
import { TEAM_IDENTITIES } from '../registry';
import { SEASONS } from '../redwings/seasons';
import { FLAVOR_TEXT_GENERIC, GENERIC_MODERN_RIVALS, GENERIC_ORIGINAL_SIX_RIVALS } from '../flavor.generic';
import slotMachine from '../redwings/assets/lucky-red-slot-machine.png';
import divisionBanner from '../redwings/assets/division-champions-banner.png';
import conferenceBanner from '../redwings/assets/conference-champions-banner.png';
import stanleyCupBanner from '../redwings/assets/stanleycup-champions-banner.png';
import '../redwings/theme.css';

const notUs = (rivals: string[]) => rivals.filter((r) => r !== 'San Jose Sharks');

export const TEAM = defineTeam({
  id: 'devwest',
  identity: TEAM_IDENTITIES.devwest,
  alignment: { division: 'Pacific', conference: 'West' },
  eras: [
    { id: 'preHowe', label: 'fixture era 1', weight: 0.4, rivals: notUs(GENERIC_ORIGINAL_SIX_RIVALS) },
    { id: 'howeToPreYzerman', label: 'fixture era 2', weight: 1.2, rivals: notUs(GENERIC_ORIGINAL_SIX_RIVALS) },
    { id: 'yzermanOnward', label: 'fixture era 3', weight: 1.8, rivals: notUs(GENERIC_MODERN_RIVALS) },
  ],
  seasons: SEASONS,
  flavor: FLAVOR_TEXT_GENERIC,
  features: { tradeDeadline: true, postseason: true, hockeyFight: false },
  events: {},
  assets: {
    slotMachine,
    banners: { division: divisionBanner, conference: conferenceBanner, stanleyCup: stanleyCupBanner },
  },
});

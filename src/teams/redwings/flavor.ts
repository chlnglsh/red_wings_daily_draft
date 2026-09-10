// Red Wings flavor pack. See src/teams/types.ts (FlavorPack) for what each field
// drives, and src/teams/flavor.generic.ts for a team-agnostic starting point.
import type { FlavorPack } from '../types';

export const FLAVOR_TEXT_REDWINGS: FlavorPack = {
  mockUsernames: [
    'zetterberg_stan', 'HockeytownHermit', 'wings_since_97', 'OctopusThrower',
    'yzerman_captain', 'lidstrom_perfect', 'GordieHoweHatTrick', 'winged_wheel_fan',
    'joelouisghost', 'PavelD13', 'RedWingsOrBust', 'ShanahanShot', 'sawchuk_stonewall',
    'DetroitDraftDodger', 'no_cup_since_08', 'FedorovFlyer', 'ProbertPunches',
    'KozlovKid', 'ChelsGreat', 'LCArenaRegular', 'AbelAndKelly', 'BigCityHockey',
    'grindline4life', 'DelvecchioDeke', 'MotorCityMiracle',
  ],

  tiers: {
    rebuildYear: { label: 'Rebuild Year', flavor: "This one's going in the record books for the wrong reasons.", emoji: '🛠️' },
    bubbleTeam: { label: 'Bubble Team', flavor: 'Scrapping for a wild card spot every night.', emoji: '⚖️' },
    playoffPush: { label: 'Playoff Push', flavor: 'In the mix down the stretch.', emoji: '📈' },
    contender: { label: 'Contender', flavor: 'A legitimate threat come April.', emoji: '🔥' },
    cupContender: { label: 'Cup Contender', flavor: 'One hot goalie away from a parade.', emoji: '🏆' },
    dynasty: { label: 'Dynasty', flavor: 'Hockeytown special. Hang another banner.', emoji: '👑' },
  },
};

// Flavor-only opponent pools for the regular-season game feed, one per era so old
// seasons face period-appropriate rivals instead of expansion teams that didn't
// exist yet (wired to the eras in ./index.ts). Purely cosmetic, never affects sim
// outcomes. The Red Wings themselves must never appear in either list.
export const ORIGINAL_SIX_RIVALS = ['Toronto Maple Leafs', 'Montreal Canadiens', 'Boston Bruins', 'Chicago Black Hawks', 'New York Rangers'];
export const MODERN_RIVALS = [
  'Toronto Maple Leafs', 'Chicago Blackhawks', 'Boston Bruins', 'Pittsburgh Penguins',
  'Colorado Avalanche', 'Tampa Bay Lightning', 'Edmonton Oilers', 'New York Rangers',
  'Nashville Predators', 'Carolina Hurricanes', 'Vegas Golden Knights', 'Dallas Stars',
  'Florida Panthers', 'Los Angeles Kings', 'St. Louis Blues', 'Minnesota Wild',
  'Winnipeg Jets', 'New Jersey Devils', 'Washington Capitals', 'Vancouver Canucks',
];

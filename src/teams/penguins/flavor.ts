// Penguins flavor pack. See src/teams/types.ts (FlavorPack) for what each field
// drives. Player-facing copy: no em-dashes or symbols, watch for widows.
import type { FlavorPack } from '../types';

export const FLAVOR_TEXT_PENGUINS: FlavorPack = {
  mockUsernames: [
    'sid_the_kid_87', 'geno_71', 'IglooIrregular', 'lemieux_66_forever',
    'jagr_mullet_fan', 'flower_29', 'steel_city_skater', 'yinzer_on_ice',
    'letang_58', 'BadgerBobBeliever', 'civic_arena_ghost', 'PensPuckPusher',
    'bylsma_era_kid', 'MarioAndMe', 'FrancisAndCo', 'coffey_carries',
    'kunitz_double_ot', 'HBK_line', 'backtoback_16_17', 'PPGpaints_regular',
    'ronny_franchise', 'tocchet_terror', 'malkin_mode', 'PittsburghGoldRush',
    'penguin_parade_09',
  ],

  tiers: {
    rebuildYear: { label: 'Rebuild Year', flavor: "This one's going in the record books for the wrong reasons.", emoji: '🛠️' },
    bubbleTeam: { label: 'Bubble Team', flavor: 'Scrapping for a wild card spot every night.', emoji: '⚖️' },
    playoffPush: { label: 'Playoff Push', flavor: 'In the mix down the stretch.', emoji: '📈' },
    contender: { label: 'Contender', flavor: 'A legitimate threat come April.', emoji: '🔥' },
    cupContender: { label: 'Cup Contender', flavor: 'One hot goalie away from a parade down the Boulevard of the Allies.', emoji: '🏆' },
    dynasty: { label: 'Dynasty', flavor: 'Pittsburgh gold standard. Hang another banner.', emoji: '👑' },
  },
};

// Flavor-only opponent pools for the regular-season game feed, one per era so old
// seasons face period-appropriate opponents (wired to the eras in ./index.ts).
// Purely cosmetic, never affects sim outcomes. The Penguins must never appear here.
// 1967-84: the expansion West Division and 70s/early-80s regulars.
export const EXPANSION_ERA_RIVALS = [
  'Philadelphia Flyers', 'St. Louis Blues', 'Minnesota North Stars', 'Los Angeles Kings',
  'California Golden Seals', 'New York Islanders', 'New York Rangers', 'Boston Bruins',
  'Buffalo Sabres', 'Washington Capitals', 'Toronto Maple Leafs', 'Montreal Canadiens',
];
// 1984-2004: Patrick Division and its Northeast/Atlantic successors.
export const LEMIEUX_ERA_RIVALS = [
  'Philadelphia Flyers', 'Washington Capitals', 'New York Rangers', 'New York Islanders',
  'New Jersey Devils', 'Boston Bruins', 'Montreal Canadiens', 'Hartford Whalers',
  'Buffalo Sabres', 'Quebec Nordiques', 'Florida Panthers', 'Ottawa Senators',
];
// 2005-: Metropolitan foes plus the East's regular playoff opponents.
export const CROSBY_ERA_RIVALS = [
  'Philadelphia Flyers', 'Washington Capitals', 'New York Rangers', 'New York Islanders',
  'New Jersey Devils', 'Columbus Blue Jackets', 'Carolina Hurricanes', 'Boston Bruins',
  'Tampa Bay Lightning', 'Florida Panthers', 'Detroit Red Wings', 'Toronto Maple Leafs',
  'Montreal Canadiens', 'Buffalo Sabres', 'Ottawa Senators', 'Nashville Predators',
  'San Jose Sharks', 'Vegas Golden Knights', 'Chicago Blackhawks', 'Colorado Avalanche',
];

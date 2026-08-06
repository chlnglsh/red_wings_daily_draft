// Team-agnostic starting point for a reskin. Nothing in here references any real
// team, city, or nickname — copy this file to flavorText.<team>.ts, rename the
// export, customize freely (the rivalPools especially — pick real rivals for
// your team, and make sure your own team isn't in either list), then point
// flavorText.ts's import at your new file.
import type { FlavorPack } from './flavorText';

export const FLAVOR_TEXT_GENERIC: FlavorPack = {
  mockUsernames: [
    'puck_drop_pro', 'third_period_hero', 'zamboni_driver', 'hattrick_hunter',
    'benchwarmer_99', 'slapshot_sam', 'ice_king_23', 'powerplay_pete',
    'goalie_greatness', 'blueline_bandit', 'crossbar_clank', 'overtime_owner',
    'faceoff_fanatic', 'rink_rat_ryan', 'deke_master', 'penalty_box_pete',
    'top_shelf_tommy', 'breakaway_bri', 'cup_dreamer', 'five_hole_frank',
    'assist_king', 'checkline_chris', 'power_forward_pat', 'wristshot_walt',
  ],

  tiers: {
    rebuildYear: { label: 'Rebuild Year', flavor: "This one's going in the record books for the wrong reasons.", emoji: '🛠️' },
    bubbleTeam: { label: 'Bubble Team', flavor: 'Scrapping for a wild card spot every night.', emoji: '⚖️' },
    playoffPush: { label: 'Playoff Push', flavor: 'In the mix down the stretch.', emoji: '📈' },
    contender: { label: 'Contender', flavor: 'A legitimate threat come April.', emoji: '🔥' },
    cupContender: { label: 'Cup Contender', flavor: 'One hot goalie away from a parade.', emoji: '🏆' },
    dynasty: { label: 'Dynasty', flavor: 'The whole league saw this one coming. Hang another banner.', emoji: '👑' },
  },

  // Placeholder pools — swap for real rivals of whichever team you're building.
  // Remove your own team if it shows up here (it won't, in this generic set).
  rivalPools: {
    originalSix: ['Toronto Maple Leafs', 'Montreal Canadiens', 'Boston Bruins', 'Chicago Blackhawks', 'New York Rangers'],
    modern: [
      'Toronto Maple Leafs', 'Chicago Blackhawks', 'Boston Bruins', 'Pittsburgh Penguins',
      'Colorado Avalanche', 'Tampa Bay Lightning', 'Edmonton Oilers', 'New York Rangers',
      'Nashville Predators', 'Carolina Hurricanes', 'Vegas Golden Knights', 'Dallas Stars',
      'Florida Panthers', 'Los Angeles Kings', 'St. Louis Blues', 'Minnesota Wild',
      'Winnipeg Jets', 'New Jersey Devils', 'Washington Capitals', 'Vancouver Canucks',
    ],
  },
};

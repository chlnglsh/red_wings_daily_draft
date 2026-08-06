// Real current NHL division/conference alignment. The Red Wings' own slot in the
// Atlantic Division is replaced by the player's simulated roster — see postseason.ts.

export type Conference = 'East' | 'West';
export type Division = 'Atlantic' | 'Metropolitan' | 'Central' | 'Pacific';

export interface LeagueTeam {
  name: string;
  division: Division;
  // Placeholder daily point-total sampling range — TBD real research (min/max actual
  // standings points per team over the last 10 NHL seasons, per the postseason spec).
  // Flat range for every team for now so no team is arbitrarily favored until that
  // research pass happens.
  pointsRange: [number, number];
}

const PLACEHOLDER_RANGE: [number, number] = [75, 112];

export const DIVISIONS: Record<Division, Conference> = {
  Atlantic: 'East',
  Metropolitan: 'East',
  Central: 'West',
  Pacific: 'West',
};

// The real Red Wings are intentionally omitted — the player's simulated roster
// occupies that Atlantic Division slot instead.
export const LEAGUE_TEAMS: LeagueTeam[] = [
  // Atlantic (Red Wings replaced by the player)
  { name: 'Boston Bruins', division: 'Atlantic', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Buffalo Sabres', division: 'Atlantic', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Florida Panthers', division: 'Atlantic', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Montreal Canadiens', division: 'Atlantic', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Ottawa Senators', division: 'Atlantic', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Tampa Bay Lightning', division: 'Atlantic', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Toronto Maple Leafs', division: 'Atlantic', pointsRange: PLACEHOLDER_RANGE },

  // Metropolitan
  { name: 'Carolina Hurricanes', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Columbus Blue Jackets', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },
  { name: 'New Jersey Devils', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },
  { name: 'New York Islanders', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },
  { name: 'New York Rangers', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Philadelphia Flyers', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Pittsburgh Penguins', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Washington Capitals', division: 'Metropolitan', pointsRange: PLACEHOLDER_RANGE },

  // Central
  { name: 'Chicago Blackhawks', division: 'Central', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Colorado Avalanche', division: 'Central', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Dallas Stars', division: 'Central', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Minnesota Wild', division: 'Central', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Nashville Predators', division: 'Central', pointsRange: PLACEHOLDER_RANGE },
  { name: 'St. Louis Blues', division: 'Central', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Utah Mammoth', division: 'Central', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Winnipeg Jets', division: 'Central', pointsRange: PLACEHOLDER_RANGE },

  // Pacific
  { name: 'Anaheim Ducks', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Calgary Flames', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Edmonton Oilers', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Los Angeles Kings', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
  { name: 'San Jose Sharks', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Seattle Kraken', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Vancouver Canucks', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
  { name: 'Vegas Golden Knights', division: 'Pacific', pointsRange: PLACEHOLDER_RANGE },
];

// Full "City Mascot" -> mascot-only, for spots that want to match how TEAM_NAME
// is shown for the player's own side (just "Red Wings", never "Detroit Red Wings").
// Can't derive this by splitting on the first word — cities and mascots are each
// sometimes one word, sometimes two ("St. Louis Blues", "Vegas Golden Knights"),
// so it's a real lookup, not a heuristic. Covers every name in LEAGUE_TEAMS plus
// the historical "Chicago Black Hawks" spelling used for Original Six-era games.
const MASCOT_ONLY: Record<string, string> = {
  'Boston Bruins': 'Bruins',
  'Buffalo Sabres': 'Sabres',
  'Florida Panthers': 'Panthers',
  'Montreal Canadiens': 'Canadiens',
  'Ottawa Senators': 'Senators',
  'Tampa Bay Lightning': 'Lightning',
  'Toronto Maple Leafs': 'Maple Leafs',
  'Carolina Hurricanes': 'Hurricanes',
  'Columbus Blue Jackets': 'Blue Jackets',
  'New Jersey Devils': 'Devils',
  'New York Islanders': 'Islanders',
  'New York Rangers': 'Rangers',
  'Philadelphia Flyers': 'Flyers',
  'Pittsburgh Penguins': 'Penguins',
  'Washington Capitals': 'Capitals',
  'Chicago Blackhawks': 'Blackhawks',
  'Chicago Black Hawks': 'Black Hawks',
  'Colorado Avalanche': 'Avalanche',
  'Dallas Stars': 'Stars',
  'Minnesota Wild': 'Wild',
  'Nashville Predators': 'Predators',
  'St. Louis Blues': 'Blues',
  'Utah Mammoth': 'Mammoth',
  'Winnipeg Jets': 'Jets',
  'Anaheim Ducks': 'Ducks',
  'Calgary Flames': 'Flames',
  'Edmonton Oilers': 'Oilers',
  'Los Angeles Kings': 'Kings',
  'San Jose Sharks': 'Sharks',
  'Seattle Kraken': 'Kraken',
  'Vancouver Canucks': 'Canucks',
  'Vegas Golden Knights': 'Golden Knights',
};

/** Drops the city from a full team name ("Chicago Blackhawks" -> "Blackhawks").
 *  Falls back to the input unchanged for anything not in the lookup. */
export function mascotOnly(fullTeamName: string): string {
  return MASCOT_ONLY[fullTeamName] ?? fullTeamName;
}

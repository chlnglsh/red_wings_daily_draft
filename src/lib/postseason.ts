// Postseason simulator. Builds on the regular-season engine (gameSim.ts) — see the
// postseason spec. The player's roster occupies the real Red Wings' slot in the
// Atlantic standings; everything else in the league gets a point total sampled from
// a placeholder range (see nhlAlignment.ts) deterministically off the day's runSeed.
//
// The whole bracket — both conferences, every round — is always fully simulated,
// whether or not the player qualifies. The West conference is simulated purely to
// produce a legitimate Stanley Cup Final opponent; the player never sees its games,
// only the eventual champion's name (see spec: "player never sees Western Conference
// progress"). Series the player isn't part of use a lightweight win/loss-only sim
// (deriveOpponentWinPct), not the full goal-by-goal engine.

import { mulberry32, hashStringToInt } from './prng';
import { DIVISIONS, LEAGUE_TEAMS, type Conference, type Division } from '../data/nhlAlignment';
import { deriveOpponentWinPct, simulateGame, buildScorerPicker, type GameResult, type WeightedSkater } from './gameSim';
import { TEAM_FULL_NAME } from '../data/team';

export interface TeamStanding {
  name: string;
  division: Division;
  conference: Conference;
  points: number;
  isPlayer: boolean;
}

export interface SeedEntry {
  label: string; // "A1", "M3", "WC2", etc — display only
  team: TeamStanding;
}

export type Round = 1 | 2 | 3 | 4;

export interface Series {
  id: string;
  round: Round;
  conference: Conference | null; // null for the Stanley Cup Final
  home: SeedEntry; // higher seed — gets home-ice advantage (games 1,2,5,7)
  away: SeedEntry;
  homeWins: number;
  awayWins: number;
  winner: SeedEntry | null;
  isPlayerSeries: boolean;
  games: GameResult[]; // populated only when isPlayerSeries — background series don't need play-by-play
}

interface ConferenceBracket {
  conference: Conference;
  divATop: Series; // divA's #1 seed vs its assigned wild card
  divABottom: Series; // divA's #2 vs #3
  divBTop: Series;
  divBBottom: Series;
  divAFinal: Series | null; // winner(divATop) vs winner(divABottom) — Round 2
  divBFinal: Series | null;
  confFinal: Series | null; // Round 3 — conference champion
  champion: SeedEntry | null;
}

export interface PostseasonResult {
  qualified: boolean;
  playerSeedLabel: string | null;
  atlanticStandings: TeamStanding[]; // sorted by points, for the qualification/standings display
  eastStandings: TeamStanding[]; // both East divisions combined, sorted by points
  eastBracket: ConferenceBracket;
  westBracket: ConferenceBracket;
  finalSeries: Series;
  cupChampion: SeedEntry;
  playerEliminatedRound: Round | null; // null if never qualified, or if they won the Cup
  eliminatedBy: SeedEntry | null; // the team that beat them, if eliminated before round 4
  playerWonCup: boolean;
  playerWonConference: boolean;
}

const DIVISION_PAIRS: Record<Conference, [Division, Division]> = {
  East: ['Atlantic', 'Metropolitan'],
  West: ['Central', 'Pacific'],
};

function sampleLeagueStandings(runSeed: number, playerPoints: number): TeamStanding[] {
  const rng = mulberry32(hashStringToInt(`${runSeed}:postseason:standings`));
  const standings: TeamStanding[] = LEAGUE_TEAMS.map((t) => {
    const [min, max] = t.pointsRange;
    return {
      name: t.name,
      division: t.division,
      conference: DIVISIONS[t.division],
      points: Math.round(min + rng() * (max - min)),
      isPlayer: false,
    };
  });
  standings.push({
    name: TEAM_FULL_NAME,
    division: 'Atlantic',
    conference: 'East',
    points: playerPoints,
    isPlayer: true,
  });
  return standings;
}

/** Top 3 per division + 2 wild cards, seeded per real NHL divisional format. */
function seedConference(standings: TeamStanding[], conference: Conference): {
  divATop3: TeamStanding[];
  divBTop3: TeamStanding[];
  wc1: TeamStanding;
  wc2: TeamStanding;
} {
  const [divA, divB] = DIVISION_PAIRS[conference];
  const divATeams = standings.filter((t) => t.division === divA).sort((a, b) => b.points - a.points);
  const divBTeams = standings.filter((t) => t.division === divB).sort((a, b) => b.points - a.points);
  const divATop3 = divATeams.slice(0, 3);
  const divBTop3 = divBTeams.slice(0, 3);
  const wildcardPool = [...divATeams.slice(3), ...divBTeams.slice(3)].sort((a, b) => b.points - a.points);
  return { divATop3, divBTop3, wc1: wildcardPool[0], wc2: wildcardPool[1] };
}

function buildConferenceR1(standings: TeamStanding[], conference: Conference): {
  divATop: Series;
  divABottom: Series;
  divBTop: Series;
  divBBottom: Series;
} {
  const [divA, divB] = DIVISION_PAIRS[conference];
  const { divATop3, divBTop3, wc1, wc2 } = seedConference(standings, conference);
  const divAWinner = divATop3[0];
  const divBWinner = divBTop3[0];

  // Protect the stronger division winner with the weaker wild card.
  const strongerWinner = [divAWinner, divBWinner].sort((a, b) => b.points - a.points)[0];
  const strongerOpponent = wc2; // weaker wild card
  const weakerOpponent = wc1; // stronger wild card
  const divAWinnerOpponent = divAWinner === strongerWinner ? strongerOpponent : weakerOpponent;
  const divBWinnerOpponent = divBWinner === strongerWinner ? strongerOpponent : weakerOpponent;

  const label = (team: TeamStanding, seed: number) => {
    const prefix = team.division === 'Atlantic' ? 'A' : team.division === 'Metropolitan' ? 'M' : team.division === 'Central' ? 'C' : 'P';
    return `${prefix}${seed}`;
  };

  const seedIndex = (team: TeamStanding, top3: TeamStanding[]) => top3.indexOf(team) + 1;

  const mkSeries = (id: string, home: TeamStanding, homeLabel: string, away: TeamStanding, awayLabel: string): Series => ({
    id,
    round: 1,
    conference,
    home: { label: homeLabel, team: home },
    away: { label: awayLabel, team: away },
    homeWins: 0,
    awayWins: 0,
    winner: null,
    isPlayerSeries: home.isPlayer || away.isPlayer,
    games: [],
  });

  return {
    divATop: mkSeries(`${conference}-R1-${divA}-top`, divAWinner, label(divAWinner, 1), divAWinnerOpponent, 'WC'),
    divABottom: mkSeries(
      `${conference}-R1-${divA}-bottom`,
      divATop3[1],
      label(divATop3[1], seedIndex(divATop3[1], divATop3)),
      divATop3[2],
      label(divATop3[2], seedIndex(divATop3[2], divATop3)),
    ),
    divBTop: mkSeries(`${conference}-R1-${divB}-top`, divBWinner, label(divBWinner, 1), divBWinnerOpponent, 'WC'),
    divBBottom: mkSeries(
      `${conference}-R1-${divB}-bottom`,
      divBTop3[1],
      label(divBTop3[1], seedIndex(divBTop3[1], divBTop3)),
      divBTop3[2],
      label(divBTop3[2], seedIndex(divBTop3[2], divBTop3)),
    ),
  };
}

/** Lightweight win/loss-only sim for series the player isn't part of. */
function simulateBackgroundSeries(series: Series, rng: () => number): Series {
  let homeWins = 0;
  let awayWins = 0;
  const winPct = deriveOpponentWinPct(series.home.team.points, series.away.team.points);
  while (homeWins < 4 && awayWins < 4) {
    if (rng() < winPct) homeWins++;
    else awayWins++;
  }
  const winner = homeWins === 4 ? series.home : series.away;
  return { ...series, homeWins, awayWins, winner };
}

/** Real 2-2-1-1-1 pattern — the home (higher) seed hosts games 1, 2, 5 and 7. */
function isHomeGame(gameNumber: number): boolean {
  return gameNumber === 1 || gameNumber === 2 || gameNumber === 5 || gameNumber === 7;
}

/** Full goal-by-goal sim for the player's own series, reusing the regular-season engine. */
function simulatePlayerSeries(
  series: Series,
  rng: () => number,
  playerPoints: number,
  playerSkaters: WeightedSkater[],
): Series {
  const playerIsHome = series.home.team.isPlayer;
  const opponent = playerIsHome ? series.away.team : series.home.team;
  const winPct = deriveOpponentWinPct(playerPoints, opponent.points);
  const pickScorer = buildScorerPicker(playerSkaters, rng);

  const games: GameResult[] = [];
  let homeWins = 0;
  let awayWins = 0;
  let gameNumber = 1;
  while (homeWins < 4 && awayWins < 4) {
    const homeIceThisGame = isHomeGame(gameNumber);
    // "home" in the GameResult sense means "the player's team is at home tonight" —
    // only meaningful (and only ever displayed) for the player's own games.
    const playerAtHome = playerIsHome ? homeIceThisGame : !homeIceThisGame;
    const game = simulateGame({
      rng,
      gameNumber,
      winPct,
      opponent: opponent.name,
      home: playerAtHome,
      pickScorer,
    });
    games.push(game);
    const playerWonGame = game.result === 'W';
    if (playerIsHome === playerWonGame) homeWins++;
    else awayWins++;
    gameNumber++;
  }
  const winner = homeWins === 4 ? series.home : series.away;
  return { ...series, homeWins, awayWins, winner, games };
}

function resolveSeries(
  series: Series,
  rng: () => number,
  playerPoints: number,
  playerSkaters: WeightedSkater[],
): Series {
  return series.isPlayerSeries
    ? simulatePlayerSeries(series, rng, playerPoints, playerSkaters)
    : simulateBackgroundSeries(series, rng);
}

function advance(a: Series, b: Series, id: string, round: Round, conference: Conference | null): Series {
  // Home-ice goes to whichever winner actually has the better regular-season
  // points, same as Round 1's seeding — NOT just "whichever series was passed
  // in as `a`". That was the real bug behind a team looking like the wrong
  // one had home ice in the shootout: `a` was always the East side (or the
  // divA-slot winner), so its team got "home" regardless of real standings.
  const winnerA = a.winner!;
  const winnerB = b.winner!;
  const home = winnerA.team.points >= winnerB.team.points ? winnerA : winnerB;
  const away = home === winnerA ? winnerB : winnerA;
  return {
    id,
    round,
    conference,
    home,
    away,
    homeWins: 0,
    awayWins: 0,
    winner: null,
    isPlayerSeries: home.team.isPlayer || away.team.isPlayer,
    games: [],
  };
}

function simulateConference(
  standings: TeamStanding[],
  conference: Conference,
  rng: () => number,
  playerPoints: number,
  playerSkaters: WeightedSkater[],
): ConferenceBracket {
  const r1 = buildConferenceR1(standings, conference);
  const divATop = resolveSeries(r1.divATop, rng, playerPoints, playerSkaters);
  const divABottom = resolveSeries(r1.divABottom, rng, playerPoints, playerSkaters);
  const divBTop = resolveSeries(r1.divBTop, rng, playerPoints, playerSkaters);
  const divBBottom = resolveSeries(r1.divBBottom, rng, playerPoints, playerSkaters);

  const divAFinalUnresolved = advance(divATop, divABottom, `${conference}-DF-A`, 2, conference);
  const divBFinalUnresolved = advance(divBTop, divBBottom, `${conference}-DF-B`, 2, conference);
  const divAFinal = resolveSeries(divAFinalUnresolved, rng, playerPoints, playerSkaters);
  const divBFinal = resolveSeries(divBFinalUnresolved, rng, playerPoints, playerSkaters);

  const confFinalUnresolved = advance(divAFinal, divBFinal, `${conference}-CF`, 3, conference);
  const confFinal = resolveSeries(confFinalUnresolved, rng, playerPoints, playerSkaters);

  return {
    conference,
    divATop,
    divABottom,
    divBTop,
    divBBottom,
    divAFinal,
    divBFinal,
    confFinal,
    champion: confFinal.winner,
  };
}

export function simulatePostseason(
  runSeed: number,
  playerPoints: number,
  playerSkaters: WeightedSkater[],
): PostseasonResult {
  const standings = sampleLeagueStandings(runSeed, playerPoints);
  const rng = mulberry32(hashStringToInt(`${runSeed}:postseason:bracket`));

  const atlanticStandings = standings.filter((t) => t.division === 'Atlantic').sort((a, b) => b.points - a.points);
  const eastStandings = standings.filter((t) => t.conference === 'East').sort((a, b) => b.points - a.points);
  const { divATop3, wc1, wc2 } = seedConference(standings, 'East');
  const playerQualified = divATop3.some((t) => t.isPlayer) || wc1.isPlayer || wc2.isPlayer;
  const playerSeedEntry = playerQualified
    ? divATop3.find((t) => t.isPlayer)
      ? { seed: divATop3.findIndex((t) => t.isPlayer) + 1, kind: 'division' as const }
      : { seed: wc1.isPlayer ? 1 : 2, kind: 'wildcard' as const }
    : null;
  const playerSeedLabel = playerSeedEntry
    ? playerSeedEntry.kind === 'division'
      ? `A${playerSeedEntry.seed}`
      : `WC${playerSeedEntry.seed}`
    : null;

  const eastBracket = simulateConference(standings, 'East', rng, playerPoints, playerSkaters);
  const westBracket = simulateConference(standings, 'West', rng, playerPoints, playerSkaters);

  const finalUnresolved = advance(eastBracket.confFinal!, westBracket.confFinal!, 'SCF', 4, null);
  const finalSeries = resolveSeries(finalUnresolved, rng, playerPoints, playerSkaters);
  const cupChampion = finalSeries.winner!;

  const playerWonConference = eastBracket.champion?.team.isPlayer ?? false;
  const playerWonCup = cupChampion.team.isPlayer;

  let playerEliminatedRound: Round | null = null;
  let eliminatedBy: SeedEntry | null = null;
  if (playerQualified && !playerWonCup) {
    // Find the first series (in round order) where the player took part and lost.
    const allEastSeries: Series[] = [
      eastBracket.divATop,
      eastBracket.divABottom,
      eastBracket.divBTop,
      eastBracket.divBBottom,
      eastBracket.divAFinal,
      eastBracket.divBFinal,
      eastBracket.confFinal,
      finalSeries,
    ].filter((s): s is Series => s !== null);
    const lostSeries = allEastSeries.find((s) => s.isPlayerSeries && s.winner && !s.winner.team.isPlayer);
    playerEliminatedRound = lostSeries ? lostSeries.round : null;
    eliminatedBy = lostSeries?.winner ?? null;
  }

  return {
    qualified: playerQualified,
    playerSeedLabel,
    atlanticStandings,
    eastStandings,
    eastBracket,
    westBracket,
    finalSeries,
    cupChampion,
    playerEliminatedRound,
    eliminatedBy,
    playerWonCup,
    playerWonConference,
  };
}

// Dev-only test helper — real games, no fabricated data. Searches seeds until it
// finds one where Game 1 of the Final specifically goes to a shootout, so the
// ceremony can be eyeballed immediately (paired with startAtRound=4) rather than
// waiting on the ~5%-per-game odds in a normal playthrough, or on some later,
// unpredictable game within the Final series.
export function findCupFinalShootoutSeed(
  playerPoints: number,
  skaters: WeightedSkater[],
  maxAttempts = 5000,
): { seed: number; result: PostseasonResult } | null {
  for (let seed = 1; seed <= maxAttempts; seed++) {
    const result = simulatePostseason(seed, playerPoints, skaters);
    if (result.qualified && result.finalSeries.games[0]?.decidedIn === 'SO') {
      return { seed, result };
    }
  }
  return null;
}

// Dev-only test helper — searches for a seed where the player qualifies but is
// eliminated in a specific round (1 = First Series … 3 = Conference Final), so the
// "Eliminated in the {Round} by {Team}" recap header can be eyeballed for a given
// round without replaying until the outcome happens to land there. Round 4 is a
// Cup Final loss; a Cup win never sets playerEliminatedRound.
export function findSeedEliminatedInRound(
  round: Round,
  playerPoints: number,
  skaters: WeightedSkater[],
  maxAttempts = 5000,
): { seed: number; result: PostseasonResult } | null {
  for (let seed = 1; seed <= maxAttempts; seed++) {
    const result = simulatePostseason(seed, playerPoints, skaters);
    if (result.qualified && result.playerEliminatedRound === round) {
      return { seed, result };
    }
  }
  return null;
}

// Dev-only test helper — same idea as findCupFinalShootoutSeed, but only requires
// the player to have actually reached the Stanley Cup Final (win or lose, no
// shootout requirement), so it's a much quicker hit for testing the Final round
// generally rather than the shootout ceremony specifically.
export function findSeedReachingFinal(
  playerPoints: number,
  skaters: WeightedSkater[],
  maxAttempts = 5000,
): { seed: number; result: PostseasonResult } | null {
  for (let seed = 1; seed <= maxAttempts; seed++) {
    const result = simulatePostseason(seed, playerPoints, skaters);
    if (result.qualified && result.finalSeries.isPlayerSeries) {
      return { seed, result };
    }
  }
  return null;
}

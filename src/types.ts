// Roster position as actually recorded on historical rosters (defensemen aren't
// split into left/right in the source data — that split only matters for slots).
export type Position = 'LW' | 'C' | 'RW' | 'D' | 'G';

// The six draft slots a roster is built from.
export type SlotId = 'LW' | 'C' | 'RW' | 'LD' | 'RD' | 'G';

export const SLOT_ORDER: SlotId[] = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];

/** Real roster position a slot requires (LD/RD both need a plain "D" — the left/right split only exists at the slot level). */
export function eligiblePosition(slot: SlotId): Position {
  if (slot === 'LD' || slot === 'RD') return 'D';
  return slot as Position;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  gp: number;
  g: number;
  a: number;
  pts: number;
  savePct?: number; // goalies only (e.g. 0.910) — drives goalie scoring since points don't apply
  gaa?: number; // goalies only — goals against average, display stat (tracked since day one of the NHL)
}

export type SeasonEra = 'preHowe' | 'howeToPreYzerman' | 'yzermanOnward';

export interface Season {
  id: string;
  year: string; // e.g. "1996-97"
  label: string; // e.g. "1996-97 Red Wings"
  scheduledGames: number; // 70 for Original Six-era seasons, 82 for modern
  leagueAvgGoalsPerGame: number; // scoring environment that season, for era normalization
  teamPoints: number; // team standings points that season, strength-signal input
  era: SeasonEra;
  blurb: string; // one-line flavor text for the spin reveal
  roster: Player[];
}

export interface DraftPick {
  slot: SlotId;
  seasonId: string;
  player: Player;
}

export type StrengthLabel = 'Thin' | 'Solid' | 'Stacked';

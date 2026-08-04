// Trade Deadline: fires once around game 61-62 of the regular season. Opt-in — if the
// player enters the trade market, one of six equally-likely flavors resolves. Incoming
// players are always sourced the same way the initial draft works (era-weighted season
// spin, then pull a player at the needed position from that season's roster), except
// Scouting Report, which spins three independent seasons for its three candidates since
// it's the one flavor that gives the player real choice.
import type { DraftPick, Player, Season, SlotId } from '../types';
import { SLOT_ORDER, eligiblePosition } from '../types';
import { playerScore } from './scoring';
import { toRating } from './ratings';
import { weightedPick } from './spin';

export type TradeFlavor = 'fireSale' | 'bargainBuy' | 'scoutingReport' | 'rentalDeal' | 'blockbuster' | 'dealFallsThrough';

const FLAVORS: TradeFlavor[] = ['fireSale', 'bargainBuy', 'scoutingReport', 'rentalDeal', 'blockbuster', 'dealFallsThrough'];

export function rollTradeFlavor(rng: () => number): TradeFlavor {
  return FLAVORS[Math.floor(rng() * FLAVORS.length)];
}

export interface IncomingPlayer {
  slot: SlotId;
  seasonId: string;
  player: Player;
}

export interface TradeSwap {
  outgoing: DraftPick;
  incoming: IncomingPlayer;
}

export interface TradeResult {
  flavor: TradeFlavor;
  swaps: TradeSwap[]; // resolved swaps — empty for dealFallsThrough and (until a choice is made) scoutingReport
  scoutingPick?: {
    outgoing: DraftPick;
    candidates: IncomingPlayer[]; // exactly 3
  };
}

export function playerRating(player: Player, season: Season): number {
  return toRating(playerScore(player, season));
}

/** The current pick with the lowest rating — target for Bargain Buy and Scouting Report. */
export function weakestPick(picks: DraftPick[], seasonsById: Map<string, Season>): DraftPick {
  return [...picks].sort((a, b) => {
    const seasonA = seasonsById.get(a.seasonId);
    const seasonB = seasonsById.get(b.seasonId);
    const ratingA = seasonA ? playerRating(a.player, seasonA) : 0;
    const ratingB = seasonB ? playerRating(b.player, seasonB) : 0;
    return ratingA - ratingB;
  })[0];
}

function randomPick(rng: () => number, picks: DraftPick[]): DraftPick {
  return picks[Math.floor(rng() * picks.length)];
}

/** Spins one season and returns the best- or worst-rated player at the given slot's position from it. */
function sourceFromOneSpin(
  rng: () => number,
  slot: SlotId,
  seasons: Season[],
  direction: 'best' | 'worst' | 'random',
): IncomingPlayer {
  const position = eligiblePosition(slot);
  // Reroll seasons that happen not to carry the needed position (rare, but every
  // season is capped to a handful of players per slot so it's not guaranteed).
  for (let attempt = 0; attempt < 20; attempt++) {
    const season = weightedPick(seasons, rng);
    const pool = season.roster.filter((p) => p.position === position);
    if (pool.length === 0) continue;
    const ranked = [...pool].sort((a, b) => playerRating(b, season) - playerRating(a, season));
    const player =
      direction === 'best' ? ranked[0] : direction === 'worst' ? ranked[ranked.length - 1] : pool[Math.floor(rng() * pool.length)];
    return { slot, seasonId: season.id, player };
  }
  // Pathological fallback — shouldn't hit given the data set covers every position.
  const season = seasons[0];
  const pool = season.roster.filter((p) => p.position === position);
  return { slot, seasonId: season.id, player: pool[0] ?? season.roster[0] };
}

function buildSwap(outgoing: DraftPick, incoming: IncomingPlayer): TradeSwap {
  return { outgoing, incoming };
}

/**
 * Resolves everything except Scouting Report's final pick (that needs the player's
 * choice — see resolveScoutingChoice below). For Scouting Report this returns the
 * three candidates instead of a swap.
 */
export function resolveTrade(
  flavor: TradeFlavor,
  rng: () => number,
  picks: DraftPick[],
  seasonsById: Map<string, Season>,
  seasons: Season[],
): TradeResult {
  switch (flavor) {
    case 'dealFallsThrough':
      return { flavor, swaps: [] };

    case 'fireSale': {
      const outgoing = randomPick(rng, picks);
      const incoming = sourceFromOneSpin(rng, outgoing.slot, seasons, 'worst');
      return { flavor, swaps: [buildSwap(outgoing, incoming)] };
    }

    case 'bargainBuy': {
      const outgoing = weakestPick(picks, seasonsById);
      const incoming = sourceFromOneSpin(rng, outgoing.slot, seasons, 'best');
      return { flavor, swaps: [buildSwap(outgoing, incoming)] };
    }

    case 'rentalDeal': {
      const outgoing = randomPick(rng, picks);
      const incoming = sourceFromOneSpin(rng, outgoing.slot, seasons, 'best');
      return { flavor, swaps: [buildSwap(outgoing, incoming)] };
    }

    case 'blockbuster': {
      const shuffled = [...SLOT_ORDER].sort(() => rng() - 0.5);
      const slotsToSwap = shuffled.slice(0, 2);
      const swaps = slotsToSwap.map((slot) => {
        const outgoing = picks.find((p) => p.slot === slot)!;
        const incoming = sourceFromOneSpin(rng, slot, seasons, 'random');
        return buildSwap(outgoing, incoming);
      });
      return { flavor, swaps };
    }

    case 'scoutingReport': {
      const outgoing = weakestPick(picks, seasonsById);
      const candidates: IncomingPlayer[] = [];
      for (let i = 0; i < 3; i++) {
        candidates.push(sourceFromOneSpin(rng, outgoing.slot, seasons, 'best'));
      }
      return { flavor, swaps: [], scoutingPick: { outgoing, candidates } };
    }
  }
}

export function resolveScoutingChoice(outgoing: DraftPick, chosen: IncomingPlayer): TradeResult {
  return { flavor: 'scoutingReport', swaps: [buildSwap(outgoing, chosen)] };
}

export function applyTradeSwaps(picks: DraftPick[], swaps: TradeSwap[]): DraftPick[] {
  const bySlot = new Map(swaps.map((s) => [s.outgoing.slot, s.incoming]));
  return picks.map((pick) => {
    const incoming = bySlot.get(pick.slot);
    if (!incoming) return pick;
    return { slot: pick.slot, seasonId: incoming.seasonId, player: incoming.player };
  });
}


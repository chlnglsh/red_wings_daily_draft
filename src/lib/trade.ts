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

/**
 * Spins one season and returns a player at the given slot's position from it.
 * 'random' is a genuine coin flip (Fire Sale, Blockbuster — could be an upgrade or a
 * disaster). 'weightedBest' biases toward the top of that season's pool without
 * guaranteeing it (Rental Deal — better odds of a good player, not a sure thing).
 */
function sourceFromOneSpin(
  rng: () => number,
  slot: SlotId,
  seasons: Season[],
  direction: 'weightedBest' | 'random',
  excludeNames: Set<string>,
): IncomingPlayer {
  const position = eligiblePosition(slot);
  // Reroll seasons that happen not to carry the needed position (rare, but every
  // season is capped to a handful of players per slot so it's not guaranteed).
  for (let attempt = 0; attempt < 20; attempt++) {
    const season = weightedPick(seasons, rng);
    // Excludes by name, not id: the same real player has a different, season-scoped
    // id in every season's roster entry, so an id-only check would let a trade hand
    // back a player you already have under a different season.
    const pool = season.roster.filter((p) => p.position === position && !excludeNames.has(p.name));
    if (pool.length === 0) continue;
    if (direction === 'random') {
      return { slot, seasonId: season.id, player: pool[Math.floor(rng() * pool.length)] };
    }
    // weightedBest: multiplying two uniform randoms skews the index toward 0 (the
    // top of the rating-sorted pool) without always landing there.
    const ranked = [...pool].sort((a, b) => playerRating(b, season) - playerRating(a, season));
    const index = Math.floor(rng() * rng() * ranked.length);
    return { slot, seasonId: season.id, player: ranked[index] };
  }
  // Pathological fallback — shouldn't hit given the data set covers every position.
  const season = seasons[0];
  const pool = season.roster.filter((p) => p.position === position);
  return { slot, seasonId: season.id, player: pool[0] ?? season.roster[0] };
}

/**
 * Keeps spinning seasons until it finds a player at the slot's position whose
 * rating is at least `floorRating` — used where a flavor promises a real (not just
 * likely) upgrade. Falls back to the best candidate seen if the floor is never
 * reached within the attempt cap (rare — only when the outgoing player is already
 * elite), so this always terminates and always returns something reasonable.
 */
function sourceGuaranteedAtLeast(
  rng: () => number,
  slot: SlotId,
  seasons: Season[],
  floorRating: number,
  excludeNames: Set<string>,
): IncomingPlayer {
  const position = eligiblePosition(slot);
  let best: IncomingPlayer | null = null;
  let bestRating = -Infinity;
  for (let attempt = 0; attempt < 30; attempt++) {
    const season = weightedPick(seasons, rng);
    const pool = season.roster.filter((p) => p.position === position && !excludeNames.has(p.name));
    if (pool.length === 0) continue;
    const ranked = [...pool].sort((a, b) => playerRating(b, season) - playerRating(a, season));
    const candidate = ranked[0];
    const rating = playerRating(candidate, season);
    if (rating > bestRating) {
      bestRating = rating;
      best = { slot, seasonId: season.id, player: candidate };
    }
    if (rating >= floorRating) return best!;
  }
  return best!;
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
  // A trade should never hand back a player you already have under a different
  // season's roster entry — same fix as the draft screen, applied here so it
  // can't reintroduce the duplicate via the trade market instead.
  const rosterNames = new Set(picks.map((p) => p.player.name));

  switch (flavor) {
    case 'dealFallsThrough':
      return { flavor, swaps: [] };

    case 'fireSale': {
      // A panic move, not a plan — genuinely could be an upgrade or a disaster.
      const outgoing = randomPick(rng, picks);
      const incoming = sourceFromOneSpin(rng, outgoing.slot, seasons, 'random', rosterNames);
      return { flavor, swaps: [buildSwap(outgoing, incoming)] };
    }

    case 'bargainBuy': {
      // Promised an upgrade — the incoming player is guaranteed to rate higher
      // than whoever they're replacing, not just "best of whatever season spun."
      const outgoing = weakestPick(picks, seasonsById);
      const outgoingRating = playerRating(outgoing.player, seasonsById.get(outgoing.seasonId)!);
      const incoming = sourceGuaranteedAtLeast(rng, outgoing.slot, seasons, outgoingRating + 1, rosterNames);
      return { flavor, swaps: [buildSwap(outgoing, incoming)] };
    }

    case 'rentalDeal': {
      // Similar risk profile to Fire Sale, but the odds are stacked toward a good
      // outcome instead of a pure coin flip.
      const outgoing = randomPick(rng, picks);
      const incoming = sourceFromOneSpin(rng, outgoing.slot, seasons, 'weightedBest', rosterNames);
      return { flavor, swaps: [buildSwap(outgoing, incoming)] };
    }

    case 'blockbuster': {
      // Two swaps, both genuinely chancy — no quality bias on either side. Each
      // incoming player also gets excluded before sourcing the next one, so the
      // two swaps can't both hand back the same player.
      const shuffled = [...SLOT_ORDER].sort(() => rng() - 0.5);
      const slotsToSwap = shuffled.slice(0, 2);
      const excluded = new Set(rosterNames);
      const swaps = slotsToSwap.map((slot) => {
        const outgoing = picks.find((p) => p.slot === slot)!;
        const incoming = sourceFromOneSpin(rng, slot, seasons, 'random', excluded);
        excluded.add(incoming.player.name);
        return buildSwap(outgoing, incoming);
      });
      return { flavor, swaps };
    }

    case 'scoutingReport': {
      // Two real options with real risk, plus one guaranteed-safe pick — so there's
      // always at least one candidate that's a same-or-better upgrade. Each candidate
      // also excludes the ones already drawn so the three options are never duplicates.
      const outgoing = weakestPick(picks, seasonsById);
      const outgoingRating = playerRating(outgoing.player, seasonsById.get(outgoing.seasonId)!);
      const excluded = new Set(rosterNames);
      const first = sourceFromOneSpin(rng, outgoing.slot, seasons, 'random', excluded);
      excluded.add(first.player.name);
      const second = sourceFromOneSpin(rng, outgoing.slot, seasons, 'random', excluded);
      excluded.add(second.player.name);
      const third = sourceGuaranteedAtLeast(rng, outgoing.slot, seasons, outgoingRating, excluded);
      const candidates: IncomingPlayer[] = [first, second, third].sort(() => rng() - 0.5);
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


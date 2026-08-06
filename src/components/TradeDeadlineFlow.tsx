import { useState } from 'react';
import type { DraftPick, Season, SlotId } from '../types';
import {
  rollTradeFlavor,
  resolveTrade,
  resolveScoutingChoice,
  applyTradeSwaps,
  playerRating,
  type TradeFlavor,
  type TradeResult,
  type IncomingPlayer,
} from '../lib/trade';
import { ratingTier } from '../lib/ratings';
import { statLine } from '../lib/scoring';
import { useSpinAnimation } from '../hooks/useSpinAnimation';

const FLAVOR_COPY: Record<TradeFlavor, { title: string; blurb: string }> = {
  fireSale: { title: '🔥 Fire Sale', blurb: 'The front office panics and moves a piece off your roster. Could be an upgrade, could be a disaster.' },
  bargainBuy: { title: '💰 Bargain Buy', blurb: 'Your scouts find a genuine upgrade for your weakest spot.' },
  scoutingReport: { title: '🔍 Scouting Report', blurb: 'Your scouts flag three options for your weakest spot, and at least one is a safe upgrade.' },
  rentalDeal: { title: '⏳ Rental Deal', blurb: 'A short-term rental comes in for the stretch run. The odds favor an upgrade, but nothing is promised.' },
  blockbuster: { title: '💥 Blockbuster', blurb: 'A two-for-two swap reshapes the roster, pure chance on both sides.' },
  dealFallsThrough: { title: '🚫 Deal Falls Through', blurb: "The deal fell through at the deadline. Roster's unchanged." },
};

const SLOT_LABELS: Record<SlotId, string> = {
  LW: 'Left Wing',
  C: 'Center',
  RW: 'Right Wing',
  LD: 'Left Defense',
  RD: 'Right Defense',
  G: 'Goalie',
};

function SwapRow({ outgoing, incoming, seasonsById }: { outgoing: DraftPick; incoming: IncomingPlayer; seasonsById: Map<string, Season> }) {
  const outSeason = seasonsById.get(outgoing.seasonId)!;
  const inSeason = seasonsById.get(incoming.seasonId)!;
  const outRating = playerRating(outgoing.player, outSeason);
  const inRating = playerRating(incoming.player, inSeason);
  const delta = inRating - outRating;

  return (
    <div className="trade-swap-item">
      <p className="trade-swap-position">{SLOT_LABELS[outgoing.slot]}</p>
      <div className="trade-swap-row">
        <div className="trade-swap-out">
          <span className="roster-row-name trade-swap-name-row">
            <span className={`roster-row-rating ${ratingTier(outRating)}`}>{outRating}</span>
            <span className="roster-row-name-text">{outgoing.player.name}</span>
          </span>
          <span className="trade-swap-meta">{outSeason.year}</span>
        </div>
        <span className="trade-swap-arrow">→</span>
        <div className="trade-swap-in">
          <span className="roster-row-name trade-swap-name-row">
            <span className={`roster-row-rating ${ratingTier(inRating)}`}>{inRating}</span>
            <span className="roster-row-name-text">{incoming.player.name}</span>
          </span>
          <span className="trade-swap-meta">{inSeason.year}</span>
        </div>
      </div>
      <p className={`trade-swap-delta ${delta >= 0 ? 'up' : 'down'}`}>
        {delta >= 0
          ? `▲ ${delta} rating points higher than the player you gave up`
          : `▼ ${Math.abs(delta)} rating points lower than the player you gave up`}
      </p>
    </div>
  );
}

export function TradeDeadlineFlow({
  tally,
  picks,
  seasonsById,
  seasons,
  rng,
  onResolved,
}: {
  tally: { wins: number; losses: number; otl: number; points: number; goalsFor: number; goalsAgainst: number };
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  seasons: Season[];
  rng: () => number;
  onResolved: (finalPicks: DraftPick[]) => void;
}) {
  const [stage, setStage] = useState<'gate' | 'spinning' | 'result' | 'scoutingPick'>('gate');
  const [result, setResult] = useState<TradeResult | null>(null);
  const [spinToken, setSpinToken] = useState(0);

  // Same slot-machine cycling as the season-roll spin in the draft — lands on
  // the flavor that's already been rolled (rng is consumed once, synchronously,
  // in handleEnterMarket below; this just delays revealing it for the spin).
  // active: stays idle until the user actually clicks "Enter the trade
  // market" — this component mounts at the 'gate' stage, so without this the
  // animation would play out silently in the background before any click.
  const flavorPool = Object.keys(FLAVOR_COPY) as TradeFlavor[];
  const { displayItem: displayFlavor, spinning, tick } = useSpinAnimation<TradeFlavor>(
    result?.flavor ?? 'dealFallsThrough',
    spinToken,
    flavorPool,
    {
      active: stage === 'spinning',
      onComplete: () => setStage(result?.flavor === 'scoutingReport' ? 'scoutingPick' : 'result'),
    },
  );

  function handleStandPat() {
    onResolved(picks);
  }

  function handleEnterMarket() {
    const flavor = rollTradeFlavor(rng);
    const resolved = resolveTrade(flavor, rng, picks, seasonsById, seasons);
    setResult(resolved);
    setSpinToken((t) => t + 1);
    setStage('spinning');
  }

  function handleScoutingChoice(chosen: IncomingPlayer) {
    if (!result?.scoutingPick) return;
    const resolved = resolveScoutingChoice(result.scoutingPick.outgoing, chosen);
    setResult(resolved);
    setStage('result');
  }

  function handleContinue() {
    const finalPicks = result && result.swaps.length > 0 ? applyTradeSwaps(picks, result.swaps) : picks;
    onResolved(finalPicks);
  }

  if (stage === 'gate') {
    return (
      <div className="trade-deadline rink-backdrop">
        <p className="trade-deadline-eyebrow">Trade Deadline</p>
        <h2 className="trade-deadline-title">Down the stretch</h2>
        <div className="season-sim-tally">
          <div>
            <strong>{tally.wins}</strong>
            <span>W</span>
          </div>
          <div>
            <strong>{tally.losses}</strong>
            <span>L</span>
          </div>
          <div>
            <strong>{tally.otl}</strong>
            <span>OTL</span>
          </div>
          <div>
            <strong>{tally.points}</strong>
            <span>PTS</span>
          </div>
          <div>
            <strong>
              {tally.goalsFor}-{tally.goalsAgainst}
            </strong>
            <span>GF-GA</span>
          </div>
        </div>
        <p className="trade-deadline-prompt">Work the phones before the deadline, or stand pat with the roster you drafted?</p>
        <div className="trade-deadline-actions">
          <button type="button" className="primary-btn" onClick={handleEnterMarket}>
            Enter the trade market
          </button>
          <button type="button" className="secondary-btn" onClick={handleStandPat}>
            Stand pat
          </button>
        </div>
        <p className="trade-deadline-disclaimer">Enter the market and you're accepting the result, good or bad. No takebacks.</p>
      </div>
    );
  }

  if (stage === 'spinning') {
    return (
      <div className="trade-deadline rink-backdrop">
        <p className="trade-deadline-eyebrow">Trade Deadline</p>
        <h2 key={tick} className={`spin-reveal-season${spinning ? ' spinning' : ''}`}>
          {FLAVOR_COPY[displayFlavor].title}
        </h2>
        <p className={`spin-reveal-blurb${spinning ? ' spinning' : ''}`}>
          {spinning ? 'Working the phones…' : FLAVOR_COPY[displayFlavor].blurb}
        </p>
      </div>
    );
  }

  if (stage === 'scoutingPick' && result?.scoutingPick) {
    const { outgoing, candidates } = result.scoutingPick;
    const outgoingSeason = seasonsById.get(outgoing.seasonId)!;
    const outgoingRating = playerRating(outgoing.player, outgoingSeason);
    return (
      <div className="trade-deadline rink-backdrop">
        <p className="trade-deadline-eyebrow">{FLAVOR_COPY.scoutingReport.title}</p>
        <p className="trade-deadline-prompt">{FLAVOR_COPY.scoutingReport.blurb}</p>
        <p className="roster-picker-heading">
          Replacing {outgoing.player.name} <span className="roster-row-pos">{outgoing.slot}</span>
        </p>
        <div className="scouting-outgoing">
          <span className="roster-row-name">
            <span className={`roster-row-rating ${ratingTier(outgoingRating)}`}>{outgoingRating}</span>
            <span className="roster-row-name-text">{outgoing.player.name}</span>
            <span className="roster-row-pos">{outgoing.player.position}</span>
          </span>
          <span className="roster-row-stats">
            {outgoingSeason.year} · {statLine(outgoing.player)}
          </span>
        </div>
        <ul className="roster-list scouting-list">
          {candidates.map((candidate, i) => {
            const season = seasonsById.get(candidate.seasonId)!;
            const rating = playerRating(candidate.player, season);
            return (
              <li key={i}>
                <button type="button" className="roster-row" onClick={() => handleScoutingChoice(candidate)}>
                  <span className="roster-row-name">
                    <span className={`roster-row-rating ${ratingTier(rating)}`}>{rating}</span>
                    <span className="roster-row-name-text">{candidate.player.name}</span>
                    <span className="roster-row-pos">{candidate.player.position}</span>
                  </span>
                  <span className="roster-row-stats">
                    {season.year} · {statLine(candidate.player)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (stage === 'result' && result) {
    const copy = FLAVOR_COPY[result.flavor];
    return (
      <div className="trade-deadline rink-backdrop">
        <p className="trade-deadline-eyebrow">{copy.title}</p>
        <p className="trade-deadline-prompt">{copy.blurb}</p>
        {result.swaps.length > 0 && (
          <div className="trade-swap-card">
            {result.swaps.map((swap, i) => (
              <SwapRow key={i} outgoing={swap.outgoing} incoming={swap.incoming} seasonsById={seasonsById} />
            ))}
          </div>
        )}
        <button type="button" className="primary-btn" onClick={handleContinue}>
          Continue the season
        </button>
      </div>
    );
  }

  return null;
}

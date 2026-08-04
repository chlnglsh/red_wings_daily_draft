import { useState } from 'react';
import type { DraftPick, Season } from '../types';
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

const FLAVOR_COPY: Record<TradeFlavor, { title: string; blurb: string }> = {
  fireSale: { title: '🔥 Fire Sale', blurb: 'The front office panics and moves a piece off your roster.' },
  bargainBuy: { title: '💰 Bargain Buy', blurb: 'Your scouts find an under-the-radar upgrade for your weakest spot.' },
  scoutingReport: { title: '🔍 Scouting Report', blurb: 'Your scouts flag three ways to upgrade your weakest spot.' },
  rentalDeal: { title: '⏳ Rental Deal', blurb: 'A short-term rental comes in hot for the stretch run.' },
  blockbuster: { title: '💥 Blockbuster', blurb: 'A two-for-two swap reshapes the roster.' },
  dealFallsThrough: { title: '🚫 Deal Falls Through', blurb: "The deal fell through at the deadline. Roster's unchanged." },
};

function SwapRow({ outgoing, incoming, seasonsById }: { outgoing: DraftPick; incoming: IncomingPlayer; seasonsById: Map<string, Season> }) {
  const outSeason = seasonsById.get(outgoing.seasonId)!;
  const inSeason = seasonsById.get(incoming.seasonId)!;
  const outRating = playerRating(outgoing.player, outSeason);
  const inRating = playerRating(incoming.player, inSeason);
  const delta = inRating - outRating;

  return (
    <div className="trade-swap-row">
      <span className="trade-swap-slot">{outgoing.slot}</span>
      <div className="trade-swap-out">
        <span className="trade-swap-name">{outgoing.player.name}</span>
        <span className="trade-swap-meta">
          {outSeason.year} · {outRating}
        </span>
      </div>
      <span className="trade-swap-arrow">→</span>
      <div className="trade-swap-in">
        <span className="trade-swap-name">{incoming.player.name}</span>
        <span className="trade-swap-meta">
          {inSeason.year} · {inRating}
        </span>
      </div>
      <span className={`trade-swap-delta ${delta >= 0 ? 'up' : 'down'}`}>
        {delta >= 0 ? `▲ Up ${delta}` : `▼ Down ${Math.abs(delta)}`}
      </span>
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
  const [stage, setStage] = useState<'gate' | 'result' | 'scoutingPick'>('gate');
  const [result, setResult] = useState<TradeResult | null>(null);

  function handleStandPat() {
    onResolved(picks);
  }

  function handleEnterMarket() {
    const flavor = rollTradeFlavor(rng);
    const resolved = resolveTrade(flavor, rng, picks, seasonsById, seasons);
    setResult(resolved);
    setStage(resolved.flavor === 'scoutingReport' ? 'scoutingPick' : 'result');
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
        <h2 className="trade-deadline-title">Halfway there</h2>
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
          <button type="button" className="text-btn" onClick={handleStandPat}>
            Stand pat
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'scoutingPick' && result?.scoutingPick) {
    const { outgoing, candidates } = result.scoutingPick;
    return (
      <div className="trade-deadline rink-backdrop">
        <p className="trade-deadline-eyebrow">{FLAVOR_COPY.scoutingReport.title}</p>
        <p className="trade-deadline-prompt">{FLAVOR_COPY.scoutingReport.blurb}</p>
        <p className="roster-picker-heading">
          Replacing {outgoing.player.name} ({outgoing.slot})
        </p>
        <ul className="roster-list scouting-list">
          {candidates.map((candidate, i) => {
            const season = seasonsById.get(candidate.seasonId)!;
            return (
              <li key={i}>
                <button type="button" className="roster-row" onClick={() => handleScoutingChoice(candidate)}>
                  <span className="roster-row-name">
                    <span className="roster-row-name-text">{candidate.player.name}</span>
                    <span className="roster-row-pos">{candidate.player.position}</span>
                  </span>
                  <span className="roster-row-stats">
                    {season.year} · {playerRating(candidate.player, season)} rating
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
          Continue the season →
        </button>
      </div>
    );
  }

  return null;
}

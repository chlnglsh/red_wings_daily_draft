import { useEffect, useRef } from 'react';
import type { DraftPick, Season, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import type { GameResult, SeasonSimResult } from '../lib/gameSim';
import type { GmCoachResult } from '../lib/gmCoach';
import { gameTitle } from '../data/team';
import { FrontOfficeRecapCards } from './FrontOfficeRecapCards';

// Mirrors SeasonSimScreen's gameLine: shootout games show as "(OT)" too — this
// game's choice, not standard box-score convention.
function gameLine(game: GameResult): string {
  const tag = game.decidedIn === 'REG' ? '' : ' (OT)';
  return `${game.teamGoals}-${game.oppGoals}${tag}`;
}

// Post-game recap: the drafted lineup plus every game of the season, in order.
// Reached from the results and champion screens; onBack returns to whichever one
// the player came from.
export function SeasonRecapScreen({
  picks,
  seasonsById,
  simResult,
  frontOffice,
  showsLeaderboard,
  onBack,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  simResult: SeasonSimResult;
  frontOffice: GmCoachResult | null;
  showsLeaderboard: boolean;
  onBack: () => void;
}) {
  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));

  // Only fade the game log's top/bottom edge when there's more to scroll past it in
  // that direction — so a full scroll up drops the top fade, and a full scroll down
  // drops the bottom one, instead of the gradient permanently covering the end rows.
  const logRef = useRef<HTMLDivElement | null>(null);
  function updateEdgeClasses(el: HTMLDivElement | null) {
    if (!el) return;
    el.classList.toggle('at-top', el.scrollTop <= 1);
    el.classList.toggle('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }
  useEffect(() => {
    updateEdgeClasses(logRef.current);
  });

  return (
    <div className="results-screen season-recap rink-backdrop">
      <h1 className="season-recap-title">Season Recap</h1>
      <p className="season-recap-record">
        {simResult.wins}-{simResult.losses}-{simResult.otl} · {simResult.points} pts ·{' '}
        {simResult.goalsFor}-{simResult.goalsAgainst} GF-GA
      </p>

      <p className="season-recap-heading">Your lineup</p>
      <div className="results-roster">
        {SLOT_ORDER.map((slot) => {
          const pick = bySlot.get(slot);
          if (!pick) return null;
          const season = seasonsById.get(pick.seasonId)!;
          return (
            <div key={slot} className="results-roster-row">
              <span className="results-roster-slot">{slot}</span>
              <span className="results-roster-name">{pick.player.name}</span>
              <span className="results-roster-season">{season.year}</span>
            </div>
          );
        })}
        <FrontOfficeRecapCards frontOffice={frontOffice} />
      </div>

      <p className="season-recap-heading">Regular season games</p>
      <div className="season-recap-log" ref={logRef} onScroll={(e) => updateEdgeClasses(e.currentTarget)}>
        {simResult.games.map((g) => (
          <div key={g.gameNumber} className="season-sim-game">
            <span className={`season-sim-result ${g.result === 'W' ? 'win' : 'loss'}`}>{g.result}</span>
            <span className="season-sim-opponent">
              G{g.gameNumber} vs. {g.opponent} {g.home ? '(H)' : '(A)'}
            </span>
            <span className="season-sim-score">{gameLine(g)}</span>
          </div>
        ))}
      </div>

      <button type="button" className="primary-btn" onClick={onBack}>
        Back
      </button>
      <p className="season-recap-footer">{gameTitle(showsLeaderboard)}</p>
    </div>
  );
}

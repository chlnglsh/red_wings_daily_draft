import type { DraftPick, Season, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import type { GameResult, SeasonSimResult } from '../lib/gameSim';
import { TEAM_NAME } from '../data/team';

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
  onBack,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  simResult: SeasonSimResult;
  onBack: () => void;
}) {
  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));

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
      </div>

      <p className="season-recap-heading">Every game ({simResult.games.length})</p>
      <div className="season-recap-log">
        {simResult.games.map((g) => (
          <div key={g.gameNumber} className="season-sim-game">
            <span className={`season-sim-result ${g.result === 'W' ? 'win' : 'loss'}`}>{g.result}</span>
            <span className="season-sim-opponent">
              G{g.gameNumber} vs {g.opponent} {g.home ? '(H)' : '(A)'}
            </span>
            <span className="season-sim-score">{gameLine(g)}</span>
          </div>
        ))}
      </div>

      <button type="button" className="primary-btn" onClick={onBack}>
        Back
      </button>
      <p className="season-recap-footer">{TEAM_NAME} Daily Draft</p>
    </div>
  );
}

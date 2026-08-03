import { useMemo } from 'react';
import type { DraftPick, Season, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import { rosterScore } from '../lib/scoring';
import { computeSquadRatings } from '../lib/ratings';
import { simulateRecord } from '../lib/simulate';
import { getTierFromRosterScore } from '../lib/tiers';

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rating-bar-row">
      <span className="rating-bar-label">{label}</span>
      <div className="rating-bar-track">
        <div className="rating-bar-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="rating-bar-value">{value}</span>
    </div>
  );
}

export function SquadSummaryScreen({
  picks,
  seasonsById,
  onSimulate,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  onSimulate: () => void;
}) {
  const score = useMemo(() => rosterScore(picks, seasonsById), [picks, seasonsById]);
  const ratings = useMemo(() => computeSquadRatings(picks, seasonsById), [picks, seasonsById]);
  const predicted = useMemo(() => simulateRecord(score), [score]);
  const predictedTier = useMemo(() => getTierFromRosterScore(score), [score]);

  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));

  return (
    <div className="squad-summary rink-backdrop">
      <h2 className="squad-summary-title">Your Starting Six</h2>

      <div className="position-diagram">
        {SLOT_ORDER.map((slot) => {
          const pick = bySlot.get(slot);
          if (!pick) return null;
          const season = seasonsById.get(pick.seasonId)!;
          return (
            <div key={slot} className="position-diagram-slot" style={{ gridArea: slot.toLowerCase() }}>
              <span className="position-diagram-pos">{slot}</span>
              <span className="position-diagram-name">{pick.player.name}</span>
              <span className="position-diagram-season">{season.year}</span>
            </div>
          );
        })}
      </div>

      <div className="rating-bars">
        <RatingBar label="Attack" value={ratings.attack} />
        <RatingBar label="Defense" value={ratings.defense} />
        <RatingBar label="Goaltending" value={ratings.goaltending} />
        <RatingBar label="Overall" value={ratings.overall} />
      </div>

      <div className="predicted-standing">
        <p className="predicted-standing-label">Predicted standing</p>
        <p className="predicted-standing-record">
          {predicted.wins}-{predicted.losses}-{predicted.otl}
        </p>
        <p className="predicted-standing-tier">
          {predictedTier.emoji} {predictedTier.label}
        </p>
        <p className="predicted-standing-note">
          Based on roster quality alone. The real season still has to be played.
        </p>
      </div>

      <button type="button" className="primary-btn" onClick={onSimulate}>
        🎲 Simulate Season
      </button>
    </div>
  );
}

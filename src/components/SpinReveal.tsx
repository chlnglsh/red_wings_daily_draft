import type { Season } from '../types';
import { StrengthMeter } from './StrengthMeter';
import { getStrengthSignal } from '../lib/scoring';

export function SpinReveal({
  season,
  roundIndex,
  canReroll,
  onReroll,
  spinning,
  tick,
}: {
  season: Season;
  roundIndex: number;
  canReroll: boolean;
  onReroll: () => void;
  spinning: boolean;
  tick: number;
}) {
  const strength = getStrengthSignal(season);
  return (
    <div className="spin-reveal">
      <div className="spin-reveal-round">Round {roundIndex + 1} of 6</div>
      <h2 key={tick} className={`spin-reveal-season${spinning ? ' spinning' : ''}`}>
        {season.label}
      </h2>
      {spinning ? (
        <p className="spin-reveal-blurb spinning">Spinning…</p>
      ) : (
        <>
          <p className="spin-reveal-blurb">{season.blurb}</p>
          <StrengthMeter label={strength.label} pointPct={strength.pointPct} />
          {canReroll && (
            <button type="button" className="reroll-btn" onClick={onReroll}>
              🔄 Reroll this spin (one-time)
            </button>
          )}
        </>
      )}
    </div>
  );
}

import type { StrengthLabel } from '../types';

const LEVELS: StrengthLabel[] = ['Thin', 'Solid', 'Stacked'];

export function StrengthMeter({ label }: { label: StrengthLabel; pointPct: number }) {
  const activeIndex = LEVELS.indexOf(label);
  return (
    <div className="strength-meter">
      <span className="strength-meter-label">Season's roster strength</span>
      <div className="strength-meter-bars">
        {LEVELS.map((level, i) => (
          <span key={level} className={`strength-bar${i <= activeIndex ? ' on' : ''}`} />
        ))}
      </div>
      <span className={`strength-meter-tag strength-${label.toLowerCase()}`}>{label}</span>
    </div>
  );
}

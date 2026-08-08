import type { GmCoachResult } from '../lib/gmCoach';

// Two half-width cards shown under the lineup (below the goalie) in the season and
// post-season recaps: GM on the left, Coach on the right, each with its one-line note.
export function FrontOfficeRecapCards({ frontOffice }: { frontOffice: GmCoachResult | null }) {
  if (!frontOffice) return null;
  return (
    <div className="recap-fo-cards">
      <div className="recap-fo-card">
        <span className="recap-fo-role">General Manager</span>
        <span className="recap-fo-name">{frontOffice.gm.name}</span>
      </div>
      <div className="recap-fo-card">
        <span className="recap-fo-role">Head Coach</span>
        <span className="recap-fo-name">{frontOffice.coach.name}</span>
      </div>
    </div>
  );
}

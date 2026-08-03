import type { DraftPick, SlotId } from '../types';
import { SLOT_ORDER } from '../types';

export function ProgressTracker({ picks }: { picks: DraftPick[] }) {
  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));
  return (
    <div className="progress-tracker">
      {SLOT_ORDER.map((slot) => {
        const pick = bySlot.get(slot);
        return (
          <div
            key={slot}
            className={`progress-pill${pick ? ' filled' : ''}`}
            title={pick ? `${pick.player.name} (${pick.player.position})` : slot}
          >
            <span className="progress-pill-slot">{slot}</span>
            {pick && <span className="progress-pill-name">{pick.player.name.split(' ').pop()}</span>}
          </div>
        );
      })}
    </div>
  );
}

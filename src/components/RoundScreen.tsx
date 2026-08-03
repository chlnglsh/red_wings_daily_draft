import type { DraftPick, Player, Season, SlotId } from '../types';
import { SpinReveal } from './SpinReveal';
import { RosterPicker } from './RosterPicker';
import { ProgressTracker } from './ProgressTracker';
import { useSpinAnimation } from '../hooks/useSpinAnimation';
import { SEASONS } from '../data/seasons';

export function RoundScreen({
  roundIndex,
  season,
  spinToken,
  canReroll,
  onReroll,
  openSlots,
  draftedPlayerIds,
  onPick,
  picks,
}: {
  roundIndex: number;
  season: Season;
  spinToken: number;
  canReroll: boolean;
  onReroll: () => void;
  openSlots: SlotId[];
  draftedPlayerIds: Set<string>;
  onPick: (player: Player, slot: SlotId) => void;
  picks: DraftPick[];
}) {
  const { displaySeason, spinning, tick } = useSpinAnimation(season, spinToken, SEASONS);

  return (
    <div className="round-screen rink-backdrop">
      <ProgressTracker picks={picks} />
      <SpinReveal
        season={displaySeason}
        roundIndex={roundIndex}
        canReroll={canReroll && !spinning}
        onReroll={onReroll}
        spinning={spinning}
        tick={tick}
      />
      <div className="round-content">
        {spinning ? (
          <div className="spin-placeholder">🎰 Spinning the wheel…</div>
        ) : (
          <RosterPicker
            season={season}
            openSlots={openSlots}
            draftedPlayerIds={draftedPlayerIds}
            onPick={onPick}
          />
        )}
      </div>
    </div>
  );
}

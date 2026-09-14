import type { DraftPick, Player, Season, SlotId } from '../types';
import { SpinReveal } from './SpinReveal';
import { RosterPicker } from './RosterPicker';
import { ProgressTracker } from './ProgressTracker';
import { useSpinAnimation } from '../hooks/useSpinAnimation';
import { TEAM } from '../teams/current';
// Dice tumble under the season name while a spin is running, and the roster
// takes their place the moment it lands (user art and placement, 2026-09-14).
import diceSrc from '../assets/dice.png';

export function RoundScreen({
  roundIndex,
  season,
  spinToken,
  canReroll,
  onReroll,
  openSlots,
  draftedPlayerNames,
  onPick,
  picks,
}: {
  roundIndex: number;
  season: Season;
  spinToken: number;
  canReroll: boolean;
  onReroll: () => void;
  openSlots: SlotId[];
  draftedPlayerNames: Set<string>;
  onPick: (player: Player, slot: SlotId) => void;
  picks: DraftPick[];
}) {
  const { displayItem: displaySeason, spinning, tick } = useSpinAnimation(season, spinToken, TEAM.seasons);

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
          <div className="spin-placeholder">
            <img className="spin-dice" src={diceSrc} alt="" />
            <span>Spinning the wheel…</span>
          </div>
        ) : (
          <RosterPicker
            season={season}
            openSlots={openSlots}
            draftedPlayerNames={draftedPlayerNames}
            onPick={onPick}
          />
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Player, Season, SlotId } from '../types';
import { eligiblePosition } from '../types';
import { playerScore, statLine } from '../lib/scoring';
import { toRating, ratingTier } from '../lib/ratings';

function slotsForPosition(position: Player['position'], openSlots: SlotId[]): SlotId[] {
  return openSlots.filter((slot) => eligiblePosition(slot) === position);
}

export function RosterPicker({
  season,
  openSlots,
  draftedPlayerNames,
  onPick,
}: {
  season: Season;
  openSlots: SlotId[];
  draftedPlayerNames: Set<string>;
  onPick: (player: Player, slot: SlotId) => void;
}) {
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  // Only fade the list's top/bottom edge when there's actually more content to
  // scroll past it in that direction — otherwise the gradient permanently
  // obscures the first/last row even when nothing is hidden behind it.
  function updateEdgeClasses(el: HTMLUListElement | null) {
    if (!el) return;
    el.classList.toggle('at-top', el.scrollTop <= 1);
    el.classList.toggle('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }

  useEffect(() => {
    updateEdgeClasses(listRef.current);
  });

  const availableRoster = season.roster.filter((p) => !draftedPlayerNames.has(p.name));

  // Pick anyone whose real position still has an open slot. If that position only
  // maps to one open slot, assign it immediately — the extra "which slot?" step
  // is only needed when there's a real choice (D -> LD or RD).
  if (!pendingPlayer) {
    const sortedRoster = [...availableRoster].sort((a, b) => {
      const aFilled = slotsForPosition(a.position, openSlots).length === 0;
      const bFilled = slotsForPosition(b.position, openSlots).length === 0;
      return Number(aFilled) - Number(bFilled);
    });
    return (
      <div className="roster-picker">
        <div className="roster-picker-heading">Pick anyone from this roster</div>
        <ul className="roster-list" ref={listRef} onScroll={(e) => updateEdgeClasses(e.currentTarget)}>
          {sortedRoster.map((player) => {
            const assignable = slotsForPosition(player.position, openSlots);
            const isFilled = assignable.length === 0;
            return (
              <li key={player.id}>
                <button
                  type="button"
                  className={`roster-row${isFilled ? ' filled-position' : ''}`}
                  disabled={isFilled}
                  onClick={() => {
                    if (isFilled) return;
                    if (assignable.length === 1) {
                      onPick(player, assignable[0]);
                    } else {
                      setPendingPlayer(player);
                    }
                  }}
                >
                  <span className="roster-row-name">
                    <span className={`roster-row-rating ${ratingTier(toRating(playerScore(player, season)))}`}>
                      {toRating(playerScore(player, season))}
                    </span>
                    <span className="roster-row-name-text">{player.name}</span>
                    <span className="roster-row-pos">{player.position}</span>
                  </span>
                  <span className="roster-row-stats">{isFilled ? 'Position filled' : statLine(player)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const assignableSlots = slotsForPosition(pendingPlayer.position, openSlots);

  return (
    <div className="roster-picker">
      <div className="roster-picker-heading">
        Assign <strong>{pendingPlayer.name}</strong> ({pendingPlayer.position}) to which slot?
      </div>
      <div className="slot-choice-row">
        {assignableSlots.map((slot) => (
          <button
            key={slot}
            type="button"
            className="slot-choice-btn"
            onClick={() => {
              onPick(pendingPlayer, slot);
              setPendingPlayer(null);
            }}
          >
            {slot}
          </button>
        ))}
      </div>
      <button type="button" className="text-btn" onClick={() => setPendingPlayer(null)}>
        ← choose a different player
      </button>
    </div>
  );
}

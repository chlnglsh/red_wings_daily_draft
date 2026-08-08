import { useState } from 'react';
import type { GmCoachResult } from '../lib/gmCoach';
import { GM_NAMES, COACH_NAMES } from '../lib/gmCoach';
import { useSpinAnimation } from '../hooks/useSpinAnimation';

function Reel({
  role,
  name,
  tick,
  done,
  summary,
}: {
  role: string;
  name: string;
  tick: number;
  done: boolean;
  summary: string;
}) {
  return (
    <div className={`front-office-card${done ? ' revealed' : ''}`}>
      <span className="front-office-role">{role}</span>
      {/* key={tick} retriggers the pop animation on every cycle, like the draft spin. */}
      <span key={tick} className="front-office-name">
        {name}
      </span>
      {done && <p className="front-office-summary">{summary}</p>}
    </div>
  );
}

// Shown once the draft's six positions are filled, before the squad summary. The
// player clicks to spin; the GM reel starts first and the Coach reel joins a beat
// later, so they cycle and land out of sync. Each name settles with its one-line
// performance note. The win% each carries is never shown as a number.
export function FrontOfficeScreen({
  frontOffice,
  onContinue,
}: {
  frontOffice: GmCoachResult;
  onContinue: () => void;
}) {
  const [gmSpin, setGmSpin] = useState(false);
  const [coachSpin, setCoachSpin] = useState(false);
  const [gmDone, setGmDone] = useState(false);
  const [coachDone, setCoachDone] = useState(false);

  // Each reel is idle (empty, no spoiler) until its own spin flag flips. The Coach
  // reel is kicked off a beat after the GM so the two never move or land together.
  const gm = useSpinAnimation(frontOffice.gm.name, gmSpin ? 1 : 0, GM_NAMES, {
    active: gmSpin,
    onComplete: () => setGmDone(true),
  });
  const coach = useSpinAnimation(frontOffice.coach.name, coachSpin ? 1 : 0, COACH_NAMES, {
    active: coachSpin,
    onComplete: () => setCoachDone(true),
  });

  function handleSpin() {
    setGmSpin(true);
    setTimeout(() => setCoachSpin(true), 650);
  }

  const started = gmSpin;
  const bothDone = gmDone && coachDone;

  return (
    <div className="front-office rink-backdrop">
      <h2 className="front-office-title">Your Front Office</h2>

      {!started ? (
        <p className="front-office-intro">
          The roster's set, now you need a GM and a coach. Good luck!
        </p>
      ) : (
        <div className="front-office-cards">
          <Reel
            role="General Manager"
            name={gm.displayItem}
            tick={gm.tick}
            done={gmDone}
            summary={frontOffice.gm.summary}
          />
          <Reel
            role="Head Coach"
            name={coachSpin ? coach.displayItem : ''}
            tick={coach.tick}
            done={coachDone}
            summary={frontOffice.coach.summary}
          />
        </div>
      )}

      {!started ? (
        <button type="button" className="primary-btn" onClick={handleSpin}>
          Roll the dice
        </button>
      ) : bothDone ? (
        <button type="button" className="primary-btn" onClick={onContinue}>
          Continue
        </button>
      ) : (
        <div className="spin-placeholder">Rolling…</div>
      )}
    </div>
  );
}

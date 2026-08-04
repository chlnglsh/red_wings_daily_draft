import { useEffect, useMemo, useState } from 'react';
import { mulberry32 } from '../lib/prng';

// Cup Final-only shootout presentation — reserved for the Final series specifically
// (Rounds 1-3 shootouts keep the plain regular-season OT/SO treatment). Purely
// presentational: the game's actual winner is already decided by the real engine
// (decidedIn/result), this just dramatizes it attempt-by-attempt. Auto-plays start
// to finish with no button gate, unlike the reference it's inspired by.

const ATTEMPT_MS = 650;
const END_PAUSE_MS = 1400;
const SCORE_RATE = 0.35; // rough real shootout conversion rate

const FLAVOR_LINES = [
  'Twelve feet of ice and a lot of nerve.',
  'Top shelf, where mom hides the cookies.',
  'Five-hole or bust.',
  'Breakaway. One deep breath. Go.',
  'The building holds its breath.',
  'Everything on this one move.',
  'Ice in the veins, or nothing at all.',
];

function generateSequence(seed: number, weWin: boolean): { ours: boolean[]; theirs: boolean[] } {
  const rng = mulberry32(seed);
  const ours: boolean[] = [];
  const theirs: boolean[] = [];
  let round = 0;
  for (;;) {
    round++;
    ours.push(rng() < SCORE_RATE);
    theirs.push(rng() < SCORE_RATE);
    const ourTotal = ours.filter(Boolean).length;
    const theirTotal = theirs.filter(Boolean).length;
    if (round >= 3 && ourTotal !== theirTotal) break;
    if (round > 8) break; // safety cap, practically never hit
  }
  const ourTotal = ours.filter(Boolean).length;
  const theirTotal = theirs.filter(Boolean).length;
  if (ourTotal > theirTotal !== weWin) {
    // Presentation-only nudge so the ceremony agrees with the already-decided winner.
    const last = ours.length - 1;
    ours[last] = weWin;
    theirs[last] = !weWin;
  }
  return { ours, theirs };
}

export function ShootoutCeremony({
  weWin,
  ourName,
  theirName,
  seed,
  onComplete,
}: {
  weWin: boolean;
  ourName: string;
  theirName: string;
  seed: number;
  onComplete: () => void;
}) {
  const { ours, theirs } = useMemo(() => generateSequence(seed, weWin), [seed, weWin]);
  const [revealed, setRevealed] = useState(0);
  const flavor = useMemo(
    () => FLAVOR_LINES[Math.floor(mulberry32(seed + 1)() * FLAVOR_LINES.length)],
    [seed],
  );

  useEffect(() => {
    if (revealed >= ours.length) {
      const t = setTimeout(onComplete, END_PAUSE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealed((r) => r + 1), ATTEMPT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, ours.length]);

  const ourScore = ours.slice(0, revealed).filter(Boolean).length;
  const theirScore = theirs.slice(0, revealed).filter(Boolean).length;
  const done = revealed >= ours.length;

  return (
    <div className="shootout-ceremony">
      <p className="shootout-eyebrow">Stanley Cup Final · Shootout</p>
      <div className="shootout-row">
        <span className="shootout-team-name">{ourName}</span>
        <div className="shootout-attempts">
          {ours.slice(0, revealed).map((scored, i) => (
            <span key={i} className={`shootout-attempt ${scored ? 'made' : 'missed'} ${i === revealed - 1 ? 'current' : ''}`}>
              {scored ? '✓' : '✕'}
            </span>
          ))}
        </div>
        <span className="shootout-score">{ourScore}</span>
      </div>
      <div className="shootout-row">
        <span className="shootout-team-name">{theirName}</span>
        <div className="shootout-attempts">
          {theirs.slice(0, revealed).map((scored, i) => (
            <span key={i} className={`shootout-attempt ${scored ? 'made' : 'missed'} ${i === revealed - 1 ? 'current' : ''}`}>
              {scored ? '✓' : '✕'}
            </span>
          ))}
        </div>
        <span className="shootout-score">{theirScore}</span>
      </div>
      <p className="shootout-flavor">{done ? (weWin ? `${ourName} win it in the shootout.` : `${theirName} win it in the shootout.`) : flavor}</p>
    </div>
  );
}

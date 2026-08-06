import { useEffect, useMemo, useState } from 'react';
import { mulberry32 } from '../lib/prng';

// Shootout presentation used for any playoff round's shootout-decided game (the
// eyebrow label reflects whichever round it actually is via roundLabel). Purely
// presentational: the game's actual winner is already decided by the real engine
// (decidedIn/result), this just dramatizes it attempt-by-attempt. Auto-plays start
// to finish with no button gate, unlike the reference it's inspired by.

const ATTEMPT_MS = 850;
// Real shootouts go 3 rounds (6 total attempts) before sudden death — pause a
// beat longer right at that transition so it reads as a distinct new phase,
// not just more of the same rhythm.
const SUDDEN_DEATH_PAUSE_MS = 1700;
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

function attemptSequence(rng: () => number): { ours: boolean[]; theirs: boolean[] } {
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
    if (round > 8) break; // bail this attempt (still tied) and let the caller retry
  }
  return { ours, theirs };
}

function generateSequence(seed: number, weWin: boolean): { ours: boolean[]; theirs: boolean[] } {
  // Rejection sampling, not patch-after-the-fact: generating one random 3-round
  // sequence and then overwriting just the last round to agree with the
  // already-decided real winner isn't reliable — if rounds 1-2 already gave the
  // other side a lead, forcing round 3 alone can land on a tie instead of an
  // actual win for the right team (a real bug this replaced: seen live as a
  // "1-1 after 3 rounds" shootout that the game still called decided). Instead,
  // regenerate the whole sequence with a fresh stream each try until one
  // naturally — and strictly — resolves in the real winner's favor. Still fully
  // deterministic per seed, and a real ~65%-miss-rate shootout resolves
  // decisively often enough that this essentially never needs more than a
  // handful of attempts.
  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const { ours, theirs } = attemptSequence(rng);
    const ourTotal = ours.filter(Boolean).length;
    const theirTotal = theirs.filter(Boolean).length;
    if (ourTotal !== theirTotal && (ourTotal > theirTotal) === weWin) {
      return { ours, theirs };
    }
  }
  // Astronomically unlikely fallback: a clean, unambiguous single round.
  return weWin ? { ours: [true], theirs: [false] } : { ours: [false], theirs: [true] };
}

export function ShootoutCeremony({
  weWin,
  ourName,
  theirName,
  weAreHome,
  roundLabel,
  seed,
  onComplete,
}: {
  weWin: boolean;
  ourName: string;
  theirName: string;
  weAreHome: boolean;
  roundLabel: string;
  seed: number;
  onComplete: () => void;
}) {
  const { ours, theirs } = useMemo(() => generateSequence(seed, weWin), [seed, weWin]);
  // Real shootouts alternate shot-by-shot, visiting team first each round —
  // not both teams' full sequences revealing in lockstep. `revealed` counts
  // through that single interleaved order (away, home, away, home, ...), and
  // each side's own count is derived from it below.
  const [revealed, setRevealed] = useState(0);
  const total = ours.length + theirs.length;
  const flavor = useMemo(
    () => FLAVOR_LINES[Math.floor(mulberry32(seed + 1)() * FLAVOR_LINES.length)],
    [seed],
  );

  useEffect(() => {
    if (revealed >= total) {
      const t = setTimeout(onComplete, END_PAUSE_MS);
      return () => clearTimeout(t);
    }
    const delay = revealed === 6 && total > 6 ? SUDDEN_DEATH_PAUSE_MS : ATTEMPT_MS;
    const t = setTimeout(() => setRevealed((r) => r + 1), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, total]);

  const awayRevealed = Math.ceil(revealed / 2);
  const homeRevealed = Math.floor(revealed / 2);
  const oursRevealed = weAreHome ? homeRevealed : awayRevealed;
  const theirsRevealed = weAreHome ? awayRevealed : homeRevealed;
  // Tick 1, 3, 5... is the away team's turn; 2, 4, 6... is home's.
  const lastTickWasOurs = revealed > 0 && (revealed % 2 === 1) === !weAreHome;

  const ourScore = ours.slice(0, oursRevealed).filter(Boolean).length;
  const theirScore = theirs.slice(0, theirsRevealed).filter(Boolean).length;
  const done = revealed >= total;

  const oursRow = (
    <div className="shootout-row">
      <span className="shootout-team-name">{ourName}</span>
      <div className="shootout-attempts">
        {ours.slice(0, oursRevealed).map((scored, i) => (
          <span
            key={i}
            className={`shootout-attempt ${scored ? 'made' : 'missed'} ${i === oursRevealed - 1 && lastTickWasOurs ? 'current' : ''}`}
          >
            {scored ? '✓' : '✕'}
          </span>
        ))}
      </div>
      <span className="shootout-score">{ourScore}</span>
    </div>
  );
  const theirsRow = (
    <div className="shootout-row">
      <span className="shootout-team-name">{theirName}</span>
      <div className="shootout-attempts">
        {theirs.slice(0, theirsRevealed).map((scored, i) => (
          <span
            key={i}
            className={`shootout-attempt ${scored ? 'made' : 'missed'} ${i === theirsRevealed - 1 && !lastTickWasOurs ? 'current' : ''}`}
          >
            {scored ? '✓' : '✕'}
          </span>
        ))}
      </div>
      <span className="shootout-score">{theirScore}</span>
    </div>
  );

  return (
    <div className="shootout-ceremony">
      <p className="shootout-eyebrow">{roundLabel} · Shootout</p>
      {/* Away team on top, home team on bottom — matches standard scoreboard/box-score
          convention (visitor listed first) — and the away team also shoots first each
          round, so top-to-bottom order matches shooting order too. Regardless of
          whether "we" happen to be home or away this game. */}
      {weAreHome ? theirsRow : oursRow}
      {weAreHome ? oursRow : theirsRow}
      <p className="shootout-flavor">{done ? (weWin ? `${ourName} win it in the shootout.` : `${theirName} win it in the shootout.`) : flavor}</p>
    </div>
  );
}

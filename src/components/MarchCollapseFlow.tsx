import { useEffect, useRef, useState } from 'react';
import { TEAM_NAME } from '../data/team';
import { formatSavePct } from '../lib/goalie';
import collapseOctopusSrc from '../assets/collapse-octopus.png';
import collapseNetSrc from '../assets/collapse-net.png';

// "The Puck Stops Here": pucks fall over a short window and the player clicks/taps
// to block them before they cross the goal line. Spawn rate ramps up as the clock
// runs down — starts manageable, ends frantic — per spec. Success/failure is
// never shown as a number; only ever surfaces as narrative flavor (see RESULT_COPY).
const GAME_DURATION_MS = 40000;
const START_SPAWN_INTERVAL_MS = 900;
const END_SPAWN_INTERVAL_MS = 320;
const PUCK_LINE_MS = 2000; // time from spawn until a puck reaches the goal line (a miss)
const PUCK_LINE_Y = 405; // translateY at which a falling puck meets the goal line
const PUCK_RUNOUT_Y = 145; // extra distance it keeps sliding past the line (through the delay + fade)
const PUCK_FALL_END_Y = PUCK_LINE_Y + PUCK_RUNOUT_Y;
// One continuous fall at constant speed all the way to PUCK_FALL_END_Y, so nothing
// speeds up or jumps when a puck crosses the line — it just keeps sliding and fades.
const PUCK_FALL_MS = Math.round((PUCK_FALL_END_Y / PUCK_LINE_Y) * PUCK_LINE_MS);
const TICK_MS = 80;
// After a puck crosses the line it keeps sliding for a randomized beat, THEN
// dissolves out quickly (see handleMiss and .dissolving in the CSS).
const DISSOLVE_DELAY_MIN_MS = 200;
const DISSOLVE_DELAY_MAX_MS = 400;
const DISSOLVE_FADE_MS = 120;

// Lightning cadence: brief bright strikes (alternating magenta/yellow for an
// electric look) punched against dark "storm" gaps, in irregular bursts — a rapid
// stutter, then a pause, then another strike — rather than an even or smoothly
// decelerating strobe. Each frame is [background class, ms to hold it]; after the
// last frame it settles onto the steady, fully readable hold screen so the warning
// text can actually be read before the player chooses to proceed.
type FlickerClass = 'flash-magenta' | 'flash-yellow' | 'flash-white' | 'dark';
const LIGHTNING_FRAMES: [FlickerClass, number][] = [
  ['dark', 140], // beat of dark first — anticipation before the first strike
  ['flash-magenta', 55],
  ['dark', 90],
  ['flash-yellow', 45],
  ['flash-white', 40], // white-hot peak on the double
  ['dark', 340], // pause between strikes
  ['flash-yellow', 50],
  ['dark', 130],
  ['flash-magenta', 40],
  ['flash-white', 45],
  ['flash-yellow', 40], // stutter with a white peak
  ['dark', 420], // longer pause
  ['flash-white', 55],
  ['dark', 100],
  ['flash-magenta', 40],
  ['flash-yellow', 40],
  ['flash-white', 45], // triple stutter
  ['dark', 380], // pause
  ['flash-magenta', 55],
  ['dark', 150],
  ['flash-yellow', 55],
  ['dark', 300], // pause
  ['flash-magenta', 45],
  ['flash-yellow', 50],
  ['dark', 200], // last dark beat before the climax
  ['flash-white', 150], // CLIMAX: a big, sustained white-hot strike, then the warning hits
];

interface Puck {
  id: number;
  x: number; // 0-100, horizontal position %
  exiting?: boolean; // true once the post-crossing delay elapses — plays the fast fade, then removed
}

const RESULT_COPY = {
  success: {
    title: 'The team held',
    blurb: 'You weathered it. No cracks in the armour, the season rolls on as if nothing happened.',
  },
  fail: {
    title: 'Misery awaits',
    blurb: 'Pucks got through. Here we go again, how badly this goes only shows up as the season plays out.',
  },
};

export function MarchCollapseFlow({
  onResolved,
  targetSavePct = 0.905,
}: {
  onResolved: (success: boolean) => void;
  // The save% the player must hold — the selected goalie's, from goalieTargetSavePct.
  // Defaults to a league-ish value for the isolated dev harness (no roster).
  targetSavePct?: number;
}) {
  // Accessibility: a rapid full-screen strobe can trigger photosensitive
  // seizures, so anyone with prefers-reduced-motion set skips the lightning
  // intro entirely and lands straight on the steady, readable warning card.
  const [stage, setStage] = useState<'flicker' | 'hold' | 'playing' | 'result'>(() =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'hold' : 'flicker',
  );
  const [flickerClass, setFlickerClass] = useState<FlickerClass>(LIGHTNING_FRAMES[0][0]);
  const [pucks, setPucks] = useState<Puck[]>([]);
  const [blocked, setBlocked] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS);

  const nextIdRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const nextSpawnRef = useRef(0);
  const missedRef = useRef(0);
  const doneRef = useRef(false);
  const resolvedRef = useRef<Set<number>>(new Set()); // puck ids already counted (block or miss)

  useEffect(() => {
    if (stage !== 'flicker') return;
    let cancelled = false;
    let i = 0;
    function nextFrame() {
      if (cancelled) return;
      const [cls, ms] = LIGHTNING_FRAMES[i];
      setFlickerClass(cls);
      i++;
      const done = i >= LIGHTNING_FRAMES.length;
      setTimeout(() => {
        if (cancelled) return;
        if (done) setStage('hold');
        else nextFrame();
      }, ms);
    }
    nextFrame();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'playing') return;
    startRef.current = performance.now();
    nextSpawnRef.current = 0;
    doneRef.current = false;
    const tick = setInterval(() => {
      const elapsed = performance.now() - startRef.current!;
      const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
      setTimeLeftMs(remaining);
      // Stop spawning once under PUCK_LINE_MS (2s) remain, so the last puck reaches
      // the line right as the game ends — no pucks left falling on the ice.
      if (elapsed >= nextSpawnRef.current && remaining > PUCK_LINE_MS) {
        const t = Math.min(1, elapsed / GAME_DURATION_MS);
        const interval = START_SPAWN_INTERVAL_MS + (END_SPAWN_INTERVAL_MS - START_SPAWN_INTERVAL_MS) * t;
        nextSpawnRef.current = elapsed + interval;
        const id = nextIdRef.current++;
        setPucks((prev) => [...prev, { id, x: 8 + Math.random() * 84 }]);
        // The fall is one continuous animation; this timer fires when the puck
        // reaches the line, marking it a miss (unless it was blocked first).
        setTimeout(() => handleMiss(id), PUCK_LINE_MS);
      }
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(tick);
        setStage('result');
      }
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [stage]);

  // A blocked (clicked) puck is removed at once — no dissolve. Guarded so a block
  // on the same frame as the line-crossing can't double-count.
  function handleBlock(id: number) {
    if (doneRef.current || resolvedRef.current.has(id)) return;
    resolvedRef.current.add(id);
    setBlocked((b) => b + 1);
    setPucks((prev) => prev.filter((p) => p.id !== id));
  }

  // Fires when a puck reaches the goal line (its fall animation ends) — it's beaten
  // the stand, so it keeps moving past the line and dissolves out (see .dissolving).
  // Blocked pucks never reach here; they were already removed.
  function handleMiss(id: number) {
    if (doneRef.current || resolvedRef.current.has(id)) return;
    resolvedRef.current.add(id);
    missedRef.current += 1;
    setMissed(missedRef.current);
    // Keep sliding past the line for a randomized beat, THEN dissolve out quickly.
    const delay = DISSOLVE_DELAY_MIN_MS + Math.round(Math.random() * (DISSOLVE_DELAY_MAX_MS - DISSOLVE_DELAY_MIN_MS));
    setTimeout(() => {
      setPucks((prev) => prev.map((p) => (p.id === id ? { ...p, exiting: true } : p)));
      setTimeout(() => setPucks((prev) => prev.filter((p) => p.id !== id)), DISSOLVE_FADE_MS);
    }, delay);
  }

  if (stage === 'flicker') {
    return <div className={`collapse-warning ${flickerClass}`} />;
  }

  if (stage === 'hold') {
    return (
      <div className="collapse-warning-hold">
        <img className="collapse-warning-octopus" src={collapseOctopusSrc} alt="" />
        <p className="collapse-warning-eyebrow">Defensive breakdown incoming!</p>
        <h2 className="collapse-warning-title">March Collapse</h2>
        <p className="collapse-warning-instructions">
          A stretch of potential disaster hits the {TEAM_NAME}. Tap the incoming pucks before they make it
          to the net, block enough of them and the team avoids any March sadness. Otherwise the season looks
          bleak from here on out.
        </p>
        <button type="button" className="collapse-hold-btn" onClick={() => setStage('playing')}>
          Take the ice
        </button>
      </div>
    );
  }

  if (stage === 'result') {
    const shots = blocked + missed;
    const finalPct = shots > 0 ? blocked / shots : 1;
    const success = finalPct >= targetSavePct;
    const copy = success ? RESULT_COPY.success : RESULT_COPY.fail;
    return (
      <div className="march-collapse rink-backdrop">
        <h2 className="march-collapse-title">March Collapse</h2>
        <p className="trade-deadline-eyebrow">{copy.title}</p>
        <p className="collapse-result-line">
          You finished at <strong className={success ? '' : 'collapse-sv-below'}>{formatSavePct(finalPct)}</strong>
          {' '}· target {formatSavePct(targetSavePct)}
        </p>
        <p className="trade-deadline-prompt">{copy.blurb}</p>
        <button type="button" className="primary-btn" onClick={() => onResolved(success)}>
          Continue the season
        </button>
      </div>
    );
  }

  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const shots = blocked + missed;
  const savePct = shots > 0 ? blocked / shots : 1;
  const belowTarget = savePct < targetSavePct;

  return (
    <div className="march-collapse rink-backdrop collapse-playing">
      <p className="trade-deadline-eyebrow">The Puck Stops Here</p>
      <p className="collapse-instructions">
        Tap or click the pucks to make a save. Maintain your goalie's save percentage to carry you through the
        rest of the regular season.
      </p>
      <div className="collapse-hud">
        <span>⏱ {secondsLeft}s</span>
        <span className={belowTarget ? 'collapse-sv-below' : ''}>SV% {formatSavePct(savePct)}</span>
        <span>Target {formatSavePct(targetSavePct)}</span>
      </div>
      <div className="collapse-arena">
        <div className="collapse-goal">
          <div className="collapse-goal-line" />
          <img className="collapse-net-img" src={collapseNetSrc} alt="" />
        </div>
        {pucks.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`collapse-puck${p.exiting ? ' dissolving' : ''}`}
            style={{
              left: `${p.x}%`,
              animationDuration: `${PUCK_FALL_MS}ms`,
            }}
            onClick={() => handleBlock(p.id)}
            aria-label="Block puck"
          />
        ))}
      </div>
    </div>
  );
}

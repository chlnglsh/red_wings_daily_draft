import { useEffect, useRef, useState } from 'react';
import { TEAM_NAME } from '../data/team';
import collapseOctopusSrc from '../assets/collapse-octopus.png';

// "Defensive Stand": hexagonal pucks come in over a short window and the player
// clicks/taps to block them before they reach the net. Spawn rate ramps up as the
// clock runs down — starts manageable, ends frantic — per spec. Success/failure is
// never shown as a number; only ever surfaces as narrative flavor (see RESULT_COPY).
const GAME_DURATION_MS = 17000;
const START_SPAWN_INTERVAL_MS = 900;
const END_SPAWN_INTERVAL_MS = 320;
const PUCK_LIFESPAN_MS = 2000; // time each puck is on screen before it counts as a miss
const MAX_MISSES = 3; // more than this and the stand fails
const TICK_MS = 80;

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
}

const RESULT_COPY = {
  success: {
    title: '🛡️ Stand held',
    blurb: "You weathered it. No cracks in the armor — the season rolls on as if nothing happened.",
  },
  fail: {
    title: '📉 Stand broke',
    blurb: "Pucks got through late. Your form dips from here on — how bad only shows up as the season plays out.",
  },
};

export function MarchCollapseFlow({ onResolved }: { onResolved: (success: boolean) => void }) {
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
      if (elapsed >= nextSpawnRef.current && remaining > 0) {
        const t = Math.min(1, elapsed / GAME_DURATION_MS);
        const interval = START_SPAWN_INTERVAL_MS + (END_SPAWN_INTERVAL_MS - START_SPAWN_INTERVAL_MS) * t;
        nextSpawnRef.current = elapsed + interval;
        const id = nextIdRef.current++;
        setPucks((prev) => [...prev, { id, x: 8 + Math.random() * 84 }]);
      }
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(tick);
        setStage('result');
      }
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [stage]);

  function handleBlock(id: number) {
    setPucks((prev) => prev.filter((p) => p.id !== id));
    setBlocked((b) => b + 1);
  }

  function handleMiss(id: number) {
    setPucks((prev) => prev.filter((p) => p.id !== id));
    missedRef.current += 1;
    setMissed(missedRef.current);
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
    const success = missed <= MAX_MISSES;
    const copy = success ? RESULT_COPY.success : RESULT_COPY.fail;
    return (
      <div className="march-collapse rink-backdrop">
        <h2 className="march-collapse-title">March Collapse</h2>
        <p className="trade-deadline-eyebrow">{copy.title}</p>
        <p className="trade-deadline-prompt">{copy.blurb}</p>
        <button type="button" className="primary-btn" onClick={() => onResolved(success)}>
          Continue the season
        </button>
      </div>
    );
  }

  const secondsLeft = Math.ceil(timeLeftMs / 1000);

  return (
    <div className="march-collapse rink-backdrop collapse-playing">
      <p className="trade-deadline-eyebrow">Defensive Stand</p>
      <p className="collapse-instructions">Tap the incoming pucks before they beat you clean.</p>
      <div className="collapse-hud">
        <span>⏱ {secondsLeft}s</span>
        <span>🛡 Saved {blocked}</span>
        <span>🥅 Missed {missed}</span>
      </div>
      <div className="collapse-arena">
        {pucks.map((p) => (
          <button
            key={p.id}
            type="button"
            className="collapse-puck"
            style={{ left: `${p.x}%`, animationDuration: `${PUCK_LIFESPAN_MS}ms` }}
            onClick={() => handleBlock(p.id)}
            onAnimationEnd={() => handleMiss(p.id)}
            aria-label="Block puck"
          >
            P
          </button>
        ))}
        <div className="collapse-net" />
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { TEAM_NAME } from '../data/team';

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

// Lightning-style strobe: irregular, decelerating flashes (fast and frantic at
// first, slowing down like a storm passing) rather than an even CSS pulse — then
// holds on a steady, fully readable frame instead of auto-advancing, so the
// warning text actually gets read before the player chooses to proceed.
const FLICKER_COUNT = 10;
const FLICKER_MIN_GAP_MS = 50;
const FLICKER_MAX_GAP_MS = 320;

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
  const [stage, setStage] = useState<'flicker' | 'hold' | 'playing' | 'result'>('flicker');
  const [flashOn, setFlashOn] = useState(true);
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
    let count = 0;
    function nextFlash() {
      if (cancelled) return;
      setFlashOn((on) => !on);
      count++;
      if (count >= FLICKER_COUNT) {
        setStage('hold');
        return;
      }
      // Decelerating gaps — fast/frantic at the start, slowing down like a storm passing.
      const t = FLICKER_MIN_GAP_MS + (FLICKER_MAX_GAP_MS - FLICKER_MIN_GAP_MS) * (count / FLICKER_COUNT);
      setTimeout(nextFlash, t);
    }
    const t = setTimeout(nextFlash, FLICKER_MIN_GAP_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
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
    return <div className={`collapse-warning ${flashOn ? 'flash-magenta' : 'flash-yellow'}`} />;
  }

  if (stage === 'hold') {
    return (
      <div className="collapse-warning-hold">
        <svg className="collapse-warning-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2.5 1.5 21h21L12 2.5Z"
            fill="none"
            stroke="#0a0a0a"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="11.1" y="9" width="1.8" height="6" fill="#0a0a0a" />
          <rect x="11.1" y="16.5" width="1.8" height="1.8" fill="#0a0a0a" />
        </svg>
        <p className="collapse-warning-eyebrow">Defensive breakdown incoming</p>
        <h2 className="collapse-warning-title">March Collapse</h2>
        <p className="collapse-warning-instructions">
          A stretch of hard minutes hits the {TEAM_NAME}. Tap the incoming pucks before they beat you clean,
          block enough of them and the stand holds.
        </p>
        <button type="button" className="collapse-hold-btn" onClick={() => setStage('playing')}>
          Take the ice →
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
          Continue the season →
        </button>
      </div>
    );
  }

  const secondsLeft = Math.ceil(timeLeftMs / 1000);

  return (
    <div className="march-collapse rink-backdrop">
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

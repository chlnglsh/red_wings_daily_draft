import { useCallback, useEffect, useRef, useState } from 'react';
import { TEAM } from '../teams/current';
import type { FightOutcome, FightVariant } from '../lib/hockeyFight';

// Hockey Fight minigame shell: intro hype card, then one of three skill minigames,
// then a graded result. The outcome is never shown as a number — only as narrative
// flavor here and, later, in the season game log. Upside-only: a loss is neutral,
// never a penalty (see lib/hockeyFight.ts).
//
// Which minigame plays is chosen upstream by the daily seed (variant 0/1/2). Only the
// tug-of-war (variant 0) is built so far; variants 1 and 2 fall back to it until they
// land, so a real sim never hits an empty screen.

const RESULT_COPY: Record<FightOutcome, { title: string; body: string }> = {
  win: {
    title: 'Statement sent',
    body: 'You won the scrap and the whole bench is on its feet. That energy carries into the next few games.',
  },
  tie: {
    title: 'Even scrap',
    body: 'Nobody clearly won it, but a good fight still lifts the room. A little momentum into the next game.',
  },
  loss: {
    title: 'Took the worst of it',
    body: 'You came out on the wrong end. No harm to the season, but no spark either. Back to business.',
  },
};

export function HockeyFightFlow({
  variant,
  opponent = 'Rivals',
  onResolved,
}: {
  variant: FightVariant;
  // The opposing team the scrap is against — the in-progress game's opponent. Falls
  // back to a generic label for the isolated dev entry, where there's no live game.
  opponent?: string;
  onResolved: (outcome: FightOutcome) => void;
}) {
  const [stage, setStage] = useState<'intro' | 'playing' | 'result'>('intro');
  const [outcome, setOutcome] = useState<FightOutcome | null>(null);

  const handleFinish = useCallback((result: FightOutcome) => {
    setOutcome(result);
    setStage('result');
  }, []);

  if (stage === 'intro') {
    return (
      <div className="fight-flow">
        <div className="fight-intro">
          <p className="fight-eyebrow">Tempers boil over</p>
          <h2 className="fight-title">Drop the gloves</h2>
          <p className="fight-intro-sub">
            A scrap breaks out against the {opponent}. Win it and the bench gets fired up for the games ahead.
          </p>
          <div className="fight-matchup">
            <span className="fight-fighter you">{TEAM.identity.name}</span>
            <span className="fight-vs">vs.</span>
            <span className="fight-fighter rival">{opponent}</span>
          </div>
          <button type="button" className="primary-btn" onClick={() => setStage('playing')}>
            Square up
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'result' && outcome) {
    const copy = RESULT_COPY[outcome];
    return (
      <div className="fight-flow">
        <div className={`fight-result ${outcome}`}>
          <h2 className="fight-result-title">{copy.title}</h2>
          <p className="fight-result-body">{copy.body}</p>
          <button type="button" className="primary-btn" onClick={() => onResolved(outcome)}>
            Back to the season
          </button>
        </div>
      </div>
    );
  }

  // Which minigame plays is chosen upstream by the daily seed. All three are drafts.
  if (variant === 1) return <PunchTimingFight opponent={opponent} onFinish={handleFinish} />;
  if (variant === 2) return <DodgeCounterFight opponent={opponent} onFinish={handleFinish} />;
  return <TugOfWarFight opponent={opponent} onFinish={handleFinish} />;
}

// ---- Variant 0: tug-of-war grapple ---------------------------------------------
// A meter between the two fighters. Mash to pull it toward your side against a
// steady opposing drag; where it lands at time-up maps to the outcome. Reaching a
// side outright ends it early (a pin), so a dominant mash pays off immediately.

const MATCH_MS = 15000;
const TICK_MS = 50;
const OPP_PULL = 0.6; // meter points the opponent drags back per tick
const TAP_GAIN = 3.4; // meter points a single pull adds
const START_POS = 50;
const WIN_ZONE = 70; // >= this at time-up (or reaching 100) = win
const TIE_ZONE = 40; // >= this but below WIN_ZONE = tie; below = loss

function outcomeForPos(pos: number): FightOutcome {
  if (pos >= WIN_ZONE) return 'win';
  if (pos >= TIE_ZONE) return 'tie';
  return 'loss';
}

function TugOfWarFight({ opponent, onFinish }: { opponent: string; onFinish: (outcome: FightOutcome) => void }) {
  const [pos, setPos] = useState(START_POS);
  const [timeLeftMs, setTimeLeftMs] = useState(MATCH_MS);
  const posRef = useRef(START_POS);
  const doneRef = useRef(false);

  const finish = useCallback(
    (finalPos: number) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onFinish(outcomeForPos(finalPos));
    },
    [onFinish],
  );

  // Opponent drag + clock. Position and time are tracked in refs so the end-of-bout
  // checks (which call the parent's finish) run in the interval body rather than
  // inside a setState updater — updaters must stay pure. Reaching either extreme, or
  // the clock running out, ends the bout.
  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      if (doneRef.current) return;
      const remaining = Math.max(0, MATCH_MS - (Date.now() - start));
      posRef.current = Math.max(0, posRef.current - OPP_PULL);
      setPos(posRef.current);
      setTimeLeftMs(remaining);
      if (posRef.current <= 0) {
        clearInterval(tick);
        finish(0);
      } else if (remaining <= 0) {
        clearInterval(tick);
        finish(posRef.current);
      }
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [finish]);

  const pull = useCallback(() => {
    if (doneRef.current) return;
    posRef.current = Math.min(100, posRef.current + TAP_GAIN);
    setPos(posRef.current);
    if (posRef.current >= 100) finish(100);
  }, [finish]);

  // Spacebar / enter as a desktop convenience alongside tapping the button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        pull();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pull]);

  const secondsLeft = Math.ceil(timeLeftMs / 1000);

  return (
    <div className="fight-flow">
      <div className="fight-arena">
        <div className="fight-clock">{secondsLeft}</div>
        <div className="fight-meter">
          <div className="fight-meter-zone loss" style={{ width: `${TIE_ZONE}%` }} />
          <div className="fight-meter-zone tie" style={{ left: `${TIE_ZONE}%`, width: `${WIN_ZONE - TIE_ZONE}%` }} />
          <div className="fight-meter-zone win" style={{ left: `${WIN_ZONE}%`, width: `${100 - WIN_ZONE}%` }} />
          <div className="fight-meter-marker" style={{ left: `${pos}%` }} />
        </div>
        <div className="fight-meter-ends">
          <span className="fight-fighter rival">{opponent}</span>
          <span className="fight-fighter you">{TEAM.identity.name}</span>
        </div>
        <button type="button" className="fight-pull-btn" onPointerDown={(e) => { e.preventDefault(); pull(); }}>
          Pull
        </button>
        <p className="fight-hint">Mash to pull the fight your way</p>
      </div>
    </div>
  );
}

// ---- Variant 1: punch timing / rhythm ------------------------------------------
// A marker sweeps back and forth across a bar; a target window sits somewhere on it.
// Land your punch (tap) while the marker is inside it — dead centre (the bright core)
// scores a "perfect" worth double, the rest of the window a normal hit. Each punch is
// on a shot clock: let it run out and it's a miss, on to the next. The sweep speeds up
// and the target shrinks every round, so it ramps from easy to frantic. The graded
// score across all punches maps to the outcome.

const PUNCH_ROUNDS = 5;
const PUNCH_TICK_MS = 20;
const PUNCH_CLOCK_MS = 3200; // shot clock per punch before it times out as a miss
// Sweep speed (marker % per tick) ramps up each round: slow at first, frantic by the end.
const PUNCH_SWEEP_BASE = 1.3;
const PUNCH_SWEEP_RAMP = 0.42;
// Target window shrinks each round.
const PUNCH_WIDTH_START = 30;
const PUNCH_WIDTH_SHRINK = 4;
const PUNCH_CORE_FRACTION = 0.34; // bright centre worth a "perfect", as a fraction of the window
const PUNCH_SCORE_PERFECT = 2;
const PUNCH_SCORE_HIT = 1;
const PUNCH_WIN_SCORE = 7; // >= this = win (max is PUNCH_ROUNDS * PERFECT = 10)
const PUNCH_TIE_SCORE = 4; // >= this (but below win) = tie; fewer = loss

const punchSweepStep = (round: number) => PUNCH_SWEEP_BASE + round * PUNCH_SWEEP_RAMP;
const punchWidth = (round: number) => PUNCH_WIDTH_START - round * PUNCH_WIDTH_SHRINK;
const randomTargetStart = (width: number) => Math.random() * (100 - width);

function PunchTimingFight({ opponent, onFinish }: { opponent: string; onFinish: (outcome: FightOutcome) => void }) {
  const [pos, setPos] = useState(0);
  const [width, setWidth] = useState(() => punchWidth(0));
  const [target, setTarget] = useState(() => randomTargetStart(punchWidth(0)));
  const [thrown, setThrown] = useState(0);
  const [clockPct, setClockPct] = useState(100);
  const [flash, setFlash] = useState<'perfect' | 'hit' | 'miss' | null>(null);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const targetRef = useRef(target);
  const widthRef = useRef(width);
  const scoreRef = useRef(0);
  const thrownRef = useRef(0);
  const doneRef = useRef(false);
  const roundResolvedRef = useRef(false);
  const clockStartRef = useRef(Date.now());

  // Set up the next round: new (shrinking) target window and a fresh shot clock.
  const startRound = useCallback(() => {
    const r = thrownRef.current;
    const w = punchWidth(r);
    widthRef.current = w;
    setWidth(w);
    const t = randomTargetStart(w);
    targetRef.current = t;
    setTarget(t);
    clockStartRef.current = Date.now();
    setClockPct(100);
    roundResolvedRef.current = false;
  }, []);

  // Bank a round (a scored punch or a timed-out miss), then advance or finish.
  const resolveRound = useCallback(
    (delta: number, feedback: 'perfect' | 'hit' | 'miss') => {
      if (doneRef.current || roundResolvedRef.current) return;
      roundResolvedRef.current = true;
      scoreRef.current += delta;
      setFlash(feedback);
      window.setTimeout(() => setFlash(null), 240);
      thrownRef.current += 1;
      setThrown(thrownRef.current);
      if (thrownRef.current >= PUNCH_ROUNDS) {
        doneRef.current = true;
        const s = scoreRef.current;
        const outcome: FightOutcome = s >= PUNCH_WIN_SCORE ? 'win' : s >= PUNCH_TIE_SCORE ? 'tie' : 'loss';
        window.setTimeout(() => onFinish(outcome), 450);
      } else {
        window.setTimeout(startRound, 260);
      }
    },
    [onFinish, startRound],
  );

  const punch = useCallback(() => {
    if (doneRef.current || roundResolvedRef.current) return;
    const p = posRef.current;
    const t = targetRef.current;
    const w = widthRef.current;
    const inGreen = p >= t && p <= t + w;
    const center = t + w / 2;
    const inCore = Math.abs(p - center) <= (w * PUNCH_CORE_FRACTION) / 2;
    if (inCore) resolveRound(PUNCH_SCORE_PERFECT, 'perfect');
    else if (inGreen) resolveRound(PUNCH_SCORE_HIT, 'hit');
    else resolveRound(0, 'miss');
  }, [resolveRound]);

  // Marker sweep (ping-pong, speeding up each round) plus the shot-clock countdown.
  useEffect(() => {
    const tick = setInterval(() => {
      if (doneRef.current) return;
      const step = punchSweepStep(thrownRef.current);
      let next = posRef.current + dirRef.current * step;
      if (next >= 100) {
        next = 100;
        dirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
      }
      posRef.current = next;
      setPos(next);
      if (!roundResolvedRef.current) {
        const pct = Math.max(0, 100 - ((Date.now() - clockStartRef.current) / PUNCH_CLOCK_MS) * 100);
        setClockPct(pct);
        if (pct <= 0) resolveRound(0, 'miss');
      }
    }, PUNCH_TICK_MS);
    return () => clearInterval(tick);
  }, [resolveRound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        punch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [punch]);

  return (
    <div className="fight-flow">
      <div className="fight-arena">
        <div className="fight-punch-count">Punch {Math.min(thrown + 1, PUNCH_ROUNDS)} of {PUNCH_ROUNDS}</div>
        <div className={`fight-shotclock${clockPct <= 34 ? ' low' : ''}`}>
          {Math.max(0, (clockPct / 100) * (PUNCH_CLOCK_MS / 1000)).toFixed(1)}
        </div>
        <div className="fight-meter fight-punch-bar">
          <div className="fight-punch-target" style={{ left: `${target}%`, width: `${width}%` }} />
          <div className="fight-meter-marker" style={{ left: `${pos}%`, transition: 'none' }} />
        </div>
        <div className="fight-meter-ends">
          <span className="fight-fighter you">{TEAM.identity.name}</span>
          <span className="fight-fighter rival">{opponent}</span>
        </div>
        <div className={`fight-flash ${flash ?? ''}`}>{flash === 'perfect' ? 'Perfect!' : flash === 'hit' ? 'Clean hit' : flash === 'miss' ? 'Whiff' : ' '}</div>
        <button type="button" className="fight-pull-btn fight-punch-btn" onPointerDown={(e) => { e.preventDefault(); punch(); }}>
          Punch
        </button>
        <p className="fight-hint">Tap in the target, dead centre counts for more</p>
      </div>
    </div>
  );
}

// ---- Variant 2: dodge and counter (rhythm / falling notes) ----------------------
// DDR / Guitar Hero style: arrows fall down four lanes toward a hit line near the
// bottom. Tap the lane (or press the arrow key) as a note reaches the line — dead-on
// timing scores a "perfect", close scores a "good", and letting a note fall past the
// line is a miss. The graded score across all notes maps to the outcome.

const DDR_TOTAL = 8; // notes in the run
const DDR_TICK_MS = 30;
const DDR_NOTE_SPEED = 1.6; // % of the lane a note falls per tick
const DDR_SPAWN_MS = 900; // gap between note spawns
const DDR_HIT_Y = 78; // where the hit line sits, in % down the lane
const DDR_HIT_WINDOW = 15; // +/- band around the line that still counts as a hit
const DDR_PERFECT_BAND = 6; // +/- band around the line that scores a perfect
const DDR_SCORE_PERFECT = 2;
const DDR_SCORE_GOOD = 1;
const DDR_WIN_SCORE = 10; // >= this = win (max is DDR_TOTAL * PERFECT = 16)
const DDR_TIE_SCORE = 5; // >= this (but below win) = tie; fewer = loss
const DDR_LANES = ['left', 'down', 'up', 'right'] as const;
type DodgeDir = (typeof DDR_LANES)[number];
const DODGE_ARROWS: Record<DodgeDir, string> = { left: '←', down: '↓', up: '↑', right: '→' };

type FallingNote = { id: number; dir: DodgeDir; y: number };

function DodgeCounterFight({ onFinish }: { opponent: string; onFinish: (outcome: FightOutcome) => void }) {
  const [notes, setNotes] = useState<FallingNote[]>([]);
  const [resolved, setResolved] = useState(0);
  const [laneFlash, setLaneFlash] = useState<Partial<Record<DodgeDir, 'perfect' | 'good' | 'miss'>>>({});
  const notesRef = useRef<FallingNote[]>([]);
  const idRef = useRef(0);
  const spawnedRef = useRef(0);
  const resolvedRef = useRef(0);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  const lastSpawnRef = useRef(0);

  const flashLane = useCallback((dir: DodgeDir, type: 'perfect' | 'good' | 'miss') => {
    setLaneFlash((prev) => ({ ...prev, [dir]: type }));
    window.setTimeout(() => setLaneFlash((prev) => ({ ...prev, [dir]: undefined })), 220);
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const s = scoreRef.current;
    const outcome: FightOutcome = s >= DDR_WIN_SCORE ? 'win' : s >= DDR_TIE_SCORE ? 'tie' : 'loss';
    window.setTimeout(() => onFinish(outcome), 500);
  }, [onFinish]);

  // Falling-note engine: spawn on a cadence, advance every note, and miss any that
  // fall past the hit window. Runs until every note has been spawned and resolved.
  useEffect(() => {
    const start = Date.now();
    lastSpawnRef.current = -DDR_SPAWN_MS; // spawn one right away
    const tick = setInterval(() => {
      if (doneRef.current) return;
      const now = Date.now() - start;
      if (spawnedRef.current < DDR_TOTAL && now - lastSpawnRef.current >= DDR_SPAWN_MS) {
        lastSpawnRef.current = now;
        spawnedRef.current += 1;
        const dir = DDR_LANES[Math.floor(Math.random() * DDR_LANES.length)];
        notesRef.current = [...notesRef.current, { id: idRef.current++, dir, y: 0 }];
      }
      const kept: FallingNote[] = [];
      for (const n of notesRef.current) {
        const y = n.y + DDR_NOTE_SPEED;
        if (y > DDR_HIT_Y + DDR_HIT_WINDOW) {
          resolvedRef.current += 1;
          setResolved(resolvedRef.current);
          flashLane(n.dir, 'miss');
        } else {
          kept.push({ ...n, y });
        }
      }
      notesRef.current = kept;
      setNotes(kept);
      if (spawnedRef.current >= DDR_TOTAL && resolvedRef.current >= DDR_TOTAL) {
        clearInterval(tick);
        finish();
      }
    }, DDR_TICK_MS);
    return () => clearInterval(tick);
  }, [finish, flashLane]);

  const hit = useCallback(
    (dir: DodgeDir) => {
      if (doneRef.current) return;
      let best: FallingNote | null = null;
      let bestDist = Infinity;
      for (const n of notesRef.current) {
        if (n.dir !== dir) continue;
        const dist = Math.abs(n.y - DDR_HIT_Y);
        if (dist <= DDR_HIT_WINDOW && dist < bestDist) {
          best = n;
          bestDist = dist;
        }
      }
      if (!best) {
        flashLane(dir, 'miss'); // stray tap: no note in range, no score change
        return;
      }
      const perfect = bestDist <= DDR_PERFECT_BAND;
      scoreRef.current += perfect ? DDR_SCORE_PERFECT : DDR_SCORE_GOOD;
      resolvedRef.current += 1;
      setResolved(resolvedRef.current);
      const hitId = best.id;
      notesRef.current = notesRef.current.filter((n) => n.id !== hitId);
      setNotes(notesRef.current);
      flashLane(dir, perfect ? 'perfect' : 'good');
      if (spawnedRef.current >= DDR_TOTAL && resolvedRef.current >= DDR_TOTAL) finish();
    },
    [finish, flashLane],
  );

  // Arrow keys alongside tapping the lanes.
  useEffect(() => {
    const map: Record<string, DodgeDir> = { ArrowLeft: 'left', ArrowDown: 'down', ArrowUp: 'up', ArrowRight: 'right' };
    const onKey = (e: KeyboardEvent) => {
      const g = map[e.code];
      if (g) {
        e.preventDefault();
        hit(g);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hit]);

  return (
    <div className="fight-flow">
      <div className="fight-arena fight-ddr">
        <div className="fight-punch-count">Notes {Math.min(resolved + 1, DDR_TOTAL)} of {DDR_TOTAL}</div>
        <div className="fight-ddr-lanes">
          <div className="fight-ddr-hitline" style={{ top: `${DDR_HIT_Y}%` }} />
          {DDR_LANES.map((lane) => (
            <button
              key={lane}
              type="button"
              className={`fight-ddr-lane ${laneFlash[lane] ?? ''}`}
              onPointerDown={(e) => { e.preventDefault(); hit(lane); }}
            >
              <span className="fight-ddr-receptor" style={{ top: `${DDR_HIT_Y}%` }}>{DODGE_ARROWS[lane]}</span>
              {notes.filter((n) => n.dir === lane).map((n) => (
                <span key={n.id} className="fight-ddr-note" style={{ top: `${n.y}%` }}>{DODGE_ARROWS[lane]}</span>
              ))}
            </button>
          ))}
        </div>
        <p className="fight-hint">Tap the lane as its arrow hits the line</p>
      </div>
    </div>
  );
}

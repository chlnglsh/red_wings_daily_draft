import { useEffect, useState } from 'react';
import type { Season } from '../types';

// Slot-machine-style cycling: rapid random seasons that decelerate and land on
// the real pick. spinToken is bumped by the caller on every round advance and
// every reroll so the effect retriggers even if the final season repeats.
const SPIN_TICKS = 9;
const START_DELAY_MS = 70;
const DELAY_GROWTH = 1.32;

export function useSpinAnimation(finalSeason: Season, spinToken: number, pool: Season[]) {
  const [displaySeason, setDisplaySeason] = useState(finalSeason);
  const [spinning, setSpinning] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let step = 0;
    let delay = START_DELAY_MS;
    setSpinning(true);

    function next() {
      if (cancelled) return;
      if (step >= SPIN_TICKS) {
        setDisplaySeason(finalSeason);
        setTick((t) => t + 1);
        setSpinning(false);
        return;
      }
      const random = pool[Math.floor(Math.random() * pool.length)];
      setDisplaySeason(random);
      setTick((t) => t + 1);
      step += 1;
      delay = Math.round(delay * DELAY_GROWTH);
      timer = setTimeout(next, delay);
    }

    let timer = setTimeout(next, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // finalSeason/pool are captured fresh each time spinToken changes, which is
    // the only signal that should restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken]);

  return { displaySeason, spinning, tick };
}

import { useEffect, useRef, useState } from 'react';

// Slot-machine-style cycling: rapid random items that decelerate and land on
// the real pick. spinToken is bumped by the caller whenever the animation
// should retrigger, even if the final item repeats. Generic over T so both
// the season-roll (draft) and trade-type-roll (trade deadline) spins share
// this same cycling logic.
const SPIN_TICKS = 9;
const START_DELAY_MS = 70;
const DELAY_GROWTH = 1.32;

export function useSpinAnimation<T>(
  finalItem: T,
  spinToken: number,
  pool: T[],
  options?: {
    // Default true: the draft's spin is meant to play immediately whenever
    // RoundScreen mounts (a new round). Trade deadline's spin instead needs
    // to stay idle until the user actually clicks "Enter the trade market" —
    // without this, the very first effect run (on mount, before any click)
    // plays the whole animation silently against the initial spinToken, so
    // by the time the real click bumps spinToken, `spinning` has already
    // long since settled back to false.
    active?: boolean;
    // Fires the instant this animation's own reveal finishes — not something
    // callers should try to infer by watching `spinning` from outside: state
    // updates from this effect land in a later commit, so a separate effect
    // watching `spinning` reads a stale value in the same commit the
    // animation (re)starts in and can react to it immediately, believing a
    // brand new spin already finished before it visibly began.
    onComplete?: () => void;
  },
) {
  const active = options?.active ?? true;
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;

  const [displayItem, setDisplayItem] = useState(finalItem);
  const [spinning, setSpinning] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) {
      setDisplayItem(finalItem);
      setSpinning(false);
      return;
    }
    let cancelled = false;
    let step = 0;
    let delay = START_DELAY_MS;
    setSpinning(true);

    function next() {
      if (cancelled) return;
      if (step >= SPIN_TICKS) {
        setDisplayItem(finalItem);
        setTick((t) => t + 1);
        setSpinning(false);
        onCompleteRef.current?.();
        return;
      }
      const random = pool[Math.floor(Math.random() * pool.length)];
      setDisplayItem(random);
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
    // finalItem/pool are captured fresh each time spinToken/active changes,
    // which is the only signal that should restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken, active]);

  return { displayItem, spinning, tick };
}

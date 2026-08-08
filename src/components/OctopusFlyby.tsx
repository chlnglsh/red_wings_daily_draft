import { useEffect, useRef } from 'react';
import octopusSrc from '../assets/octopus.png';

// Legend of the Octopus — real Red Wings playoff folklore (it once took 8 wins to
// win the Cup, hence the tradition). Purely atmospheric: no effect on win
// probability or scoring, and per the spec, no depiction of who's throwing it —
// real fans do that in real life, not a fixed character — just the octopus
// itself, in flight. Round 1 flies left to right, the Final flies right to
// left — the image is mirrored via CSS either way.
// Keep in sync with the animation-duration on .octopus-flyby-sprite in App.css.
const FLIGHT_MS = 1600;

export function OctopusFlyby({ direction, onComplete }: { direction: 'ltr' | 'rtl'; onComplete: () => void }) {
  // Caller passes an inline arrow (`onComplete={() => setOctopusMoment(null)}`),
  // a fresh reference on every one of its renders — which fire every ~90ms while
  // the game clock ticks. Depending the timer effect on `onComplete` directly
  // reset the timeout on each of those renders, so it never survived the full
  // 1800ms uninterrupted — the flyby never completed, permanently stuck the
  // caller's octopusMoment state, and blocked every game after this one. The ref
  // lets the timer be set up once on mount while still calling the latest
  // onComplete whenever it actually fires.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const t = setTimeout(() => onCompleteRef.current(), FLIGHT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="octopus-flyby" aria-hidden="true">
      <div className={`octopus-flyby-sprite${direction === 'ltr' ? ' ltr' : ''}`}>
        <img className="octopus-flyby-img" src={octopusSrc} alt="" />
      </div>
    </div>
  );
}

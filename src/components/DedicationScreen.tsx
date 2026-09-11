import { useEffect, useRef } from 'react';

// A team's dedication card, shown once between "Start" and the first spin: the
// image fades in, holds, then fades out, and the draft begins. The timing lives
// in the .dedication-banner animation in App.css; TOTAL_MS mirrors its duration.
const TOTAL_MS = 5600;

export function DedicationScreen({ src, alt, onDone }: { src: string; alt: string; onDone: () => void }) {
  // Ref so the timer is armed once on mount and still calls the latest onDone.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), TOTAL_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="dedication-screen" role="status" aria-live="polite">
      <img className="dedication-banner" src={src} alt={alt} />
    </div>
  );
}

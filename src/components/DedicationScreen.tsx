import { useEffect, useRef } from 'react';

// A team's dedication card, shown once between "Start" and the first spin: the
// image fades in (0.5s), holds (1.5s), fades out (0.8s), and the draft begins. The
// timing lives in the .dedication-banner animation in App.css; TOTAL_MS mirrors it.
const TOTAL_MS = 2800;

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

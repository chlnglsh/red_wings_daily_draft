import { useEffect, useRef } from 'react';

// A team's dedication card, shown once between "Start" and the first spin: the
// image fades in (0.4s), holds (0.8s), fades out (0.64s), and the draft begins. The
// timing lives in the .dedication-banner animation in App.css; TOTAL_MS mirrors it.
const TOTAL_MS = 1840;

export function DedicationScreen({ src, srcLight, alt, onDone }: { src: string; srcLight?: string; alt: string; onDone: () => void }) {
  // Ref so the timer is armed once on mount and still calls the latest onDone.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), TOTAL_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="dedication-screen" role="status" aria-live="polite">
      {/* The page follows the device color scheme, so the light variant is picked by media query. */}
      <picture>
        {srcLight && <source media="(prefers-color-scheme: light)" srcSet={srcLight} />}
        <img className="dedication-banner" src={src} alt={alt} />
      </picture>
    </div>
  );
}

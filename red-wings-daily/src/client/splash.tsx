import './app/index.css';
import './app/App.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TEAM_NAME, SUBREDDIT } from './app/data/team';
import slotMachineSrc from './app/assets/lucky-red-slot-machine.png';

export const Splash = () => {
  // SUBREDDIT (data/team.ts) is just this build's dev-time default — a real
  // Reddit install could be on any subreddit, so fetch the actual one this
  // post is running in and swap it in once it resolves.
  const [subreddit, setSubreddit] = useState(SUBREDDIT);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/results/subreddit')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.subreddit) setSubreddit(data.subreddit);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="intro">
        <p className="intro-eyebrow">r/{subreddit}</p>
        <h1 className="intro-title">{TEAM_NAME} Daily Draft</h1>
        <p className="intro-sub">
          Spin six real {TEAM_NAME} seasons, draft a starting six, and see where you land on today's
          leaderboard.
        </p>
        <p className="intro-sub">
          Play against other users in the subreddit once a day to see how you stack up. Come back
          tomorrow to make another attempt for the Stanley Cup!
        </p>
        <img className="intro-slot-machine" src={slotMachineSrc} alt="" />
        <button
          type="button"
          className="primary-btn"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        >
          Tap to start today's draft
        </button>
      </header>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);

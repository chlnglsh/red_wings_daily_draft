import { useEffect, useMemo, useRef, useState } from 'react';
import type { DraftPick, Season, SeasonEra } from '../types';
import { rosterScore } from '../lib/scoring';
import { hashStringToInt } from '../lib/prng';
import {
  deriveWinPct,
  simulateSeason,
  REGULATION_END,
  type GameResult,
  type SeasonSimResult,
  type WeightedSkater,
} from '../lib/gameSim';

const TICKS_PER_GAME = 14;
const VISIBLE_COMPLETED_NORMAL = 6;
const VISIBLE_COMPLETED_FAST = 14;
const FAST_GAME_MS = 150; // how long each game sits in the fast-scroll feed before the next one lands

// Pace for the normal (live, detailed) mode. Fast mode skips the live clock
// entirely — see the fast-scroll effect below — so it doesn't need its own pace.
const PACE = { tickMs: 90, startPauseMs: 500, otSuspenseMs: 1300, endPauseMs: 1300 };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function majorityEra(picks: DraftPick[], seasonsById: Map<string, Season>): SeasonEra {
  const counts = new Map<SeasonEra, number>();
  for (const pick of picks) {
    const era = seasonsById.get(pick.seasonId)?.era;
    if (!era) continue;
    counts.set(era, (counts.get(era) ?? 0) + 1);
  }
  let best: SeasonEra = 'yzermanOnward';
  let bestCount = 0;
  for (const [era, count] of counts) {
    if (count > bestCount) {
      best = era;
      bestCount = count;
    }
  }
  return best;
}

function gameLine(game: GameResult): string {
  // Shootouts still show as "(OT)" — this game's choice, not standard box-score convention.
  const tag = game.decidedIn === 'REG' ? '' : ' (OT)';
  return `${game.teamGoals}-${game.oppGoals}${tag}`;
}

export function SeasonSimScreen({
  picks,
  seasonsById,
  runSeed,
  onComplete,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  runSeed: number;
  onComplete: (result: SeasonSimResult) => void;
}) {
  const fullResult = useMemo(() => {
    const score = rosterScore(picks, seasonsById);
    const winPct = deriveWinPct(score);
    const era = majorityEra(picks, seasonsById);
    const skaters: WeightedSkater[] = picks
      .filter((p) => p.player.position !== 'G')
      .map((p) => ({ name: p.player.name, weight: p.player.g }));
    const seed = hashStringToInt(`${runSeed}:simseason:${picks.map((p) => p.player.id + p.slot).join(',')}`);
    return simulateSeason(seed, winPct, era, skaters);
  }, [picks, seasonsById, runSeed]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [otSuspense, setOtSuspense] = useState(false);
  const [completedGames, setCompletedGames] = useState<GameResult[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [fast, setFast] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const currentGame = fullResult.games[currentIndex] ?? null;

  // Reset the live clock whenever we move to a new game, regardless of which mode got us here.
  useEffect(() => {
    setCurrentMinute(0);
    setOtSuspense(false);
  }, [currentIndex]);

  // Only fade the feed's top/bottom edge when there's more content to scroll
  // past it — otherwise the gradient permanently obscures whichever game is
  // sitting right at the edge even when nothing is hidden behind it.
  function updateEdgeClasses(el: HTMLDivElement | null) {
    if (!el) return;
    el.classList.toggle('at-top', el.scrollTop <= 1);
    el.classList.toggle('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }

  useEffect(() => {
    updateEdgeClasses(feedRef.current);
  });

  // Normal mode: live per-game clock. Ticks through regulation, then — if the game
  // went to OT/SO — holds at the OT marker for a beat before revealing the decider,
  // so there's actually some suspense instead of the bar just sailing past 60'.
  useEffect(() => {
    if (skipped || fast || !currentGame) return;
    let cancelled = false;

    async function play() {
      await sleep(PACE.startPauseMs);
      const step = REGULATION_END / TICKS_PER_GAME;
      let m = 0;
      while (m < REGULATION_END && !cancelled) {
        m = Math.min(REGULATION_END, m + step);
        setCurrentMinute(m);
        await sleep(PACE.tickMs);
      }
      if (cancelled) return;
      if (currentGame.endMinute > REGULATION_END) {
        setOtSuspense(true);
        await sleep(PACE.otSuspenseMs);
        if (cancelled) return;
        setOtSuspense(false);
        setCurrentMinute(currentGame.endMinute);
      }
      await sleep(PACE.endPauseMs);
      if (cancelled) return;
      setCompletedGames((prev) => [...prev, currentGame]);
      setCurrentIndex((i) => i + 1);
    }
    play();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentGame, skipped, fast]);

  // Fast mode: no live theater, just bank finished games one after another quickly.
  useEffect(() => {
    if (skipped || !fast || !currentGame) return;
    const t = setTimeout(() => {
      setCompletedGames((prev) => [...prev, currentGame]);
      setCurrentIndex((i) => i + 1);
    }, FAST_GAME_MS);
    return () => clearTimeout(t);
  }, [currentIndex, currentGame, skipped, fast]);

  useEffect(() => {
    if (currentIndex >= fullResult.games.length) {
      const t = setTimeout(() => onComplete(fullResult), 400);
      return () => clearTimeout(t);
    }
  }, [currentIndex, fullResult, onComplete]);

  function handleSkip() {
    setSkipped(true);
    setCompletedGames(fullResult.games);
    setCurrentIndex(fullResult.games.length);
  }

  const tally = completedGames.reduce(
    (acc, g) => {
      if (g.result === 'W') acc.wins++;
      else if (g.decidedIn !== 'REG') acc.otl++;
      else acc.losses++;
      acc.gf += g.teamGoals;
      acc.ga += g.oppGoals;
      return acc;
    },
    { wins: 0, losses: 0, otl: 0, gf: 0, ga: 0 },
  );
  const points = tally.wins * 2 + tally.otl;

  const liveGoals = currentGame ? currentGame.goalEvents.filter((e) => e.minute <= currentMinute) : [];
  const liveOppGoals = currentGame ? currentGame.oppGoalEvents.filter((e) => e.minute <= currentMinute) : [];
  const progressPct = currentGame ? (currentMinute / currentGame.endMinute) * 100 : 100;
  const goesToExtra = currentGame ? currentGame.endMinute > REGULATION_END : false;
  const visibleCompleted = fast ? VISIBLE_COMPLETED_FAST : VISIBLE_COMPLETED_NORMAL;
  const recentCompleted = completedGames.slice(-visibleCompleted).reverse();

  return (
    <div className="season-sim rink-backdrop">
      <div className="season-sim-header">
        <span className="season-sim-game-count">
          Game {Math.min(currentIndex + 1, fullResult.games.length)} of {fullResult.games.length}
        </span>
        <div className="season-sim-header-actions">
          {!skipped && (
            <button type="button" className="sim-action-btn" onClick={() => setFast((f) => !f)}>
              {fast ? '🐢 Normal speed' : '⏩ Speed up'}
            </button>
          )}
          <button type="button" className="sim-action-btn" onClick={handleSkip}>
            Skip to end →
          </button>
        </div>
      </div>

      <div className="season-sim-tally">
        <div>
          <strong>{tally.wins}</strong>
          <span>W</span>
        </div>
        <div>
          <strong>{tally.losses}</strong>
          <span>L</span>
        </div>
        <div>
          <strong>{tally.otl}</strong>
          <span>OTL</span>
        </div>
        <div>
          <strong>{points}</strong>
          <span>PTS</span>
        </div>
        <div>
          <strong>
            {tally.gf}-{tally.ga}
          </strong>
          <span>GF-GA</span>
        </div>
      </div>

      {!fast && currentGame && (
        <div className="season-sim-live">
          <div className="season-sim-live-header">
            <span>
              vs {currentGame.opponent} {currentGame.home ? '(H)' : '(A)'}
            </span>
            <span className="season-sim-live-score">
              {liveGoals.length}-{liveOppGoals.length}
            </span>
          </div>
          <div className="season-sim-progress-track">
            <div className="season-sim-progress-fill" style={{ width: `${progressPct}%` }} />
            <div className="season-sim-progress-tick" style={{ left: '33.333%' }} />
            <div className="season-sim-progress-tick" style={{ left: '66.667%' }} />
          </div>
          <div className="season-sim-progress-labels">
            <span>0'</span>
            <span>20'</span>
            <span>40'</span>
            <span>{goesToExtra ? 'OT' : "60'"}</span>
          </div>
          {otSuspense && <div className="season-sim-ot-suspense">⏳ Overtime… anybody's game</div>}
          <div className="season-sim-goals">
            {liveGoals.length === 0 && liveOppGoals.length === 0 && (
              <span className="season-sim-goals-empty">Scoreless so far…</span>
            )}
            <div className="season-sim-goals-col">
              <span className="season-sim-goals-col-header">Red Wings</span>
              {liveGoals.map((g, i) => (
                <div key={i} className="season-sim-goal-line">
                  🚨 {g.scorer ?? 'Red Wings'} <span className="season-sim-goal-time">{g.label}</span>
                </div>
              ))}
            </div>
            <div className="season-sim-goals-col opp">
              <span className="season-sim-goals-col-header">{currentGame.opponent}</span>
              {liveOppGoals.map((g, i) => (
                <div key={i} className="season-sim-goal-line">
                  <span className="season-sim-goal-time">{g.label}</span> 🥅
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        className={`season-sim-feed${fast ? ' fast' : ''}`}
        ref={feedRef}
        onScroll={(e) => updateEdgeClasses(e.currentTarget)}
      >
        {recentCompleted.map((g) => (
          <div key={g.gameNumber} className="season-sim-game">
            <span className={`season-sim-result ${g.result === 'W' ? 'win' : 'loss'}`}>{g.result}</span>
            <span className="season-sim-opponent">
              G{g.gameNumber} vs {g.opponent} {g.home ? '(H)' : '(A)'}
            </span>
            <span className="season-sim-score">{gameLine(g)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

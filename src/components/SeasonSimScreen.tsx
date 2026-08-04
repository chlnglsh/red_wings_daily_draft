import { useEffect, useMemo, useRef, useState } from 'react';
import type { DraftPick, Season } from '../types';
import { hashStringToInt, mulberry32 } from '../lib/prng';
import { deriveRosterGameState } from '../lib/rosterState';
import {
  simulateGamesInRange,
  aggregateGames,
  buildScorerPicker,
  REGULATION_END,
  SEASON_LENGTH,
  type GameResult,
  type SeasonSimResult,
} from '../lib/gameSim';
import { TradeDeadlineFlow } from './TradeDeadlineFlow';

const TICKS_PER_GAME = 14;
const VISIBLE_COMPLETED_NORMAL = 6;
const VISIBLE_COMPLETED_FAST = 14;
const FAST_GAME_MS = 150; // how long each game sits in the fast-scroll feed before the next one lands

// Real NHL trade deadline lands around game 60-63 of 82 — games 1 through this
// constant minus one play out first, then the deadline gate appears before the rest.
const TRADE_DEADLINE_GAME = 61;

// Pace for the normal (live, detailed) mode. Fast mode skips the live clock
// entirely — see the fast-scroll effect below — so it doesn't need its own pace.
const PACE = { tickMs: 90, startPauseMs: 500, otSuspenseMs: 1300, endPauseMs: 1300 };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gameLine(game: GameResult): string {
  // Shootouts still show as "(OT)" — this game's choice, not standard box-score convention.
  const tag = game.decidedIn === 'REG' ? '' : ' (OT)';
  return `${game.teamGoals}-${game.oppGoals}${tag}`;
}

export function SeasonSimScreen({
  picks,
  seasonsById,
  seasons,
  runSeed,
  onComplete,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  seasons: Season[];
  runSeed: number;
  onComplete: (result: SeasonSimResult, finalPicks: DraftPick[]) => void;
}) {
  // One persistent RNG for the whole day's sim — shared across the pre-trade and
  // post-trade halves so the overall sequence is a single continuous deterministic
  // stream regardless of what happens at the deadline.
  const rngRef = useRef<(() => number) | null>(null);
  if (!rngRef.current) {
    rngRef.current = mulberry32(hashStringToInt(`${runSeed}:simseason:${picks.map((p) => p.player.id + p.slot).join(',')}`));
  }

  const initialRosterState = useMemo(() => deriveRosterGameState(picks, seasonsById), [picks, seasonsById]);

  // Games 1 through the deadline, from the roster as drafted — computed once on mount.
  const preTradeGames = useMemo(() => {
    const pickScorer = buildScorerPicker(initialRosterState.skaters, rngRef.current!);
    return simulateGamesInRange({
      rng: rngRef.current!,
      pickScorer,
      startGame: 1,
      endGame: TRADE_DEADLINE_GAME - 1,
      baseWinPct: initialRosterState.winPct,
      era: initialRosterState.era,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentPicks, setCurrentPicks] = useState(picks);
  const [postTradeGames, setPostTradeGames] = useState<GameResult[] | null>(null);
  const [tradeStage, setTradeStage] = useState<'pending' | 'active' | 'resolved'>('pending');

  const allGames = useMemo(() => (postTradeGames ? [...preTradeGames, ...postTradeGames] : preTradeGames), [preTradeGames, postTradeGames]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [otSuspense, setOtSuspense] = useState(false);
  const [completedGames, setCompletedGames] = useState<GameResult[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [fast, setFast] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const currentGame = allGames[currentIndex] ?? null;
  const atDeadline = currentIndex >= preTradeGames.length && !postTradeGames;

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

  function generatePostTradeGames(finalPicks: DraftPick[]): GameResult[] {
    const rosterState = deriveRosterGameState(finalPicks, seasonsById);
    const pickScorer = buildScorerPicker(rosterState.skaters, rngRef.current!);
    return simulateGamesInRange({
      rng: rngRef.current!,
      pickScorer,
      startGame: TRADE_DEADLINE_GAME,
      endGame: SEASON_LENGTH,
      baseWinPct: rosterState.winPct,
      era: rosterState.era,
    });
  }

  function handleTradeResolved(finalPicks: DraftPick[]) {
    setCurrentPicks(finalPicks);
    setPostTradeGames(generatePostTradeGames(finalPicks));
    setTradeStage('resolved');
  }

  // Normal mode: live per-game clock. Ticks through regulation, then — if the game
  // went to OT/SO — holds at the OT marker for a beat before revealing the decider,
  // so there's actually some suspense instead of the bar just sailing past 60'.
  useEffect(() => {
    if (skipped || fast || atDeadline) return;
    if (atDeadline || !currentGame) return;
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
      if (currentGame!.endMinute > REGULATION_END) {
        setOtSuspense(true);
        await sleep(PACE.otSuspenseMs);
        if (cancelled) return;
        setOtSuspense(false);
        setCurrentMinute(currentGame!.endMinute);
      }
      await sleep(PACE.endPauseMs);
      if (cancelled) return;
      setCompletedGames((prev) => [...prev, currentGame!]);
      setCurrentIndex((i) => i + 1);
    }
    play();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentGame, skipped, fast, atDeadline]);

  // Fast mode: no live theater, just bank finished games one after another quickly.
  useEffect(() => {
    if (skipped || !fast || atDeadline || !currentGame) return;
    const t = setTimeout(() => {
      setCompletedGames((prev) => [...prev, currentGame]);
      setCurrentIndex((i) => i + 1);
    }, FAST_GAME_MS);
    return () => clearTimeout(t);
  }, [currentIndex, currentGame, skipped, fast, atDeadline]);

  // Reaching the end of the pre-trade half pauses for the deadline gate instead of
  // trying to animate a game that doesn't exist yet.
  useEffect(() => {
    if (atDeadline && tradeStage === 'pending') {
      setTradeStage('active');
    }
  }, [atDeadline, tradeStage]);

  useEffect(() => {
    if (currentIndex >= SEASON_LENGTH && postTradeGames) {
      const t = setTimeout(() => onComplete(aggregateGames(allGames), currentPicks), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, postTradeGames, allGames, currentPicks, onComplete]);

  function handleSkip() {
    setSkipped(true);
    // Skipping past an unresolved trade decision defaults to standing pat, so the
    // whole season can still resolve instantly instead of forcing the player through it.
    const finalGames = postTradeGames ? allGames : [...preTradeGames, ...generatePostTradeGames(currentPicks)];
    setPostTradeGames(finalGames.slice(preTradeGames.length));
    setTradeStage('resolved');
    setCompletedGames(finalGames);
    setCurrentIndex(finalGames.length);
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

  if (tradeStage === 'active') {
    return (
      <TradeDeadlineFlow
        tally={{ wins: tally.wins, losses: tally.losses, otl: tally.otl, points, goalsFor: tally.gf, goalsAgainst: tally.ga }}
        picks={currentPicks}
        seasonsById={seasonsById}
        seasons={seasons}
        rng={rngRef.current!}
        onResolved={handleTradeResolved}
      />
    );
  }

  const liveGoals = currentGame ? currentGame.goalEvents.filter((e) => e.minute <= currentMinute) : [];
  const liveOppGoals = currentGame ? currentGame.oppGoalEvents.filter((e) => e.minute <= currentMinute) : [];
  const progressPct = currentGame ? (currentMinute / currentGame.endMinute) * 100 : 100;
  const goesToExtra = currentGame ? currentGame.endMinute > REGULATION_END : false;
  const visibleCompleted = fast ? VISIBLE_COMPLETED_FAST : VISIBLE_COMPLETED_NORMAL;
  const recentCompleted = completedGames.slice(-visibleCompleted).reverse();
  const totalGames = postTradeGames ? SEASON_LENGTH : Math.max(SEASON_LENGTH, preTradeGames.length);

  return (
    <div className="season-sim rink-backdrop">
      <div className="season-sim-header">
        <span className="season-sim-game-count">
          Game {Math.min(currentIndex + 1, totalGames)} of {SEASON_LENGTH}
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

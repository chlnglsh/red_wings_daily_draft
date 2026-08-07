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
import { MARCH_COLLAPSE_GAME, isMarchCollapseDay, isMarchCollapsePlay, buildCollapsePenaltyModifier } from '../lib/marchCollapse';
import { goalieTargetSavePct } from '../lib/goalie';
import { TEAM_NAME, HAS_MARCH_COLLAPSE, HAS_TRADE_DEADLINE } from '../data/team';
import { mascotOnly } from '../data/nhlAlignment';
import { TradeDeadlineFlow } from './TradeDeadlineFlow';
import { MarchCollapseFlow } from './MarchCollapseFlow';

const TICKS_PER_GAME = 14;
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
  dateSeed,
  sharedDailyCollapse = false,
  forceMarchCollapse = false,
  devSkipToDeadline = false,
  reduceFlashing = false,
  onComplete,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  seasons: Season[];
  runSeed: number;
  dateSeed: number;
  // Which March Collapse cadence to use: true = shared daily roll (Reddit build),
  // false = per-playthrough roll (standalone). Mirrors Platform.sharedDailyEvents.
  sharedDailyCollapse?: boolean;
  // Dev-only: force the March Collapse event to fire this run regardless of the roll.
  forceMarchCollapse?: boolean;
  // Dev-only: skip straight to the trade deadline gate instead of playing games 1-60.
  devSkipToDeadline?: boolean;
  // Player opted out of flashing on the splash screen — forwarded to the March
  // Collapse intro so it skips the lightning flicker.
  reduceFlashing?: boolean;
  onComplete: (result: SeasonSimResult, finalPicks: DraftPick[]) => void;
}) {
  // One persistent RNG for the whole day's sim — shared across every segment
  // (pre-trade, post-trade, post-collapse) so the overall sequence is a single
  // continuous deterministic stream regardless of how many pause points break it up.
  const rngRef = useRef<(() => number) | null>(null);
  if (!rngRef.current) {
    rngRef.current = mulberry32(hashStringToInt(`${runSeed}:simseason:${picks.map((p) => p.player.id + p.slot).join(',')}`));
  }

  // Does March Collapse fire this run? Cadence depends on the build: a Reddit
  // build uses a subreddit-wide daily roll (dateSeed — same day for everyone),
  // while a standalone build rolls per playthrough (runSeed — fresh each play), so
  // a repeat player hits it ~1 in 8 runs instead of waiting on the calendar. Gated
  // on HAS_MARCH_COLLAPSE so a reskinned build never fires it; when off, this stays
  // false and every collapse-aware branch below falls back to the plain two-segment sim.
  const isCollapseDay = useMemo(
    () =>
      HAS_MARCH_COLLAPSE &&
      (forceMarchCollapse ||
        (sharedDailyCollapse ? isMarchCollapseDay(dateSeed) : isMarchCollapsePlay(runSeed))),
    [forceMarchCollapse, sharedDailyCollapse, dateSeed, runSeed],
  );

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
  const [midGames, setMidGames] = useState<GameResult[] | null>(null);
  const [finalGames, setFinalGames] = useState<GameResult[] | null>(null);
  const [tradeStage, setTradeStage] = useState<'pending' | 'active' | 'resolved'>('pending');
  const [collapseStage, setCollapseStage] = useState<'pending' | 'active' | 'resolved'>(isCollapseDay ? 'pending' : 'resolved');

  const allGames = useMemo(
    () => [...preTradeGames, ...(midGames ?? []), ...(finalGames ?? [])],
    [preTradeGames, midGames, finalGames],
  );

  const [currentIndex, setCurrentIndex] = useState(devSkipToDeadline ? preTradeGames.length : 0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [otSuspense, setOtSuspense] = useState(false);
  const [completedGames, setCompletedGames] = useState<GameResult[]>(devSkipToDeadline ? preTradeGames : []);
  const [skipped, setSkipped] = useState(false);
  const [fast, setFast] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const currentGame = allGames[currentIndex] ?? null;
  const atDeadline = currentIndex >= preTradeGames.length && !midGames;
  const atCollapse = isCollapseDay && !!midGames && currentIndex >= preTradeGames.length + midGames.length && !finalGames;
  const liveFeedWrapRef = useRef<HTMLDivElement | null>(null);
  const [feedTop, setFeedTop] = useState(0);
  // Explicit height (not auto) once sticky: constrains the feed to whatever
  // room is actually left below the card, so overflow-y: auto (already on the
  // base rule) can genuinely engage and the user can scroll to reach past
  // games the card would otherwise just sit on top of and hide — scrolling
  // can't reveal content that's covered by a separate opaque sibling, only
  // content clipped by the feed's own overflow.
  const [feedHeight, setFeedHeight] = useState<number | undefined>(undefined);
  // No live card in fast mode (see the !fast && currentGame render check below),
  // so the feed has nothing to stick to there — normal flow instead.
  const stickyToCard = !fast && !!currentGame;

  // Reset the live clock whenever we move to a new game, regardless of which mode got us here.
  useEffect(() => {
    setCurrentMinute(0);
    setOtSuspense(false);
  }, [currentIndex]);

  // Keeps the completed-games feed pinned just below the live card's bottom
  // edge as it grows, and constrains it to whatever room is actually left in
  // the fixed-height frame — so instead of spilling up behind the card (which
  // scrolling can't reach, since it's a separate opaque sibling, not clipped
  // overflow), it scrolls internally within that space. Measured (not
  // guessed) because the card's height depends on real game content (goal
  // count, OT) that changes live.
  useEffect(() => {
    const wrapEl = liveFeedWrapRef.current;
    const feedEl = feedRef.current;
    if (!stickyToCard || !wrapEl || !feedEl) {
      setFeedTop(0);
      setFeedHeight(undefined);
      return;
    }
    const cardEl = wrapEl.querySelector<HTMLElement>('.season-sim-live');
    if (!cardEl) {
      setFeedTop(0);
      setFeedHeight(undefined);
      return;
    }
    const recompute = () => {
      const wrapH = wrapEl.clientHeight;
      const cardH = cardEl.offsetHeight;
      // Match the feed's own row-to-row gap so the card-to-first-game gap looks
      // the same as the gap between any two games, rather than sitting flush.
      const rowGap = parseFloat(getComputedStyle(feedEl).rowGap) || 0;
      const top = Math.min(cardH + rowGap, wrapH);
      setFeedTop(top);
      setFeedHeight(Math.max(0, wrapH - top));
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(cardEl);
    observer.observe(wrapEl);
    return () => observer.disconnect();
  }, [stickyToCard, currentGame]);

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

  // Games from the trade deadline up to either the season's end (no collapse today)
  // or the collapse pause point — the roster is fixed for this whole stretch.
  function generateMidGames(finalPicks: DraftPick[]): GameResult[] {
    const rosterState = deriveRosterGameState(finalPicks, seasonsById);
    const pickScorer = buildScorerPicker(rosterState.skaters, rngRef.current!);
    return simulateGamesInRange({
      rng: rngRef.current!,
      pickScorer,
      startGame: TRADE_DEADLINE_GAME,
      endGame: isCollapseDay ? MARCH_COLLAPSE_GAME - 1 : SEASON_LENGTH,
      baseWinPct: rosterState.winPct,
      era: rosterState.era,
    });
  }

  // Games from the collapse point to the end of the season — same roster, but a
  // failed stand drags win% down for the rest of the stretch via modifierForGame.
  function generateFinalGames(success: boolean): GameResult[] {
    const rosterState = deriveRosterGameState(currentPicks, seasonsById);
    const pickScorer = buildScorerPicker(rosterState.skaters, rngRef.current!);
    return simulateGamesInRange({
      rng: rngRef.current!,
      pickScorer,
      startGame: MARCH_COLLAPSE_GAME,
      endGame: SEASON_LENGTH,
      baseWinPct: rosterState.winPct,
      era: rosterState.era,
      modifierForGame: success ? undefined : buildCollapsePenaltyModifier(MARCH_COLLAPSE_GAME),
    });
  }

  function handleTradeResolved(finalPicks: DraftPick[]) {
    setCurrentPicks(finalPicks);
    setMidGames(generateMidGames(finalPicks));
    setTradeStage('resolved');
  }

  function handleCollapseResolved(success: boolean) {
    setFinalGames(generateFinalGames(success));
    setCollapseStage('resolved');
  }

  // Normal mode: live per-game clock. Ticks through regulation, then — if the game
  // went to OT/SO — holds at the OT marker for a beat before revealing the decider,
  // so there's actually some suspense instead of the bar just sailing past 60'.
  useEffect(() => {
    if (skipped || fast || atDeadline || atCollapse) return;
    if (!currentGame) return;
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
    void play();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentGame, skipped, fast, atDeadline, atCollapse]);

  // Fast mode: no live theater, just bank finished games one after another quickly.
  useEffect(() => {
    if (skipped || !fast || atDeadline || atCollapse || !currentGame) return;
    const t = setTimeout(() => {
      setCompletedGames((prev) => [...prev, currentGame]);
      setCurrentIndex((i) => i + 1);
    }, FAST_GAME_MS);
    return () => clearTimeout(t);
  }, [currentIndex, currentGame, skipped, fast, atDeadline, atCollapse]);

  // Reaching the end of the pre-trade half pauses for the deadline gate instead of
  // trying to animate a game that doesn't exist yet. When the Trade Deadline is
  // turned off for this build, there's no gate to show — auto-resolve with the
  // drafted roster so the stretch run generates and play continues uninterrupted,
  // exactly as if the player had stood pat.
  useEffect(() => {
    if (atDeadline && tradeStage === 'pending') {
      if (HAS_TRADE_DEADLINE) {
        setTradeStage('active');
      } else {
        handleTradeResolved(currentPicks);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atDeadline, tradeStage]);

  // Same pattern for the collapse pause point, on days it's scheduled to fire.
  useEffect(() => {
    if (atCollapse && collapseStage === 'pending') {
      setCollapseStage('active');
    }
  }, [atCollapse, collapseStage]);

  useEffect(() => {
    const seasonDone = isCollapseDay ? finalGames !== null : midGames !== null;
    if (currentIndex >= SEASON_LENGTH && seasonDone) {
      const t = setTimeout(() => onComplete(aggregateGames(allGames), currentPicks), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, midGames, finalGames, isCollapseDay, allGames, currentPicks, onComplete]);

  function handleSkip() {
    setSkipped(true);
    // Skipping past an unresolved trade decision defaults to standing pat, and an
    // unresolved collapse defaults to a failed stand (you didn't defend) — so the
    // whole season can still resolve instantly instead of forcing the player through it.
    const mid = midGames ?? generateMidGames(currentPicks);
    const final = isCollapseDay ? (finalGames ?? generateFinalGames(false)) : [];
    const allResolved = [...preTradeGames, ...mid, ...final];
    setMidGames(mid);
    if (isCollapseDay) setFinalGames(final);
    setTradeStage('resolved');
    setCollapseStage('resolved');
    setCompletedGames(allResolved);
    setCurrentIndex(allResolved.length);
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

  if (collapseStage === 'active') {
    const goalie = currentPicks.find((p) => p.player.position === 'G');
    const targetSavePct = goalie ? goalieTargetSavePct(goalie.player) : undefined;
    return (
      <MarchCollapseFlow
        targetSavePct={targetSavePct}
        reduceFlashing={reduceFlashing}
        onResolved={handleCollapseResolved}
      />
    );
  }

  const liveGoals = currentGame ? currentGame.goalEvents.filter((e) => e.minute <= currentMinute) : [];
  const liveOppGoals = currentGame ? currentGame.oppGoalEvents.filter((e) => e.minute <= currentMinute) : [];
  const progressPct = currentGame ? (currentMinute / currentGame.endMinute) * 100 : 100;
  const goesToExtra = currentGame ? currentGame.endMinute > REGULATION_END : false;
  // Fast mode's ticker still caps at a recent window (it's a scrolling feed with
  // no live card to dock a genuinely scrollable list under). The normal/live-card
  // feed is now real-scroll (see the feedHeight effect below), so there's no
  // reason to cap it — show the whole season's history, scrollable.
  const recentCompleted = fast ? completedGames.slice(-VISIBLE_COMPLETED_FAST).reverse() : [...completedGames].reverse();
  const totalGames = SEASON_LENGTH;

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
            Skip to end
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

      <div className="season-sim-live-feed" ref={liveFeedWrapRef}>
        <div
          className={`season-sim-feed${fast ? ' fast' : ''}${stickyToCard ? ' sticky-to-card' : ''}`}
          ref={feedRef}
          style={stickyToCard ? { top: feedTop, height: feedHeight } : undefined}
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
            <div className={`season-sim-ot-suspense${otSuspense ? '' : ' hidden'}`}>⏳ Overtime… anybody's game</div>
            <div className="season-sim-goals">
              {liveGoals.length === 0 && liveOppGoals.length === 0 && (
                <span className="season-sim-goals-empty">Scoreless so far…</span>
              )}
              <div className="season-sim-goals-col">
                <span className="season-sim-goals-col-header">{TEAM_NAME}</span>
                {liveGoals.map((g, i) => (
                  <div key={i} className="season-sim-goal-line">
                    🚨 {g.scorer ?? TEAM_NAME} <span className="season-sim-goal-time">{g.label}</span>
                  </div>
                ))}
              </div>
              <div className="season-sim-goals-col opp">
                <span className="season-sim-goals-col-header">{mascotOnly(currentGame.opponent)}</span>
                {liveOppGoals.map((g, i) => (
                  <div key={i} className="season-sim-goal-line">
                    <span className="season-sim-goal-time">{g.label}</span> 🥅
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

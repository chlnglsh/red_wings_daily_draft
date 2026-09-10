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
import {
  isHockeyFightDay,
  isHockeyFightPlay,
  hockeyFightGame,
  hockeyFightMinute,
  hockeyFightVariant,
  buildFightBoostModifier,
  type FightOutcome,
} from '../lib/hockeyFight';
import { TEAM } from '../teams/current';
import { mascotOnly } from '../data/nhlAlignment';
import { TradeDeadlineFlow } from './TradeDeadlineFlow';
import { HockeyFightFlow } from './HockeyFightFlow';

// The team's late-season pause-point event (Detroit: March Collapse), if it has one.
// Everything "collapse"-named below is that slot — the naming predates the registry.
const lateSeasonEvent = TEAM.events.lateSeason;

const TICKS_PER_GAME = 14;
const VISIBLE_COMPLETED_FAST = 14;
const FAST_GAME_MS = 150; // how long each game sits in the fast-scroll feed before the next one lands

// Real NHL trade deadline lands around game 60-63 — games 1 through this constant
// minus one play out first, then the deadline gate appears before the rest. Kept at
// 61 for the 84-game season (the extra games were added at the start of the calendar,
// so game 61 still lands around the real early-March deadline); revisit against the
// real 2026-27 schedule.
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
  forceHockeyFight = false,
  devSkipToDeadline = false,
  reduceFlashing = false,
  frontOfficeModifier = 0,
  onComplete,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  seasons: Season[];
  runSeed: number;
  dateSeed: number;
  // Which in-season-event cadence to use: true = shared daily roll (Reddit build),
  // false = per-playthrough roll (standalone). Mirrors Platform.sharedDailyEvents and
  // drives both March Collapse and Hockey Fight.
  sharedDailyCollapse?: boolean;
  // Dev-only: force the late-season event to fire this run regardless of the roll.
  forceMarchCollapse?: boolean;
  // Dev-only: force the Hockey Fight event to fire this run regardless of the roll.
  forceHockeyFight?: boolean;
  // Dev-only: skip straight to the trade deadline gate instead of playing games 1-60.
  devSkipToDeadline?: boolean;
  // Player opted out of flashing on the splash screen — forwarded to the late-season
  // event's intro so it skips any flicker.
  reduceFlashing?: boolean;
  // Flat season-long win% nudge from the GM/Coach roll (already summed). Added to the
  // base win% of every game segment; 0 when the feature is off.
  frontOfficeModifier?: number;
  onComplete: (result: SeasonSimResult, finalPicks: DraftPick[]) => void;
}) {
  // One persistent RNG for the whole day's sim — shared across every segment
  // (pre-trade, post-trade, post-collapse) so the overall sequence is a single
  // continuous deterministic stream regardless of how many pause points break it up.
  const rngRef = useRef<(() => number) | null>(null);
  if (!rngRef.current) {
    rngRef.current = mulberry32(hashStringToInt(`${runSeed}:simseason:${picks.map((p) => p.player.id + p.slot).join(',')}`));
  }

  // Does the late-season event fire this run? Cadence depends on the build: a Reddit
  // build uses a subreddit-wide daily roll (dateSeed — same day for everyone),
  // while a standalone build rolls per playthrough (runSeed — fresh each play), so
  // a repeat player hits it on its own odds instead of waiting on the calendar. A
  // team with no such event never fires it; then this stays false and every
  // collapse-aware branch below falls back to the plain two-segment sim.
  const isCollapseDay = useMemo(
    () =>
      !!lateSeasonEvent &&
      (forceMarchCollapse ||
        (sharedDailyCollapse ? lateSeasonEvent.firesOnDay(dateSeed) : lateSeasonEvent.firesOnPlay(runSeed))),
    [forceMarchCollapse, sharedDailyCollapse, dateSeed, runSeed],
  );

  // Does a Hockey Fight fire this run? Same dual cadence as the collapse (shared
  // daily roll on Reddit, per-playthrough roll standalone). Suppressed under
  // devSkipToDeadline, which fabricates a jump straight to the deadline gate and so
  // would skip past a first-half fight anyway. When off, fightStage stays 'resolved'
  // and every fight-aware branch falls back to the plain pre-trade block.
  const fightSeed = sharedDailyCollapse ? dateSeed : runSeed;
  const isFightDay = useMemo(
    () =>
      !devSkipToDeadline &&
      // Dev force bypasses the hockeyFight feature flag so the WIP feature can be
      // exercised while it stays off for real players; the natural roll stays gated.
      (forceHockeyFight ||
        (TEAM.features.hockeyFight &&
          (sharedDailyCollapse ? isHockeyFightDay(dateSeed) : isHockeyFightPlay(runSeed)))),
    [forceHockeyFight, sharedDailyCollapse, dateSeed, runSeed, devSkipToDeadline],
  );
  // The game the fight fires at (6-41), the minute within that game it breaks out at,
  // and which minigame variant shows — all derived from the same seed the roll used so
  // a Reddit day is identical for everyone.
  const fightGame = useMemo(() => hockeyFightGame(fightSeed), [fightSeed]);
  const fightMinute = useMemo(() => hockeyFightMinute(fightSeed), [fightSeed]);
  const fightVariant = useMemo(() => hockeyFightVariant(fightSeed), [fightSeed]);

  const initialRosterState = useMemo(() => deriveRosterGameState(picks, seasonsById), [picks, seasonsById]);

  // Games 1 through the fight game (inclusive) on a fight day, else games 1 through the
  // deadline — all from the roster as drafted, computed once on mount. The fight game
  // is pre-generated here (not lazily) because the scrap interrupts it mid-clock: its
  // opponent becomes the challenger and its outcome is already fixed, so only the games
  // *after* it (postFightGames) carry the win% boost, generated lazily once the fight
  // resolves.
  const preFightGames = useMemo(() => {
    const pickScorer = buildScorerPicker(initialRosterState.skaters, rngRef.current!);
    return simulateGamesInRange({
      rng: rngRef.current!,
      pickScorer,
      startGame: 1,
      endGame: isFightDay ? fightGame : TRADE_DEADLINE_GAME - 1,
      baseWinPct: initialRosterState.winPct + frontOfficeModifier,
      opponentPool: initialRosterState.rivals,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Index of the fight game within allGames (its last pre-fight game). -1 off a fight day.
  const fightGameIndex = isFightDay ? preFightGames.length - 1 : -1;

  const [currentPicks, setCurrentPicks] = useState(picks);
  const [postFightGames, setPostFightGames] = useState<GameResult[] | null>(null);
  const [midGames, setMidGames] = useState<GameResult[] | null>(null);
  const [finalGames, setFinalGames] = useState<GameResult[] | null>(null);
  const [fightStage, setFightStage] = useState<'pending' | 'active' | 'resolved'>(isFightDay ? 'pending' : 'resolved');
  const [tradeStage, setTradeStage] = useState<'pending' | 'active' | 'resolved'>('pending');
  const [collapseStage, setCollapseStage] = useState<'pending' | 'active' | 'resolved'>(isCollapseDay ? 'pending' : 'resolved');

  const allGames = useMemo(
    () => [...preFightGames, ...(postFightGames ?? []), ...(midGames ?? []), ...(finalGames ?? [])],
    [preFightGames, postFightGames, midGames, finalGames],
  );

  // Combined length of the pre-trade half (pre-fight + post-fight). On a non-fight
  // run postFightGames stays null and this is just preFightGames (games 1-60).
  const preTradeLen = preFightGames.length + (postFightGames?.length ?? 0);
  const fightResolved = !isFightDay || postFightGames !== null;

  const [currentIndex, setCurrentIndex] = useState(devSkipToDeadline ? preFightGames.length : 0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [otSuspense, setOtSuspense] = useState(false);
  const [completedGames, setCompletedGames] = useState<GameResult[]>(devSkipToDeadline ? preFightGames : []);
  const [skipped, setSkipped] = useState(false);
  const [fast, setFast] = useState(false);
  // Skip confirmation: null = no dialog. 'beforeDeadline' = a trade deadline is
  // still ahead (skipping stands pat there); 'eventsAhead' = past the deadline but
  // another in-season event (March Collapse) is still pending. When nothing is
  // pending, Skip just runs — no dialog.
  const [skipDialog, setSkipDialog] = useState<'beforeDeadline' | 'eventsAhead' | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  // When the fight freezes the live clock mid-game, the minute to resume that game
  // from is stashed here so the play loop picks up where it left off (instead of
  // restarting the clock at 0'). null = normal game start.
  const fightResumeMinuteRef = useRef<number | null>(null);

  const currentGame = allGames[currentIndex] ?? null;
  const fightActive = fightStage === 'active';
  // The fight interrupts its game mid-clock, so the deadline pause must wait until the
  // fight has resolved (and postFightGames generated) — otherwise both first-half
  // pauses could read as reached at once.
  const atDeadline = fightResolved && currentIndex >= preTradeLen && !midGames;
  const atCollapse = isCollapseDay && !!midGames && currentIndex >= preTradeLen + midGames.length && !finalGames;
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

  // Games from just after the fight game up to the trade deadline — same drafted
  // roster as the pre-fight stretch (the fight happens before any trade). The fight
  // outcome applies a short flat win% boost to the next 1 (tie) or 3 (win) games via
  // modifierForGame, starting the game *after* the scrap (the fight game itself is
  // already fixed in preFightGames). A loss adds no modifier (upside-only).
  function generatePostFightGames(outcome: FightOutcome): GameResult[] {
    const boostStart = fightGame + 1;
    const rosterState = deriveRosterGameState(currentPicks, seasonsById);
    const pickScorer = buildScorerPicker(rosterState.skaters, rngRef.current!);
    return simulateGamesInRange({
      rng: rngRef.current!,
      pickScorer,
      startGame: boostStart,
      endGame: TRADE_DEADLINE_GAME - 1,
      baseWinPct: rosterState.winPct + frontOfficeModifier,
      opponentPool: rosterState.rivals,
      modifierForGame: buildFightBoostModifier(boostStart, outcome),
    });
  }

  // Games from the trade deadline up to either the season's end (no collapse today)
  // or the collapse pause point — the roster is fixed for this whole stretch.
  function generateMidGames(finalPicks: DraftPick[]): GameResult[] {
    const rosterState = deriveRosterGameState(finalPicks, seasonsById);
    const pickScorer = buildScorerPicker(rosterState.skaters, rngRef.current!);
    return simulateGamesInRange({
      rng: rngRef.current!,
      pickScorer,
      startGame: TRADE_DEADLINE_GAME,
      endGame: isCollapseDay ? lateSeasonEvent!.game - 1 : SEASON_LENGTH,
      baseWinPct: rosterState.winPct + frontOfficeModifier,
      opponentPool: rosterState.rivals,
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
      startGame: lateSeasonEvent!.game,
      endGame: SEASON_LENGTH,
      baseWinPct: rosterState.winPct + frontOfficeModifier,
      opponentPool: rosterState.rivals,
      modifierForGame: lateSeasonEvent!.modifierForOutcome(success),
    });
  }

  function handleFightResolved(outcome: FightOutcome) {
    setPostFightGames(generatePostFightGames(outcome));
    setFightStage('resolved');
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
    if (skipped || fast || atDeadline || atCollapse || fightActive) return;
    if (!currentGame) return;
    let cancelled = false;
    // On a fight day, this game's clock freezes at fightMinute until the scrap is
    // resolved; once resolved we resume it from that minute rather than replaying it.
    const isFightGameNow = isFightDay && currentIndex === fightGameIndex;

    async function play() {
      const step = REGULATION_END / TICKS_PER_GAME;
      // Resume mid-game after the fight, or start a fresh game from 0'.
      let m = 0;
      if (fightResumeMinuteRef.current !== null) {
        m = fightResumeMinuteRef.current;
        fightResumeMinuteRef.current = null;
      } else {
        await sleep(PACE.startPauseMs);
      }
      while (m < REGULATION_END && !cancelled) {
        // The scrap breaks out mid-clock: freeze here and hand off to the minigame.
        if (isFightGameNow && fightStage === 'pending' && m >= fightMinute) {
          setCurrentMinute(fightMinute);
          fightResumeMinuteRef.current = fightMinute;
          setFightStage('active');
          return;
        }
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
  }, [currentIndex, currentGame, skipped, fast, atDeadline, atCollapse, fightActive, fightStage]);

  // Fast mode: no live theater, just bank finished games one after another quickly.
  // The fight has no live clock here, so it fires as its game comes up (at the edge)
  // rather than mid-clock; once resolved, that game banks normally.
  useEffect(() => {
    if (skipped || !fast || atDeadline || atCollapse || fightActive || !currentGame) return;
    if (isFightDay && fightStage === 'pending' && currentIndex === fightGameIndex) {
      setFightStage('active');
      return;
    }
    const t = setTimeout(() => {
      setCompletedGames((prev) => [...prev, currentGame]);
      setCurrentIndex((i) => i + 1);
    }, FAST_GAME_MS);
    return () => clearTimeout(t);
  }, [currentIndex, currentGame, skipped, fast, atDeadline, atCollapse, fightActive, fightStage]);

  // Reaching the end of the pre-trade half pauses for the deadline gate instead of
  // trying to animate a game that doesn't exist yet. When the Trade Deadline is
  // turned off for this build, there's no gate to show — auto-resolve with the
  // drafted roster so the stretch run generates and play continues uninterrupted,
  // exactly as if the player had stood pat.
  useEffect(() => {
    if (atDeadline && tradeStage === 'pending') {
      if (TEAM.features.tradeDeadline) {
        setTradeStage('active');
      } else {
        handleTradeResolved(currentPicks);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atDeadline, tradeStage]);

  // The fight is activated inline by the live/fast play effects above when its game's
  // clock reaches fightMinute (live) or that game comes up (fast) — no separate
  // pause-point effect is needed, since the scrap interrupts a game rather than
  // sitting in the gap between two games like the deadline and collapse do.

  // Same pattern for the collapse pause point, on days it's scheduled to fire.
  useEffect(() => {
    if (atCollapse && collapseStage === 'pending') {
      setCollapseStage('active');
    }
  }, [atCollapse, collapseStage]);

  useEffect(() => {
    const seasonDone = isCollapseDay ? finalGames !== null : midGames !== null;
    if (currentIndex >= SEASON_LENGTH && seasonDone) {
      // Hold on the finished game list for a beat so the final result can be read
      // before the screen advances — applies to every path (live, sped-up, skipped),
      // since they all land here once currentIndex reaches the season length.
      const t = setTimeout(() => onComplete(aggregateGames(allGames), currentPicks), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, midGames, finalGames, isCollapseDay, allGames, currentPicks, onComplete]);

  // Gate the Skip button behind a confirmation only when skipping would actually
  // bypass a pending event. A trade deadline still ahead defaults to standing pat;
  // any other in-season event (currently March Collapse) still pending would be
  // forfeited. Nothing pending → skip straight away with no dialog.
  function requestSkip() {
    const tradeAhead = TEAM.features.tradeDeadline && tradeStage === 'pending';
    const otherEventsAhead = collapseStage === 'pending' || fightStage === 'pending';
    if (tradeAhead) setSkipDialog('beforeDeadline');
    else if (otherEventsAhead) setSkipDialog('eventsAhead');
    else handleSkip();
  }

  function handleSkip() {
    setSkipDialog(null);
    setSkipped(true);
    // Skipping past an unresolved event defaults to its neutral outcome: a fight not
    // played grants no boost ('loss', since it's upside-only), a trade decision stands
    // pat, and a collapse defaults to a failed stand. Each segment is generated only if
    // it doesn't already exist, and in season order, so the shared RNG stream stays
    // in sequence (pre-fight -> post-fight -> mid -> final).
    const post = isFightDay ? (postFightGames ?? generatePostFightGames('loss')) : [];
    const mid = midGames ?? generateMidGames(currentPicks);
    const final = isCollapseDay ? (finalGames ?? generateFinalGames(false)) : [];
    const allResolved = [...preFightGames, ...post, ...mid, ...final];
    if (isFightDay) setPostFightGames(post);
    setMidGames(mid);
    if (isCollapseDay) setFinalGames(final);
    setFightStage('resolved');
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

  if (fightStage === 'active') {
    return (
      <HockeyFightFlow
        variant={fightVariant}
        opponent={currentGame ? mascotOnly(currentGame.opponent) : undefined}
        onResolved={handleFightResolved}
      />
    );
  }

  if (collapseStage === 'active' && lateSeasonEvent) {
    return (
      <lateSeasonEvent.Flow
        picks={currentPicks}
        seasonsById={seasonsById}
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
          {/* After a skip both controls stay in place but go inert (faded/disabled)
              — nothing left to speed up or skip while the finished list holds. */}
          <button type="button" className="sim-action-btn" onClick={() => setFast((f) => !f)} disabled={skipped}>
            {fast ? 'Normal speed' : 'Speed up'}
          </button>
          <button type="button" className="sim-action-btn" onClick={requestSkip} disabled={skipped}>
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
                G{g.gameNumber} vs. {g.opponent} {g.home ? '(H)' : '(A)'}
              </span>
              <span className="season-sim-score">{gameLine(g)}</span>
            </div>
          ))}
        </div>

        {!fast && currentGame && (
          <div className="season-sim-live">
            <div className="season-sim-live-header">
              <span>
                vs. {currentGame.opponent} {currentGame.home ? '(H)' : '(A)'}
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
                <span className="season-sim-goals-col-header">{TEAM.identity.name}</span>
                {liveGoals.map((g, i) => (
                  <div key={i} className="season-sim-goal-line">
                    🚨 {g.scorer ?? TEAM.identity.name} <span className="season-sim-goal-time">{g.label}</span>
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

      {skipDialog && (
        <div className="skip-confirm-overlay" role="dialog" aria-modal="true">
          <div className="skip-confirm-card">
            <p className="skip-confirm-text">
              {skipDialog === 'beforeDeadline'
                ? "Skip the rest? You'll remain at status quo at the trade deadline and may forfeit other season events. We recommend speeding up if you don't want to skip possible content"
                : 'Skip the rest? You may forfeit other season events. We recommend speeding up if you don\'t want to skip possible content'}
            </p>
            <div className="skip-confirm-actions">
              <button type="button" className="primary-btn" onClick={handleSkip}>
                Skip to end
              </button>
              <button type="button" className="secondary-btn" onClick={() => setSkipDialog(null)}>
                Continue season
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

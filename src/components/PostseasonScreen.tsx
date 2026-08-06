import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameResult } from '../lib/gameSim';
import { REGULATION_END } from '../lib/gameSim';
import type { PostseasonResult, Series } from '../lib/postseason';
import type { ChampionEntry, Platform } from '../lib/platform';
import { TEAM_NAME, HAS_OCTOPUS_TRADITION } from '../data/team';
import { mascotOnly } from '../data/nhlAlignment';
import { ShootoutCeremony } from './ShootoutCeremony';
import { OctopusFlyby } from './OctopusFlyby';
import stanleyCupSrc from '../assets/stanley-cup.png';
import divisionBannerSrc from '../assets/division-champions-banner.png';
import conferenceBannerSrc from '../assets/conference-champions-banner.png';
import stanleyCupBannerSrc from '../assets/stanleycup-champions-banner.png';

// Round win → matching championship banner shown on that round's "Series won!"
// screen. Round 1 (winning your first series) isn't a title, so it gets none.
const ROUND_BANNERS: Partial<Record<number, string>> = {
  2: divisionBannerSrc,
  3: conferenceBannerSrc,
  4: stanleyCupBannerSrc,
};

const TICKS_PER_GAME = 14;
const PACE = { tickMs: 90, startPauseMs: 500, otSuspenseMs: 1300, endPauseMs: 1300 };

// Extra beat held on the final boxscore right after a shootout, on top of the
// ShootoutCeremony's own pause on its "X win it" line — the moment deserves longer
// than a regular game's endPauseMs before the screen moves on to the next game/series result.
const SHOOTOUT_RESULT_PAUSE_MS = 2200;

const ROUND_NAMES: Record<number, string> = {
  1: 'First Series',
  2: 'Division Final',
  3: 'Conference Final',
  4: 'Stanley Cup Final',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPlayerSeries(postseason: PostseasonResult): Series[] {
  if (!postseason.qualified) return [];
  const east = postseason.eastBracket;
  const candidates: (Series | null)[] = [
    east.divATop,
    east.divABottom,
    east.divBTop,
    east.divBBottom,
    east.divAFinal,
    east.divBFinal,
    east.confFinal,
    postseason.finalSeries,
  ];
  return candidates.filter((s): s is Series => !!s && s.isPlayerSeries);
}

function gameLine(game: GameResult): string {
  const tag = game.decidedIn === 'REG' ? '' : ' (OT)';
  return `${game.teamGoals}-${game.oppGoals}${tag}`;
}

export function PostseasonScreen({
  postseason,
  dateStr,
  dateSeed,
  subreddit,
  startAtRound,
  onPlayAgainDev,
  platform,
}: {
  postseason: PostseasonResult;
  dateStr: string;
  dateSeed: number;
  subreddit: string;
  // Dev-only: skip straight to a given round (e.g. 4 for the Stanley Cup Final)
  // instead of always starting from Round 1.
  startAtRound?: number;
  onPlayAgainDev: () => void;
  platform: Platform;
}) {
  const playerSeries = useMemo(() => getPlayerSeries(postseason), [postseason]);
  const initialSeriesIdx = useMemo(() => {
    if (!startAtRound) return 0;
    const idx = playerSeries.findIndex((s) => s.round === startAtRound);
    return idx >= 0 ? idx : 0;
  }, [playerSeries, startAtRound]);

  // null = not shown (no Hall of Champions on this platform) or still loading.
  const [championsPool, setChampionsPool] = useState<ChampionEntry[] | null>(null);
  useEffect(() => {
    if (!platform.showsLeaderboard) return;
    let cancelled = false;
    platform.getHallOfChampions(dateSeed).then((entries) => {
      if (!cancelled) setChampionsPool(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [platform, dateSeed]);

  const hallOfChampions = useMemo(() => {
    if (!championsPool) return [];
    const entries: (ChampionEntry & { isYou?: boolean })[] = championsPool;
    const withYou = postseason.playerWonCup
      ? [{ username: 'You', achievement: 'Stanley Cup Champion' as const, isYou: true }, ...entries]
      : postseason.playerWonConference
        ? [{ username: 'You', achievement: 'Conference Champion' as const, isYou: true }, ...entries]
        : entries;
    // Cup champions before conference champions; within each group, you go first.
    return withYou.slice().sort((a, b) => {
      if (a.achievement !== b.achievement) return a.achievement === 'Stanley Cup Champion' ? -1 : 1;
      if (a.isYou) return -1;
      if (b.isYou) return 1;
      return 0;
    });
  }, [championsPool, postseason]);

  const [seriesIdx, setSeriesIdx] = useState(initialSeriesIdx);
  const [gameIdx, setGameIdx] = useState(0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [otSuspense, setOtSuspense] = useState(false);
  const [shootoutActive, setShootoutActive] = useState(false);
  const [completedGames, setCompletedGames] = useState<GameResult[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [stage, setStage] = useState<'playing' | 'seriesComplete' | 'finished'>('playing');
  const feedRef = useRef<HTMLDivElement | null>(null);
  const liveFeedWrapRef = useRef<HTMLDivElement | null>(null);
  const [feedTop, setFeedTop] = useState(0);
  // How many px of the feed's own top the card is currently overlapping —
  // 0 whenever the card fits above the feed normally. Drives a fade on the
  // FEED's top edge (not the card): the card stays a clean opaque box, and
  // the row peeking out from behind it fades in right at the true boundary,
  // instead of blending the card's own content with the row's underneath it.
  const [feedCoverDepth, setFeedCoverDepth] = useState(0);

  // Legend of the Octopus — fires once before Game 1 of Round 1 and once before
  // Game 1 of the Final. Refs (not state) track "already shown" so a re-render
  // never re-fires it, and the moment itself is purely cosmetic — no roll, no
  // effect on the sim, just a beat before the live game starts ticking.
  const [octopusMoment, setOctopusMoment] = useState<'round1' | 'final' | null>(null);
  const octopusRound1Shown = useRef(false);
  const octopusFinalShown = useRef(false);

  // Record the achievement once the postseason run is actually complete —
  // not at the start, so a player quitting partway through never submits.
  const achievementSubmitted = useRef(false);
  useEffect(() => {
    if (stage !== 'finished' || achievementSubmitted.current) return;
    achievementSubmitted.current = true;
    if (postseason.playerWonCup) {
      void platform.submitAchievement('Stanley Cup Champion');
    } else if (postseason.playerWonConference) {
      void platform.submitAchievement('Conference Champion');
    }
  }, [stage, postseason, platform]);

  // Only fade the feed's top/bottom edge when there's more content to scroll past
  // it — otherwise the gradient permanently obscures whichever game sits at the edge.
  function updateEdgeClasses(el: HTMLDivElement | null) {
    if (!el) return;
    el.classList.toggle('at-top', el.scrollTop <= 1);
    el.classList.toggle('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }

  useEffect(() => {
    updateEdgeClasses(feedRef.current);
  });

  const currentSeries = playerSeries[seriesIdx] ?? null;
  const currentGame = currentSeries?.games[gameIdx] ?? null;
  const playerIsHome = currentSeries?.home.team.isPlayer ?? false;
  const opponent = currentSeries ? (playerIsHome ? currentSeries.away : currentSeries.home) : null;
  // Live card or shootout ceremony — whichever's currently occupying the "current
  // game" slot on top of the feed. Either one is what the feed should stick under.
  const stickyToCard = !!currentGame;

  // Keeps the completed-games feed pinned just below the current-game card's
  // bottom edge as it grows, until that would push the feed past the bottom of
  // the fixed-height frame — then it stops following and stays put, letting the
  // card grow over it instead. Measured (not guessed) because the card's height
  // depends on real game content (goal count, OT, shootout) that changes live.
  useEffect(() => {
    const wrapEl = liveFeedWrapRef.current;
    const feedEl = feedRef.current;
    if (!stickyToCard || !wrapEl || !feedEl) {
      setFeedTop(0);
      return;
    }
    const cardEl = wrapEl.querySelector<HTMLElement>('.season-sim-live, .shootout-ceremony');
    if (!cardEl) {
      setFeedTop(0);
      setFeedCoverDepth(0);
      return;
    }
    const recompute = () => {
      const wrapH = wrapEl.clientHeight;
      const cardH = cardEl.offsetHeight;
      const feedH = feedEl.offsetHeight;
      // Match the feed's own row-to-row gap so the card-to-first-game gap looks
      // the same as the gap between any two games, rather than sitting flush.
      const rowGap = parseFloat(getComputedStyle(feedEl).rowGap) || 0;
      const desiredTop = cardH + rowGap;
      const ceiling = Math.max(0, wrapH - feedH);
      setFeedTop(Math.min(desiredTop, ceiling));
      setFeedCoverDepth(Math.max(0, desiredTop - ceiling));
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(cardEl);
    observer.observe(feedEl);
    return () => observer.disconnect();
  }, [stickyToCard, shootoutActive, currentGame]);

  useEffect(() => {
    setGameIdx(0);
    setCompletedGames([]);
    setSkipped(false);
    setStage('playing');
  }, [seriesIdx]);

  useEffect(() => {
    setCurrentMinute(0);
    setOtSuspense(false);
    setShootoutActive(false);
  }, [gameIdx, seriesIdx]);

  useEffect(() => {
    if (!HAS_OCTOPUS_TRADITION || gameIdx !== 0 || !currentSeries) return;
    if (currentSeries.round === 1 && !octopusRound1Shown.current) {
      octopusRound1Shown.current = true;
      setOctopusMoment('round1');
    } else if (currentSeries.round === 4 && !octopusFinalShown.current) {
      octopusFinalShown.current = true;
      setOctopusMoment('final');
    }
  }, [gameIdx, currentSeries]);

  useEffect(() => {
    if (skipped || stage !== 'playing' || !currentSeries || !currentGame || shootoutActive || octopusMoment) return;
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
        if (currentGame!.decidedIn === 'SO') {
          setShootoutActive(true);
          return; // ShootoutCeremony takes over; onShootoutComplete resumes the reveal
        }
        setOtSuspense(true);
        await sleep(PACE.otSuspenseMs);
        if (cancelled) return;
        setOtSuspense(false);
        setCurrentMinute(currentGame!.endMinute);
      }
      await sleep(PACE.endPauseMs);
      if (cancelled) return;
      bankGame(currentGame!);
    }
    play();
    return () => {
      cancelled = true;
    };
    // shootoutActive and octopusMoment deliberately excluded: both are read above
    // (via the `|| shootoutActive || octopusMoment` guard) purely to skip starting a
    // run while that overlay is showing, not to restart one once it clears.
    // handleShootoutComplete/the octopus's onComplete flip these back to false/null
    // on the very game this effect just finished, and including either here made
    // that flip re-run play() for that same game — replaying the whole regulation
    // clock from 0 right when the moment should be holding still.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIdx, seriesIdx, skipped, stage]);

  function bankGame(game: GameResult) {
    const nextGames = [...completedGames, game];
    setCompletedGames(nextGames);
    if (nextGames.length >= currentSeries!.games.length) {
      setStage('seriesComplete');
    } else {
      setGameIdx((i) => i + 1);
    }
  }

  function handleShootoutComplete() {
    if (!currentGame) return;
    setShootoutActive(false);
    setCurrentMinute(currentGame.endMinute);
    setTimeout(() => bankGame(currentGame), SHOOTOUT_RESULT_PAUSE_MS);
  }

  function handleSkipSeries() {
    setSkipped(true);
    setStage('seriesComplete');
  }

  function handleContinue() {
    const playerWonThisSeries = currentSeries?.winner?.team.isPlayer ?? false;
    const isLastSeries = seriesIdx + 1 >= playerSeries.length;
    if (!playerWonThisSeries || isLastSeries) {
      setStage('finished');
    } else {
      setSeriesIdx((i) => i + 1);
    }
  }

  if (!currentSeries) {
    // Shouldn't normally be reached (App only routes here when qualified), but keep it safe.
    return <div className="postseason-screen rink-backdrop">No postseason series to show.</div>;
  }

  // ---- Series complete / finished stages ----
  if (stage === 'seriesComplete' || stage === 'finished') {
    const playerWinsCount = playerIsHome ? currentSeries.homeWins : currentSeries.awayWins;
    const oppWinsCount = playerIsHome ? currentSeries.awayWins : currentSeries.homeWins;
    const playerWonSeries = currentSeries.winner?.team.isPlayer ?? false;

    if (stage === 'seriesComplete') {
      const bannerSrc = playerWonSeries ? ROUND_BANNERS[currentSeries.round] : undefined;
      return (
        <div className="postseason-screen rink-backdrop">
          <p className="postseason-round-label">{ROUND_NAMES[currentSeries.round]}</p>
          {bannerSrc && <img key={currentSeries.id} className="postseason-series-banner" src={bannerSrc} alt="" />}
          <h2 className="postseason-series-result-title">
            {playerWonSeries ? 'Series won!' : 'Series lost'}
          </h2>
          <p className="postseason-series-result-score">
            {playerWinsCount}-{oppWinsCount} vs {opponent!.team.name}
          </p>
          <button type="button" className="primary-btn" onClick={handleContinue}>
            Continue
          </button>
        </div>
      );
    }

    // finished
    return (
      <div className="postseason-screen rink-backdrop">
        <p className="results-eyebrow">r/{subreddit} · {dateStr}</p>
        {postseason.playerWonCup ? (
          <>
            <img className="results-tier-cup" src={stanleyCupSrc} alt="" />
            <h1 className="results-tier-label">Stanley Cup Champions</h1>
            <p className="results-tier-flavor">You went all the way. Hang the banner.</p>
          </>
        ) : postseason.playerWonConference ? (
          <>
            <span className="results-tier-emoji">🥈</span>
            <h1 className="results-tier-label">Lost the Final</h1>
            <p className="results-tier-flavor">
              {postseason.cupChampion.team.name} won it in {ROUND_NAMES[4]}.
            </p>
          </>
        ) : (
          <>
            <span className="results-tier-emoji">🥊</span>
            <h1 className="results-tier-label">Eliminated in {ROUND_NAMES[postseason.playerEliminatedRound ?? 1]}</h1>
            <p className="results-tier-flavor">
              Beaten by the {postseason.eliminatedBy?.team.name}.
              {postseason.cupChampion.team.name !== postseason.eliminatedBy?.team.name &&
                ` The ${postseason.cupChampion.team.name} (${postseason.cupChampion.team.conference}) went on to win the Cup from the other side of the bracket.`}
            </p>
          </>
        )}

        {platform.showsLeaderboard && championsPool && (
          <>
            {(postseason.playerWonCup || postseason.playerWonConference) && (
              <div className="results-rank">
                Rank <strong>#{hallOfChampions.findIndex((entry) => entry.isYou) + 1}</strong> of {hallOfChampions.length} in r/
                {subreddit} today
              </div>
            )}
            <p className="hoc-heading">Hall of Champions · {dateStr}</p>
            <ol className="hall-of-champions">
              {hallOfChampions.slice(0, 12).map((entry, i) => (
                <li key={entry.username + i} className={entry.isYou ? 'you' : ''}>
                  <span className="hall-of-champions-name">{entry.username}</span>
                  <span className={`hall-of-champions-badge ${entry.achievement === 'Stanley Cup Champion' ? 'cup' : 'conference'}`}>
                    {entry.achievement}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}

        <p className="results-daily-note">🗓️ One play per day — come back tomorrow for a fresh draft.</p>
        {import.meta.env.DEV && (
          <button type="button" className="text-btn dev-reset" onClick={onPlayAgainDev}>
            ↺ Replay (dev only — real game is once per day)
          </button>
        )}
      </div>
    );
  }

  // ---- Live game (playing) stage ----
  const liveGoals = currentGame ? currentGame.goalEvents.filter((e) => e.minute <= currentMinute) : [];
  const liveOppGoals = currentGame ? currentGame.oppGoalEvents.filter((e) => e.minute <= currentMinute) : [];
  const progressPct = currentGame ? (currentMinute / currentGame.endMinute) * 100 : 100;
  const goesToExtra = currentGame ? currentGame.endMinute > REGULATION_END : false;
  const playerWinsSoFar = completedGames.filter((g) => g.result === 'W').length;
  const oppWinsSoFar = completedGames.length - playerWinsSoFar;

  return (
    <div className="postseason-screen rink-backdrop">
      <div className="postseason-live-header">
        <h2 className="postseason-round-title">{ROUND_NAMES[currentSeries.round]}</h2>
        <button type="button" className="sim-action-btn" onClick={handleSkipSeries}>
          Skip series
        </button>
      </div>

      <p className="postseason-series-status">
        vs {opponent!.team.name} ({opponent!.label})
      </p>
      <div className="postseason-tally">
        <div>
          <strong>
            {playerWinsSoFar}-{oppWinsSoFar}
          </strong>
          <span>Series</span>
        </div>
        <div>
          <strong>{gameIdx + 1}</strong>
          <span>Game</span>
        </div>
      </div>

      {octopusMoment && (
        <OctopusFlyby direction={octopusMoment === 'round1' ? 'ltr' : 'rtl'} onComplete={() => setOctopusMoment(null)} />
      )}

      <div className="season-sim-live-feed" ref={liveFeedWrapRef}>
        <div
          className={`season-sim-feed${stickyToCard ? ' sticky-to-card' : ''}${feedCoverDepth > 0 ? ' covered-by-card' : ''}`}
          ref={feedRef}
          style={stickyToCard ? ({ top: feedTop, '--cover-depth': `${feedCoverDepth}px` } as CSSProperties) : undefined}
          onScroll={(e) => updateEdgeClasses(e.currentTarget)}
        >
          {completedGames
            .slice(-5)
            .reverse()
            .map((g, i) => (
              <div key={completedGames.length - i} className="season-sim-game">
                <span className={`season-sim-result ${g.result === 'W' ? 'win' : 'loss'}`}>{g.result}</span>
                <span className="season-sim-opponent">
                  G{g.gameNumber} vs {g.opponent} {g.home ? '(H)' : '(A)'}
                </span>
                <span className="season-sim-score">{gameLine(g)}</span>
              </div>
            ))}
        </div>

        {shootoutActive && currentGame && (
          <ShootoutCeremony
            weWin={currentGame.result === 'W'}
            ourName={TEAM_NAME}
            theirName={mascotOnly(opponent!.team.name)}
            weAreHome={currentGame.home}
            roundLabel={ROUND_NAMES[currentSeries!.round]}
            seed={dateSeed + seriesIdx * 100 + gameIdx}
            onComplete={handleShootoutComplete}
          />
        )}

        {!shootoutActive && currentGame && (
          <div className="season-sim-live">
            <div className="season-sim-live-header">
              <span>
                vs {opponent!.team.name} {currentGame.home ? '(H)' : '(A)'}
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
                <span className="season-sim-goals-col-header">{mascotOnly(opponent!.team.name)}</span>
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

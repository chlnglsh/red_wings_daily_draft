import { useEffect, useMemo, useState } from 'react';
import type { GameResult } from '../lib/gameSim';
import { REGULATION_END } from '../lib/gameSim';
import type { PostseasonResult, Series } from '../lib/postseason';
import { generateHallOfChampions } from '../lib/hallOfChampions';
import { ShootoutCeremony } from './ShootoutCeremony';

const TICKS_PER_GAME = 14;
const PACE = { tickMs: 90, startPauseMs: 500, otSuspenseMs: 1300, endPauseMs: 1300 };

const ROUND_NAMES: Record<number, string> = {
  1: 'Round 1',
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
  onPlayAgainDev,
}: {
  postseason: PostseasonResult;
  dateStr: string;
  dateSeed: number;
  onPlayAgainDev: () => void;
}) {
  const playerSeries = useMemo(() => getPlayerSeries(postseason), [postseason]);
  const hallOfChampions = useMemo(() => {
    const entries: (ReturnType<typeof generateHallOfChampions>[number] & { isYou?: boolean })[] = generateHallOfChampions(dateSeed);
    if (postseason.playerWonCup) {
      entries.unshift({ username: 'You', achievement: 'Stanley Cup Champion', isYou: true });
    } else if (postseason.playerWonConference) {
      entries.unshift({ username: 'You', achievement: 'Conference Champion', isYou: true });
    }
    // Cup champions before conference champions; within each group, you go first.
    return entries.sort((a, b) => {
      if (a.achievement !== b.achievement) return a.achievement === 'Stanley Cup Champion' ? -1 : 1;
      if (a.isYou) return -1;
      if (b.isYou) return 1;
      return 0;
    });
  }, [dateSeed, postseason]);

  const [seriesIdx, setSeriesIdx] = useState(0);
  const [gameIdx, setGameIdx] = useState(0);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [otSuspense, setOtSuspense] = useState(false);
  const [shootoutActive, setShootoutActive] = useState(false);
  const [completedGames, setCompletedGames] = useState<GameResult[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [stage, setStage] = useState<'playing' | 'seriesComplete' | 'finished'>('playing');

  const currentSeries = playerSeries[seriesIdx] ?? null;
  const currentGame = currentSeries?.games[gameIdx] ?? null;
  const playerIsHome = currentSeries?.home.team.isPlayer ?? false;
  const opponent = currentSeries ? (playerIsHome ? currentSeries.away : currentSeries.home) : null;

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
    if (skipped || stage !== 'playing' || !currentSeries || !currentGame || shootoutActive) return;
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
        const isFinalShootout = currentSeries!.round === 4 && currentGame!.decidedIn === 'SO';
        if (isFinalShootout) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIdx, seriesIdx, skipped, stage, shootoutActive]);

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
    setTimeout(() => bankGame(currentGame), PACE.endPauseMs);
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
      return (
        <div className="postseason-screen rink-backdrop">
          <p className="postseason-round-label">{ROUND_NAMES[currentSeries.round]}</p>
          <h2 className="postseason-series-result-title">
            {playerWonSeries ? '🏆 Series won!' : '❌ Series lost'}
          </h2>
          <p className="postseason-series-result-score">
            {playerWinsCount}-{oppWinsCount} vs {opponent!.team.name}
          </p>
          <button type="button" className="primary-btn" onClick={handleContinue}>
            Continue →
          </button>
        </div>
      );
    }

    // finished
    return (
      <div className="postseason-screen rink-backdrop">
        <p className="results-eyebrow">r/RedWings · {dateStr}</p>
        {postseason.playerWonCup ? (
          <>
            <span className="results-tier-emoji">🏆</span>
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

        <p className="results-daily-note">🗓️ One play per day — come back tomorrow for a fresh draft.</p>
        <button type="button" className="text-btn dev-reset" onClick={onPlayAgainDev}>
          ↺ Replay (dev only — real game is once per day)
        </button>
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
      <div className="season-sim-header">
        <span className="season-sim-game-count">{ROUND_NAMES[currentSeries.round]}</span>
        <div className="season-sim-header-actions">
          <button type="button" className="sim-action-btn" onClick={handleSkipSeries}>
            Skip series →
          </button>
        </div>
      </div>

      <p className="postseason-series-status">
        vs {opponent!.team.name} ({opponent!.label}) · Series {playerWinsSoFar}-{oppWinsSoFar} · Game {gameIdx + 1}
      </p>

      {shootoutActive && currentGame && (
        <ShootoutCeremony
          weWin={currentGame.result === 'W'}
          ourName="Red Wings"
          theirName={opponent!.team.name}
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
              <span className="season-sim-goals-col-header">{opponent!.team.name}</span>
              {liveOppGoals.map((g, i) => (
                <div key={i} className="season-sim-goal-line">
                  <span className="season-sim-goal-time">{g.label}</span> 🥅
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="season-sim-feed">
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
    </div>
  );
}

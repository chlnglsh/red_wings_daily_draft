import { useMemo, useState } from 'react';
import type { DraftPick, Player, Season, SlotId } from './types';
import { SLOT_ORDER } from './types';
import { SEASONS } from './data/seasons';
import { getRandomSeed, getDateSeed, getUtcDateString } from './lib/dailySeed';
import { generateRoundSeasons, getRerollAlternate } from './lib/spin';
import type { SeasonSimResult } from './lib/gameSim';
import { RoundScreen } from './components/RoundScreen';
import { SquadSummaryScreen } from './components/SquadSummaryScreen';
import { SeasonSimScreen } from './components/SeasonSimScreen';
import { ResultsScreen } from './components/ResultsScreen';
import './App.css';

type Screen = 'intro' | 'round' | 'squadSummary' | 'simulating' | 'results';

const seasonsById = new Map(SEASONS.map((s) => [s.id, s] as [string, Season]));

export default function App() {
  const dateStr = useMemo(() => getUtcDateString(), []);
  const dateSeed = useMemo(() => getDateSeed(), []);

  const [screen, setScreen] = useState<Screen>('intro');
  const [runSeed, setRunSeed] = useState(() => getRandomSeed());
  const [roundIndex, setRoundIndex] = useState(0);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [rerollUsed, setRerollUsed] = useState(false);
  const [rerolledRoundIndex, setRerolledRoundIndex] = useState<number | null>(null);
  const [rerollAlternate, setRerollAlternate] = useState<Season | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const [simResult, setSimResult] = useState<SeasonSimResult | null>(null);

  const primaryRounds = useMemo(() => generateRoundSeasons(runSeed, SEASONS), [runSeed]);

  const draftedPlayerIds = useMemo(() => new Set(picks.map((p) => p.player.id)), [picks]);
  const openSlots = useMemo(() => SLOT_ORDER.filter((s) => !picks.some((p) => p.slot === s)), [picks]);

  const currentSeason =
    rerolledRoundIndex === roundIndex && rerollAlternate ? rerollAlternate : primaryRounds[roundIndex];

  function handleStart() {
    setRunSeed(getRandomSeed()); // fresh randomness every playthrough — any season, any time
    setScreen('round');
  }

  function handleReroll() {
    if (rerollUsed) return;
    const alternate = getRerollAlternate(runSeed, roundIndex, SEASONS);
    setRerollUsed(true);
    setRerolledRoundIndex(roundIndex);
    setRerollAlternate(alternate);
    setSpinToken((t) => t + 1);
  }

  function handlePick(player: Player, slot: SlotId) {
    const newPick: DraftPick = { slot, seasonId: currentSeason.id, player };
    const nextPicks = [...picks, newPick];
    setPicks(nextPicks);
    if (nextPicks.length >= 6) {
      setScreen('squadSummary');
    } else {
      setRoundIndex((i) => i + 1);
      setSpinToken((t) => t + 1);
    }
  }

  function handleSimulate() {
    setScreen('simulating');
  }

  function handleSimComplete(result: SeasonSimResult) {
    setSimResult(result);
    setScreen('results');
  }

  function handlePlayAgainDev() {
    // Dev-only reset so we can exercise the loop repeatedly while prototyping.
    // Real game is one play per day per user — this button won't exist post-Phase-1.
    setScreen('intro');
    setRoundIndex(0);
    setPicks([]);
    setRerollUsed(false);
    setRerolledRoundIndex(null);
    setRerollAlternate(null);
    setSpinToken(0);
    setSimResult(null);
  }

  if (screen === 'intro') {
    return (
      <div className="app-shell">
        <header className="intro">
          <p className="intro-eyebrow">r/RedWings · {dateStr}</p>
          <h1 className="intro-title">Red Wings Daily Draft</h1>
          <p className="intro-sub">
            Spin six real Red Wings seasons, draft a starting six, and see where you land on today's
            leaderboard. One play per day—come back again to see if you can reach #1.
          </p>
          <button type="button" className="primary-btn" onClick={handleStart}>
            Start today's draft
          </button>
        </header>
      </div>
    );
  }

  if (screen === 'round') {
    return (
      <div className="app-shell">
        <RoundScreen
          roundIndex={roundIndex}
          season={currentSeason}
          spinToken={spinToken}
          canReroll={!rerollUsed}
          onReroll={handleReroll}
          openSlots={openSlots}
          draftedPlayerIds={draftedPlayerIds}
          onPick={handlePick}
          picks={picks}
        />
      </div>
    );
  }

  if (screen === 'squadSummary') {
    return (
      <div className="app-shell">
        <SquadSummaryScreen picks={picks} seasonsById={seasonsById} onSimulate={handleSimulate} />
      </div>
    );
  }

  if (screen === 'simulating') {
    return (
      <div className="app-shell">
        <SeasonSimScreen picks={picks} seasonsById={seasonsById} runSeed={runSeed} onComplete={handleSimComplete} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ResultsScreen
        dateStr={dateStr}
        dateSeed={dateSeed}
        picks={picks}
        seasonsById={seasonsById}
        simResult={simResult!}
        onPlayAgainDev={handlePlayAgainDev}
      />
    </div>
  );
}

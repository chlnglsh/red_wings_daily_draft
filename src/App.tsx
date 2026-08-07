import { useEffect, useMemo, useState } from 'react';
import type { DraftPick, Player, Season, SlotId } from './types';
import { SLOT_ORDER, eligiblePosition } from './types';
import { SEASONS } from './data/seasons';
import { TEAM_NAME, SUBREDDIT, HAS_MARCH_COLLAPSE, HAS_TRADE_DEADLINE, HAS_POSTSEASON } from './data/team';
import { getRandomSeed, getDateSeed, getUtcDateString } from './lib/dailySeed';
import { generateRoundSeasons, getRerollAlternate } from './lib/spin';
import type { SeasonSimResult, WeightedSkater } from './lib/gameSim';
import { simulateGamesInRange, aggregateGames, buildScorerPicker, SEASON_LENGTH } from './lib/gameSim';
import { deriveRosterGameState } from './lib/rosterState';
import { mulberry32, hashStringToInt } from './lib/prng';
import { simulatePostseason, findCupFinalShootoutSeed, findSeedReachingFinal, findSeedEliminatedInRound, type PostseasonResult } from './lib/postseason';
import type { Platform } from './lib/platform';
import { mockPlatform } from './lib/mockPlatform';
import { hiddenPlatform } from './lib/hiddenPlatform';
import { RoundScreen } from './components/RoundScreen';
import { SquadSummaryScreen } from './components/SquadSummaryScreen';
import { SeasonSimScreen } from './components/SeasonSimScreen';
import { MarchCollapseFlow } from './components/MarchCollapseFlow';
import { ResultsScreen } from './components/ResultsScreen';
import { PostseasonScreen } from './components/PostseasonScreen';
import { SeasonRecapScreen } from './components/SeasonRecapScreen';
import slotMachineSrc from './assets/lucky-red-slot-machine.png';
import './App.css';

type Screen = 'intro' | 'round' | 'squadSummary' | 'simulating' | 'results' | 'postseason' | 'recap';

const seasonsById = new Map(SEASONS.map((s) => [s.id, s] as [string, Season]));

// No platform passed = standalone build. Dev mode keeps the mock leaderboard
// visible for local testing; a real production build hides it (no subreddit
// behind it). A Reddit build always passes its own real `platform` explicitly.
const defaultPlatform = import.meta.env.DEV ? mockPlatform : hiddenPlatform;

export default function App({ platform: platformProp = defaultPlatform }: { platform?: Platform } = {}) {
  const dateStr = useMemo(() => getUtcDateString(), []);
  const dateSeed = useMemo(() => getDateSeed(), []);

  // Dev-only: ?debug=<name> boots straight into an isolated screen, skipping the
  // whole draft/sim flow — handy for iterating on one piece. See the debug render
  // branch below the handlers.
  const debugScreen = useMemo(() => new URLSearchParams(window.location.search).get('debug'), []);
  const [debugReplayToken, setDebugReplayToken] = useState(0);
  const [showDebugCollapse, setShowDebugCollapse] = useState(false);
  // Dev-only: debug shortcuts can launch a flow under either the Reddit-style mock
  // platform (leaderboard shown) or the standalone hidden platform, so both versions
  // of a screen can be checked. null = use the real passed-in platform.
  const [devPlatform, setDevPlatform] = useState<Platform | null>(null);
  const platform = devPlatform ?? platformProp;

  const [screen, setScreen] = useState<Screen>('intro');
  const [runSeed, setRunSeed] = useState(() => getRandomSeed());
  const [roundIndex, setRoundIndex] = useState(0);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [rerollUsed, setRerollUsed] = useState(false);
  const [rerolledRoundIndex, setRerolledRoundIndex] = useState<number | null>(null);
  const [rerollAlternate, setRerollAlternate] = useState<Season | null>(null);
  const [spinToken, setSpinToken] = useState(0);
  const [simResult, setSimResult] = useState<SeasonSimResult | null>(null);
  const [devSkipToDeadline, setDevSkipToDeadline] = useState(false);
  const [postseasonStartRound, setPostseasonStartRound] = useState<number | undefined>(undefined);
  // Which final screen the Season Recap was opened from, so Back returns there.
  const [recapReturn, setRecapReturn] = useState<'results' | 'postseason'>('results');

  // Accessibility opt-out for the March Collapse lightning intro, toggled on the
  // splash screen and remembered across visits. Defaults to on when the OS already
  // asks for reduced motion, so those players never have to find the toggle.
  const [reduceFlashing, setReduceFlashing] = useState<boolean>(() => {
    const saved = localStorage.getItem('reduceFlashing');
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });
  function handleToggleReduceFlashing(next: boolean) {
    setReduceFlashing(next);
    try {
      localStorage.setItem('reduceFlashing', String(next));
    } catch {
      // localStorage can throw in private mode — the in-memory state still applies
      // for this session, we just can't persist it.
    }
  }

  const primaryRounds = useMemo(() => generateRoundSeasons(runSeed, SEASONS), [runSeed]);

  // Keyed by name, not player.id — the same real player has a different, season-scoped
  // id in every season's roster entry (e.g. '1996-fedorov' vs '2001-fedorov'), so an
  // id-keyed set let the same person get drafted twice under two different seasons.
  const draftedPlayerNames = useMemo(() => new Set(picks.map((p) => p.player.name)), [picks]);
  const openSlots = useMemo(() => SLOT_ORDER.filter((s) => !picks.some((p) => p.slot === s)), [picks]);

  // Not derived via useMemo from simResult: a returning Reddit player's postseason
  // (see the getTodaysPlay effect below) is loaded verbatim from what was actually
  // computed on their one play today, not re-simulated — the Trade Deadline is an
  // interactive, RNG-consuming choice, so it isn't reproducible from runSeed alone.
  const [postseason, setPostseason] = useState<PostseasonResult | null>(null);

  // SUBREDDIT (data/team.ts) is just this build's dev-time default — a real
  // Reddit install could be on any subreddit. mockPlatform/hiddenPlatform
  // resolve this to that same constant, so only a real Reddit build ever
  // actually changes it; the constant is what's shown until (if ever) it does.
  const [subreddit, setSubreddit] = useState(SUBREDDIT);
  useEffect(() => {
    let cancelled = false;
    platform.getSubreddit().then((real) => {
      if (!cancelled) setSubreddit(real);
    });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  // Reddit-only: one play per day is enforced by whether a saved run exists for
  // today, not by any client-side flag — mockPlatform/hiddenPlatform always resolve
  // this to null, so the standalone build is never gated. A brief flash of the intro
  // screen before this resolves is an acceptable tradeoff for not needing a loading state.
  useEffect(() => {
    let cancelled = false;
    platform.getTodaysPlay().then((saved) => {
      if (cancelled || !saved) return;
      setPicks(saved.picks);
      setSimResult(saved.simResult);
      setPostseason(saved.postseason);
      setScreen('results');
    });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  const currentSeason =
    rerolledRoundIndex === roundIndex && rerollAlternate ? rerollAlternate : primaryRounds[roundIndex];

  function handleStart() {
    setDevPlatform(null); // normal play always uses the real platform, never a dev override
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

  function handleSimComplete(result: SeasonSimResult, finalPicks: DraftPick[]) {
    const finalSkaters: WeightedSkater[] = finalPicks
      .filter((p) => p.player.position !== 'G')
      .map((p) => ({ name: p.player.name, weight: p.player.g }));
    // Regular-season-only builds skip the bracket entirely; the results screen is
    // the final screen. The postseason engine also computes the divisional
    // standings shown on the results screen, so with it off those are hidden too.
    const postseasonResult = HAS_POSTSEASON
      ? simulatePostseason(runSeed, result.points, finalSkaters)
      : null;

    setSimResult(result);
    setPicks(finalPicks); // may differ from the drafted roster if a trade happened
    setPostseason(postseasonResult);
    setScreen('results');
    void platform.submitScore({ points: result.points, wins: result.wins, losses: result.losses, otl: result.otl });
    void platform.saveTodaysPlay({ picks: finalPicks, simResult: result, postseason: postseasonResult });
  }

  function handleStartPostseason() {
    setScreen('postseason');
  }

  // Season Recap is reachable from both final screens; remember which one so Back
  // can return there (read the current screen at click time).
  function handleShowRecap() {
    setRecapReturn(screen === 'postseason' ? 'postseason' : 'results');
    setScreen('recap');
  }

  function handleBackFromRecap() {
    setScreen(recapReturn);
  }

  // Dev-only: jumps straight to Round 1 (First Series) of a real postseason —
  // no seed search needed since any qualifying seed already starts there
  // (postseasonStartRound left unset, so PostseasonScreen defaults to index 0).
  function handleForceFirstSeriesTest() {
    const seed = getRandomSeed();
    const fabricatedPicks = fabricateRosterPicks();
    if (!fabricatedPicks) return;
    setRunSeed(seed);
    setPicks(fabricatedPicks);
    setPostseasonStartRound(undefined);
    setSimResult(fabricateRegularSeasonSim(seed, fabricatedPicks));
    setPostseason(simulatePostseason(seed, 140, []));
    setScreen('postseason');
  }

  // Dev-only: jumps straight to Game 1 of a real (not fabricated) Stanley Cup Final
  // that happens to go to a shootout, so the ceremony can be checked immediately
  // instead of waiting on the ~5%-per-game odds in a normal playthrough — or, as
  // this used to do, starting at Round 1 and playing through 3 full rounds before
  // even reaching the Final, since postseasonStartRound wasn't set. Searched with
  // the same (empty, since this fires from the intro screen pre-draft) skaters the
  // app will actually recompute with, so the found seed reproduces deterministically.
  function handleForceShootoutTest() {
    const found = findCupFinalShootoutSeed(140, []);
    if (!found) {
      alert('No shootout scenario found in range — try again.');
      return;
    }
    const fabricatedPicks = fabricateRosterPicks();
    if (!fabricatedPicks) return;
    setRunSeed(found.seed);
    setPicks(fabricatedPicks);
    setPostseasonStartRound(4);
    setSimResult(fabricateRegularSeasonSim(found.seed, fabricatedPicks));
    setPostseason(simulatePostseason(found.seed, 140, []));
    setScreen('postseason');
  }

  // Dev-only: same fabricated-roster trick as the shootout test, but only requires
  // reaching the Final (not a shootout specifically) — jumps straight to the start
  // of the Stanley Cup Final round instead of playing rounds 1-3 first.
  function handleForceStanleyCupFinalTest() {
    const found = findSeedReachingFinal(140, []);
    if (!found) {
      alert('No Stanley Cup Final scenario found in range — try again.');
      return;
    }
    const fabricatedPicks = fabricateRosterPicks();
    if (!fabricatedPicks) return;
    setRunSeed(found.seed);
    setPicks(fabricatedPicks);
    setPostseasonStartRound(4);
    setSimResult(fabricateRegularSeasonSim(found.seed, fabricatedPicks));
    setPostseason(simulatePostseason(found.seed, 140, []));
    setScreen('postseason');
  }

  // Dev-only: jumps straight to the Conference Final (Round 3) of a real postseason
  // that the player LOSES, so the "Eliminated in the Conference Final by {Team}"
  // recap header + championship-banner combo can be eyeballed without replaying
  // until an elimination happens to land in that round.
  function handleForceConfFinalLossTest() {
    const found = findSeedEliminatedInRound(3, 140, []);
    if (!found) {
      alert('No Conference Final loss scenario found in range — try again.');
      return;
    }
    const fabricatedPicks = fabricateRosterPicks();
    if (!fabricatedPicks) return;
    setRunSeed(found.seed);
    setPicks(fabricatedPicks);
    setPostseasonStartRound(3);
    setSimResult(fabricateRegularSeasonSim(found.seed, fabricatedPicks));
    setPostseason(simulatePostseason(found.seed, 140, []));
    setScreen('postseason');
  }

  function handlePlayAgain() {
    // Resets to a fresh draft. On the standalone build this backs a real
    // "Play again" button (there's no one-play-per-day gate there); in dev it
    // also backs the replay button. On the Reddit build the daily gate means the
    // results screen offers no replay, so players never reach this.
    setScreen('intro');
    setRoundIndex(0);
    setPicks([]);
    setRerollUsed(false);
    setRerolledRoundIndex(null);
    setRerollAlternate(null);
    setSpinToken(0);
    setSimResult(null);
    setPostseason(null);
    setDevSkipToDeadline(false);
    setShowDebugCollapse(false);
    setPostseasonStartRound(undefined);
    setDevPlatform(null);
  }

  // Dev-only: fabricates a valid 6-player roster (one per slot, from a single
  // season's real roster) so the draft UI can be skipped entirely — shared by
  // both dev-test buttons below. Not SEASONS[0] — several early seasons are
  // still STUB rosters (placeholder "TBD Left Wing 1" names, see seasons.ts),
  // which would fabricate a roster of nobodies. 1996-97 is a real,
  // fully-researched roster.
  function fabricateRosterPicks(): DraftPick[] | null {
    const season = seasonsById.get('1996-97')!;
    const usedNames = new Set<string>();
    const fabricatedPicks: DraftPick[] = [];
    for (const slot of SLOT_ORDER) {
      const pos = eligiblePosition(slot);
      const player = season.roster.find((p) => p.position === pos && !usedNames.has(p.name));
      if (!player) {
        alert(`No ${pos} available in ${season.label} for dev test.`);
        return null;
      }
      usedNames.add(player.name);
      fabricatedPicks.push({ slot, seasonId: season.id, player });
    }
    return fabricatedPicks;
  }

  // Dev-only: simulate a full, real 82-game regular season for a fabricated roster,
  // so the postseason-jump shortcuts below land with a populated Season Recap
  // (lineup + regular-season log) instead of empty stubs. Display-only — the forced
  // postseason itself is still built from its own searched seed, not this result.
  function fabricateRegularSeasonSim(seed: number, seasonPicks: DraftPick[]): SeasonSimResult {
    const rosterState = deriveRosterGameState(seasonPicks, seasonsById);
    const rng = mulberry32(hashStringToInt(`${seed}:dev-regular-season`));
    const pickScorer = buildScorerPicker(rosterState.skaters, rng);
    const games = simulateGamesInRange({
      rng,
      pickScorer,
      startGame: 1,
      endGame: SEASON_LENGTH,
      baseWinPct: rosterState.winPct,
      era: rosterState.era,
    });
    return aggregateGames(games);
  }

  // Dev-only: skips the whole draft UI (fabricated roster) and games 1-60 of
  // the regular-season sim, landing straight on the trade deadline gate in
  // one click — previously only skipped the sim, still requiring a full real
  // draft first.
  function handleForceTradeDeadlineTest() {
    const fabricatedPicks = fabricateRosterPicks();
    if (!fabricatedPicks) return;
    setRunSeed(getRandomSeed());
    setPicks(fabricatedPicks);
    setDevSkipToDeadline(true);
    setScreen('simulating');
  }

  // Dev-only: skips the whole draft UI so the regular-season sim screen can be
  // reached in one click instead of playing through 6 rounds.
  function handleForceRegularSeasonTest() {
    const fabricatedPicks = fabricateRosterPicks();
    if (!fabricatedPicks) return;
    setRunSeed(getRandomSeed());
    setPicks(fabricatedPicks);
    setScreen('simulating');
  }

  // Dev-only: jump straight to the March Collapse minigame in isolation (the same
  // screen as the ?debug=march-collapse link) instead of playing a full season sim
  // to reach the collapse — for iterating on the minigame body.
  function handleForceMarchCollapseTest() {
    setShowDebugCollapse(true);
  }

  // Dev-only: one compact row per destination — the label, then two inline links
  // ("reddit version | standalone version") that run the flow under the Reddit-style
  // mock platform (leaderboard, Reddit copy) or the standalone hidden platform (no
  // leaderboard, standalone copy). Keeps the dev menu from ballooning to two full
  // buttons per shortcut. The platform override batches with the flow's own state
  // updates, so it's in effect by the time the screen renders.
  const devShortcut = (label: string, run: () => void) => (
    <p className="dev-shortcut">
      🧪 {label}:{' '}
      <button type="button" className="dev-shortcut-link" onClick={() => { setDevPlatform(mockPlatform); run(); }}>
        reddit version
      </button>
      {' | '}
      <button type="button" className="dev-shortcut-link" onClick={() => { setDevPlatform(hiddenPlatform); run(); }}>
        standalone version
      </button>
    </p>
  );

  // Dev-only debug entry point. March Collapse boots straight into the minigame in
  // isolation — flicker → hold → minigame → result — with no season sim
  // around it, so its visuals/UX can be iterated on directly. Reached via either the
  // ?debug=march-collapse URL or the intro dev button (handleForceMarchCollapseTest).
  // Resolving it remounts a fresh run (via the key) so you can go again.
  if (import.meta.env.DEV && (debugScreen === 'march-collapse' || showDebugCollapse)) {
    return (
      <div className="app-shell">
        <MarchCollapseFlow
          key={debugReplayToken}
          reduceFlashing={reduceFlashing}
          onResolved={() => setDebugReplayToken((t) => t + 1)}
        />
      </div>
    );
  }

  if (screen === 'intro') {
    return (
      <div className="app-shell">
        <header className="intro">
          {platform.showsLeaderboard && (
            <p className="intro-eyebrow">r/{subreddit} · {dateStr}</p>
          )}
          <h1 className="intro-title">{TEAM_NAME} Daily Draft</h1>
          <p className="intro-sub">
            {platform.showsLeaderboard ? (
              <>
                Spin six real {TEAM_NAME} seasons, draft a starting six, and see where you land on
                today's leaderboard. One play per day, come back tomorrow to see if you can reach
                number{' '}one.
              </>
            ) : (
              <>
                Spin six real {TEAM_NAME} seasons, draft a starting six, and see how far you can take
                them through the playoffs.
              </>
            )}
          </p>
          <img className="intro-slot-machine" src={slotMachineSrc} alt="" />
          <button type="button" className="primary-btn" onClick={handleStart}>
            {platform.showsLeaderboard ? "Start today's draft" : 'Start draft'}
          </button>
          {HAS_MARCH_COLLAPSE && (
            <label className="flash-optout">
              <input
                type="checkbox"
                checked={reduceFlashing}
                onChange={(e) => handleToggleReduceFlashing(e.target.checked)}
              />
              Remove flashing effects
            </label>
          )}
          {import.meta.env.DEV && (
            <>
              {HAS_POSTSEASON && (
                <>
                  {devShortcut('Force First Series', handleForceFirstSeriesTest)}
                  {devShortcut('Force Cup Final shootout', handleForceShootoutTest)}
                  {devShortcut('Force Stanley Cup Final', handleForceStanleyCupFinalTest)}
                  {devShortcut('Force Conference Final loss', handleForceConfFinalLossTest)}
                </>
              )}
              {HAS_TRADE_DEADLINE && devShortcut('Force Trade Deadline', handleForceTradeDeadlineTest)}
              {devShortcut('Force Regular Season', handleForceRegularSeasonTest)}
              {HAS_MARCH_COLLAPSE && (
                <button type="button" className="text-btn dev-reset" onClick={handleForceMarchCollapseTest}>
                  🧪 Force March Collapse (isolated minigame — platform-independent)
                </button>
              )}
            </>
          )}
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
          draftedPlayerNames={draftedPlayerNames}
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
        <SeasonSimScreen
          picks={picks}
          seasonsById={seasonsById}
          seasons={SEASONS}
          runSeed={runSeed}
          dateSeed={dateSeed}
          sharedDailyCollapse={platform.sharedDailyEvents}
          devSkipToDeadline={devSkipToDeadline}
          reduceFlashing={reduceFlashing}
          onComplete={handleSimComplete}
        />
      </div>
    );
  }

  if (screen === 'postseason') {
    return (
      <div className="app-shell">
        <PostseasonScreen
          postseason={postseason!}
          dateStr={dateStr}
          dateSeed={dateSeed}
          subreddit={subreddit}
          startAtRound={postseasonStartRound}
          onPlayAgain={handlePlayAgain}
          picks={picks}
          seasonsById={seasonsById}
          simResult={simResult!}
          platform={platform}
        />
      </div>
    );
  }

  if (screen === 'recap') {
    return (
      <div className="app-shell">
        <SeasonRecapScreen
          picks={picks}
          seasonsById={seasonsById}
          simResult={simResult!}
          onBack={handleBackFromRecap}
        />
      </div>
    );
  }


  return (
    <div className="app-shell">
      <ResultsScreen
        dateStr={dateStr}
        dateSeed={dateSeed}
        subreddit={subreddit}
        picks={picks}
        seasonsById={seasonsById}
        simResult={simResult!}
        postseason={postseason}
        onStartPostseason={handleStartPostseason}
        onPlayAgain={handlePlayAgain}
        onShowRecap={handleShowRecap}
        platform={platform}
      />
    </div>
  );
}

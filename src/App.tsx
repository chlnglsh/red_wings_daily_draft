import { useEffect, useMemo, useState } from 'react';
import type { DraftPick, Player, Season, SlotId } from './types';
import { SLOT_ORDER, eligiblePosition } from './types';
import { TEAM, gameTitle } from './teams/current';
import { rollGmCoach } from './lib/gmCoach';
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
import { FrontOfficeScreen } from './components/FrontOfficeScreen';
import { SeasonSimScreen } from './components/SeasonSimScreen';
import { HockeyFightFlow } from './components/HockeyFightFlow';
import { FIGHT_VARIANT_COUNT, type FightVariant } from './lib/hockeyFight';
import { ResultsScreen } from './components/ResultsScreen';
import { PostseasonScreen } from './components/PostseasonScreen';
import { SeasonRecapScreen } from './components/SeasonRecapScreen';
import { DedicationScreen } from './components/DedicationScreen';
import './App.css';

type Screen = 'intro' | 'dedication' | 'round' | 'frontOffice' | 'squadSummary' | 'simulating' | 'results' | 'postseason' | 'recap';

const SEASONS = TEAM.seasons;
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
  // Dev-only: iterate on the Hockey Fight minigame in isolation, and cycle which of
  // the three variants shows. forceHockeyFight instead exercises the full-season
  // integration (the fight firing partway through a real sim); both bypass the
  // hockeyFight feature flag so the WIP feature can be worked on while it ships off.
  const [showDebugFight, setShowDebugFight] = useState(false);
  const [debugFightVariant, setDebugFightVariant] = useState<FightVariant>(0);
  const [forceHockeyFight, setForceHockeyFight] = useState(false);
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

  // Accessibility opt-out for the late-season event's flashing intro, toggled on the
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

  // GM/Coach roll: a deterministic per-run roll from its own runSeed-derived stream
  // (kept separate from the sim's stream so it can't perturb game results). Rolled
  // when the draft's six positions fill; revealed on the front-office screen and
  // folded into the season win% as a flat modifier. Null when the feature is off.
  const frontOffice = useMemo(
    () => (TEAM.frontOffice ? rollGmCoach(TEAM.frontOffice, mulberry32(hashStringToInt(`${runSeed}:gmCoach`))) : null),
    [runSeed],
  );

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

  // The team config's subreddit is just this build's dev-time default — a real
  // Reddit install could be on any subreddit. mockPlatform/hiddenPlatform
  // resolve this to that same constant, so only a real Reddit build ever
  // actually changes it; the constant is what's shown until (if ever) it does.
  const [subreddit, setSubreddit] = useState(TEAM.identity.subreddit);
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
    // A team with a dedication card shows it once here, then the draft begins.
    setScreen(TEAM.assets.dedication ? 'dedication' : 'round');
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
      // Front-office reveal sits between the last pick and the squad summary; skip
      // straight to the squad when the feature is off.
      setScreen(TEAM.frontOffice ? 'frontOffice' : 'squadSummary');
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
    const postseasonResult = TEAM.features.postseason
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
    setShowDebugFight(false);
    setForceHockeyFight(false);
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

  // Dev-only: simulate a full, real full-length regular season for a fabricated roster,
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
      opponentPool: rosterState.rivals,
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

  // Dev-only: jump straight to the team's late-season minigame in isolation (the
  // same screen as the ?debug=late-season link) instead of playing a full season
  // sim to reach it — for iterating on the minigame body.
  function handleForceMarchCollapseTest() {
    setShowDebugCollapse(true);
  }

  // Dev-only: jump straight to the Hockey Fight minigame in isolation for iterating on
  // its feel. Starts on the variant the current seed would pick, then the in-screen
  // buttons cycle through all three.
  function handleForceHockeyFightTest(variant: FightVariant) {
    setDebugFightVariant(variant);
    setDebugReplayToken((t) => t + 1);
    setShowDebugFight(true);
  }

  // Dev-only: force the fight to fire inside a real full-season sim (skips the draft
  // via a fabricated roster) so its segmentation + win% boost can be checked in context.
  function handleForceHockeyFightSeasonTest() {
    const fabricatedPicks = fabricateRosterPicks();
    if (!fabricatedPicks) return;
    setRunSeed(getRandomSeed());
    setPicks(fabricatedPicks);
    setForceHockeyFight(true);
    setScreen('simulating');
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

  // Dev-only debug entry point. The team's late-season event (Detroit: March
  // Collapse) boots straight into its minigame in isolation — no season sim around
  // it, so its visuals/UX can be iterated on directly. Reached via either the
  // ?debug=late-season URL (?debug=march-collapse still works) or the intro dev
  // button (handleForceMarchCollapseTest). No roster is passed, so the flow uses
  // its own defaults. Resolving it remounts a fresh run (via the key) so you can go again.
  const lateSeasonEvent = TEAM.events.lateSeason;
  if (import.meta.env.DEV && lateSeasonEvent && (debugScreen === 'late-season' || debugScreen === 'march-collapse' || showDebugCollapse)) {
    return (
      <div className="app-shell">
        <lateSeasonEvent.Flow
          key={debugReplayToken}
          picks={[]}
          seasonsById={seasonsById}
          reduceFlashing={reduceFlashing}
          onResolved={() => setDebugReplayToken((t) => t + 1)}
        />
      </div>
    );
  }

  // Dev-only isolated Hockey Fight: boots straight into the minigame with a variant
  // switcher, no season sim around it, so its visuals/feel can be iterated directly.
  // Reached via ?debug=hockey-fight or the intro dev button. Resolving remounts a
  // fresh run (via the key) so you can go again.
  if (import.meta.env.DEV && (debugScreen === 'hockey-fight' || showDebugFight)) {
    return (
      <div className="app-shell">
        <div className="dev-variant-switch">
          {Array.from({ length: FIGHT_VARIANT_COUNT }, (_, v) => (
            <button
              key={v}
              type="button"
              className={`dev-shortcut-link${debugFightVariant === v ? ' active' : ''}`}
              onClick={() => {
                setDebugFightVariant(v as FightVariant);
                setDebugReplayToken((t) => t + 1);
              }}
            >
              Variant {v + 1}
            </button>
          ))}
        </div>
        <HockeyFightFlow
          key={debugReplayToken}
          variant={debugFightVariant}
          onResolved={() => setDebugReplayToken((t) => t + 1)}
        />
      </div>
    );
  }

  if (screen === 'intro') {
    return (
      <div className="app-shell">
        {/* The standalone (web) build gets a roomier intro: bigger slot machine, more air. */}
        <header className={`intro${platform.showsLeaderboard ? '' : ' intro-standalone'}`}>
          {platform.showsLeaderboard && (
            <p className="intro-eyebrow">r/{subreddit} · {dateStr}</p>
          )}
          <h1 className="intro-title">{gameTitle(platform.showsLeaderboard)}</h1>
          <p className="intro-sub">
            {platform.showsLeaderboard ? (
              <>
                Spin six real {TEAM.identity.name} seasons, draft a starting six, and see where you land on
                today's leaderboard. One play per day, come back tomorrow to see if you can reach
                number{' '}one.
              </>
            ) : (
              <>
                Spin six real {TEAM.identity.name} seasons, draft a starting six, and see how far you can take
                them through the playoffs.
              </>
            )}
          </p>
          <img className="intro-slot-machine" src={TEAM.assets.slotMachine} alt="" />
          <button type="button" className="primary-btn" onClick={handleStart}>
            {platform.showsLeaderboard ? "Start today's draft" : 'Start draft'}
          </button>
          {lateSeasonEvent?.hasFlashingIntro && (
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
            <div className="dev-menu">
              <p className="dev-menu-title">Dev tools</p>
              {TEAM.features.postseason && (
                <div className="dev-group">
                  <p className="dev-group-label">Postseason jumps</p>
                  {devShortcut('Force First Series', handleForceFirstSeriesTest)}
                  {devShortcut('Force Cup Final shootout', handleForceShootoutTest)}
                  {devShortcut('Force Stanley Cup Final', handleForceStanleyCupFinalTest)}
                  {devShortcut('Force Conference Final loss', handleForceConfFinalLossTest)}
                </div>
              )}
              <div className="dev-group">
                <p className="dev-group-label">Season flows</p>
                {TEAM.features.tradeDeadline && devShortcut('Force Trade Deadline', handleForceTradeDeadlineTest)}
                {devShortcut('Force Regular Season', handleForceRegularSeasonTest)}
              </div>
              <div className="dev-group">
                <p className="dev-group-label">In-season minigames</p>
                {lateSeasonEvent && (
                  <button type="button" className="text-btn dev-reset" onClick={handleForceMarchCollapseTest}>
                    🧪 Force {lateSeasonEvent.name} (isolated — platform-independent)
                  </button>
                )}
                {/* Hockey Fight is WIP (hockeyFight feature off): dev buttons force it
                    regardless so it can be worked on while it ships dormant. */}
                {devShortcut('Force Hockey Fight (in season)', handleForceHockeyFightSeasonTest)}
                <p className="dev-shortcut">
                  🧪 Hockey Fight minigame:{' '}
                  <button type="button" className="dev-shortcut-link" onClick={() => handleForceHockeyFightTest(0)}>
                    tug-of-war
                  </button>
                  {' | '}
                  <button type="button" className="dev-shortcut-link" onClick={() => handleForceHockeyFightTest(1)}>
                    punch timing
                  </button>
                  {' | '}
                  <button type="button" className="dev-shortcut-link" onClick={() => handleForceHockeyFightTest(2)}>
                    dodge &amp; counter
                  </button>
                </p>
              </div>
            </div>
          )}
        </header>
      </div>
    );
  }

  if (screen === 'dedication' && TEAM.assets.dedication) {
    return (
      <div className="app-shell">
        <DedicationScreen src={TEAM.assets.dedication.src} alt={TEAM.assets.dedication.alt} onDone={() => setScreen('round')} />
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

  if (screen === 'frontOffice' && frontOffice) {
    return (
      <div className="app-shell">
        <FrontOfficeScreen frontOffice={frontOffice} onContinue={() => setScreen('squadSummary')} />
      </div>
    );
  }

  if (screen === 'squadSummary') {
    return (
      <div className="app-shell">
        <SquadSummaryScreen picks={picks} seasonsById={seasonsById} frontOffice={frontOffice} onSimulate={handleSimulate} />
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
          forceHockeyFight={forceHockeyFight}
          devSkipToDeadline={devSkipToDeadline}
          reduceFlashing={reduceFlashing}
          frontOfficeModifier={frontOffice?.totalModifier ?? 0}
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
          frontOffice={frontOffice}
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
          frontOffice={frontOffice}
          showsLeaderboard={platform.showsLeaderboard}
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

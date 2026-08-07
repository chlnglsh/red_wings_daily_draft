import { useEffect, useRef } from 'react';
import type { DraftPick, Season, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import type { GameResult, SeasonSimResult } from '../lib/gameSim';
import type { PostseasonResult, Series } from '../lib/postseason';
import { TEAM_NAME } from '../data/team';
import stanleyCupSrc from '../assets/stanley-cup.png';
import divisionBannerSrc from '../assets/division-champions-banner.png';
import conferenceBannerSrc from '../assets/conference-champions-banner.png';
import stanleyCupBannerSrc from '../assets/stanleycup-champions-banner.png';

const ROUND_NAMES: Record<number, string> = {
  1: 'First Series',
  2: 'Division Final',
  3: 'Conference Final',
  4: 'Stanley Cup Final',
};

// Same score line as the regular-season recap — plain hyphen, "(OT)" tag on
// anything not decided in regulation.
function gameLine(game: GameResult): string {
  const tag = game.decidedIn === 'REG' ? '' : ' (OT)';
  return `${game.teamGoals}-${game.oppGoals}${tag}`;
}

// The player's own series, in bracket order (First Series → Stanley Cup Final).
// Mirrors PostseasonScreen's getPlayerSeries — the background series the player
// never played are skipped.
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

// The result of one of the player's series, from the player's perspective.
function seriesSummary(s: Series) {
  const playerIsHome = s.home.team.isPlayer;
  const playerWins = playerIsHome ? s.homeWins : s.awayWins;
  const oppWins = playerIsHome ? s.awayWins : s.homeWins;
  const opponent = playerIsHome ? s.away : s.home;
  const won = s.winner?.team.isPlayer === true;
  return { won, playerWins, oppWins, oppName: opponent.team.name };
}

// Post-season recap: the playoff outcome (title + banners), the round-by-round
// playoff run, the drafted lineup, and finally the full regular-season game log.
// Reached from the champion/postseason screen; onBack returns there.
export function PostseasonRecapScreen({
  picks,
  seasonsById,
  simResult,
  postseason,
  onBack,
}: {
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  simResult: SeasonSimResult;
  postseason: PostseasonResult;
  onBack: () => void;
}) {
  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));
  const playerSeries = getPlayerSeries(postseason);

  // Highest round the player actually WON decides which title banners hang.
  // Round 1 (winning the First Series) isn't a title, so it earns none.
  const highestRoundWon = playerSeries.reduce(
    (max, s) => (s.winner?.team.isPlayer ? Math.max(max, s.round) : max),
    0,
  );
  const wonCup = highestRoundWon >= 4;
  const banners: string[] = [];
  if (highestRoundWon >= 2) banners.push(divisionBannerSrc);
  if (highestRoundWon >= 3) banners.push(conferenceBannerSrc);
  if (highestRoundWon >= 4) banners.push(stanleyCupBannerSrc);

  // The header names the highest title the player actually WON, never the
  // elimination — a season with a banner shouldn't be topped by "Eliminated".
  // Won the Cup → Stanley Cup Champions; won the Conference (lost the Cup Final)
  // → Conference Champions; won the Division (lost the Conference Final) →
  // Division Champions; out in the first two rounds (no title) → Full Season Recap.
  const outcomeTitle =
    highestRoundWon >= 4
      ? 'Stanley Cup Champions'
      : highestRoundWon === 3
        ? 'Conference Champions'
        : highestRoundWon === 2
          ? 'Division Champions'
          : 'Full Season Recap';

  // Same edge-aware fade as the regular-season recap log — drop the fade on an edge
  // once you've scrolled fully to it (no more content that way to hint at).
  const logRef = useRef<HTMLDivElement | null>(null);
  function updateEdgeClasses(el: HTMLDivElement | null) {
    if (!el) return;
    el.classList.toggle('at-top', el.scrollTop <= 1);
    el.classList.toggle('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }
  useEffect(() => {
    updateEdgeClasses(logRef.current);
  });

  return (
    <div className="results-screen season-recap rink-backdrop">
      <h1 className="season-recap-title postseason-recap-outcome">{outcomeTitle}</h1>

      {wonCup && <img className="postseason-recap-cup" src={stanleyCupSrc} alt="" />}
      {banners.length > 0 && (
        <div className="postseason-recap-banners">
          {banners.map((src) => (
            <img key={src} className="postseason-recap-banner" src={src} alt="" />
          ))}
        </div>
      )}

      <p className="season-recap-heading">Post-season series</p>
      <div className="postseason-recap-run">
        {/* Most recent series first (Cup Final at top → First Series at bottom).
            Reverse a copy so playerSeries stays in bracket order for the header. */}
        {[...playerSeries].reverse().map((s) => {
          const { won, playerWins, oppWins, oppName } = seriesSummary(s);
          return (
            <div key={s.id} className="postseason-recap-series">
              <p className="postseason-recap-series-line">
                <span className="postseason-recap-round">{ROUND_NAMES[s.round]}</span>
                <span className={`postseason-recap-series-result ${won ? 'win' : 'loss'}`}>
                  {/* A loss is only ever the elimination series, so label it as such. */}
                  {won ? 'Won' : 'Eliminated'} {playerWins}-{oppWins} vs {oppName}
                </span>
              </p>
              <div className="postseason-recap-series-games">
                {s.games.map((g) => (
                  <div key={g.gameNumber} className="season-sim-game">
                    <span className={`season-sim-result ${g.result === 'W' ? 'win' : 'loss'}`}>{g.result}</span>
                    <span className="season-sim-opponent">
                      Game {g.gameNumber} vs {g.opponent} {g.home ? '(H)' : '(A)'}
                    </span>
                    <span className="season-sim-score">{gameLine(g)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="season-recap-heading">Your lineup</p>
      <div className="results-roster">
        {SLOT_ORDER.map((slot) => {
          const pick = bySlot.get(slot);
          if (!pick) return null;
          const season = seasonsById.get(pick.seasonId)!;
          return (
            <div key={slot} className="results-roster-row">
              <span className="results-roster-slot">{slot}</span>
              <span className="results-roster-name">{pick.player.name}</span>
              <span className="results-roster-season">{season.year}</span>
            </div>
          );
        })}
      </div>

      <p className="season-recap-heading">Regular season games</p>
      <div className="season-recap-log" ref={logRef} onScroll={(e) => updateEdgeClasses(e.currentTarget)}>
        {simResult.games.map((g) => (
          <div key={g.gameNumber} className="season-sim-game">
            <span className={`season-sim-result ${g.result === 'W' ? 'win' : 'loss'}`}>{g.result}</span>
            <span className="season-sim-opponent">
              G{g.gameNumber} vs {g.opponent} {g.home ? '(H)' : '(A)'}
            </span>
            <span className="season-sim-score">{gameLine(g)}</span>
          </div>
        ))}
      </div>

      <button type="button" className="primary-btn" onClick={onBack}>
        Back
      </button>
      <p className="season-recap-footer">{TEAM_NAME} Daily Draft</p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { DraftPick, Season, SlotId } from '../types';
import { SLOT_ORDER } from '../types';
import { rosterScore, pickPercentile } from '../lib/scoring';
import { getTierFromPoints, getTierFromRosterScore } from '../lib/tiers';
import { simulateRecord } from '../lib/simulate';
import { SEASON_LENGTH, type SeasonSimResult } from '../lib/gameSim';
import { rankAmong, type LeaderboardEntry, type Platform } from '../lib/platform';
import { buildShareText } from '../lib/share';
import type { PostseasonResult } from '../lib/postseason';
import { TEAM_NAME } from '../data/team';

function squareClass(percentile: number): string {
  if (percentile >= 0.75) return 'pick-square good';
  if (percentile >= 0.4) return 'pick-square mid';
  return 'pick-square low';
}

export function ResultsScreen({
  dateStr,
  dateSeed,
  subreddit,
  picks,
  seasonsById,
  simResult,
  postseason,
  onStartPostseason,
  onPlayAgain,
  onShowRecap,
  platform,
}: {
  dateStr: string;
  dateSeed: number;
  subreddit: string;
  picks: DraftPick[];
  seasonsById: Map<string, Season>;
  simResult: SeasonSimResult;
  // null in a regular-season-only build (HAS_POSTSEASON off): the playoff callout
  // and divisional standings below are hidden and this screen is the final one.
  postseason: PostseasonResult | null;
  onStartPostseason: () => void;
  onPlayAgain: () => void;
  onShowRecap: () => void;
  platform: Platform;
}) {
  const [copied, setCopied] = useState(false);
  // null = not shown (no leaderboard on this platform) or still loading.
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    if (!platform.showsLeaderboard) return;
    let cancelled = false;
    platform.getLeaderboard(dateSeed).then((entries) => {
      if (!cancelled) setLeaderboard(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [platform, dateSeed]);

  const score = useMemo(() => rosterScore(picks, seasonsById), [picks, seasonsById]);
  const predicted = useMemo(() => simulateRecord(score), [score]);
  const pointsPct = simResult.points / (SEASON_LENGTH * 2);
  const tier = useMemo(() => getTierFromPoints(pointsPct), [pointsPct]);
  const predictedTier = useMemo(() => getTierFromRosterScore(score), [score]);

  const rankInfo = useMemo(
    () => (leaderboard ? rankAmong(simResult.points, leaderboard) : null),
    [simResult.points, leaderboard],
  );

  const shareText = useMemo(
    () =>
      buildShareText({
        dateStr, tier, record: simResult, picks, seasonsById, subreddit,
        rank: rankInfo?.rank, totalPlayers: rankInfo?.total,
      }),
    [dateStr, tier, simResult, picks, seasonsById, subreddit, rankInfo],
  );

  const bySlot = new Map<SlotId, DraftPick>(picks.map((p) => [p.slot, p]));
  const rankedLeaderboard = (leaderboard ?? []).slice().sort((a, b) => b.points - a.points);
  const nearby = rankInfo ? rankedLeaderboard.slice(Math.max(0, rankInfo.rank - 4), rankInfo.rank + 2) : [];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — nothing to do in the Phase 1 prototype
    }
  }

  const pointsDiff = simResult.points - predicted.points;
  const atlanticRank = postseason ? postseason.atlanticStandings.findIndex((t) => t.isPlayer) + 1 : 0;
  const metroStandings = postseason ? postseason.eastStandings.filter((t) => t.division === 'Metropolitan') : [];

  return (
    <div className="results-screen rink-backdrop">
      <p className="results-eyebrow">r/{subreddit} · {dateStr}</p>
      <div className="results-tier">
        <span className="results-tier-emoji">{tier.emoji}</span>
        <h1 className="results-tier-label">{tier.label}</h1>
        <p className="results-tier-flavor">{tier.flavor}</p>
      </div>
      <p className="results-record">
        {simResult.wins}-{simResult.losses}-{simResult.otl}
      </p>
      <p className="results-points">
        {simResult.points} standings pts · {simResult.goalsFor}-{simResult.goalsAgainst} GF-GA over {SEASON_LENGTH} games
      </p>
      <p className="results-vs-predicted">
        {pointsDiff > 0 && `📈 ${pointsDiff} pts above predicted pace`}
        {pointsDiff < 0 && `📉 ${Math.abs(pointsDiff)} pts below predicted pace`}
        {pointsDiff === 0 && '🎯 right on predicted pace'}
      </p>

      <p className="predicted-comparison">
        Predicted standing: {predictedTier.emoji} {predictedTier.label} ({predicted.wins}-{predicted.losses}-{predicted.otl})
      </p>

      {postseason &&
        (postseason.qualified ? (
          <div className="postseason-callout qualified">
            <p className="postseason-callout-label">🏒 Playoff berth clinched — {postseason.playerSeedLabel} seed</p>
            <p className="postseason-callout-detail">The postseason starts now. Every game from here counts.</p>
            <button type="button" className="primary-btn" onClick={onStartPostseason}>
              Enter the Playoffs
            </button>
          </div>
        ) : (
          <div className="postseason-callout missed">
            <p className="postseason-callout-label">Missed the playoffs this time</p>
            <p className="postseason-callout-detail">
              {atlanticRank}th in the Atlantic wasn't enough to qualify — see how the division shook out below.
            </p>
          </div>
        ))}

      {/* End-of-run actions sit right under the outcome callout for a non-qualifier
          (or a regular-season-only build with no bracket) — this is where their run
          ends. Standalone gets a "Draft again" (no daily gate); qualifiers instead
          finish after the postseason, so both actions live on the champion screen. */}
      {!platform.showsLeaderboard && !postseason?.qualified && (
        <button type="button" className="primary-btn" onClick={onPlayAgain}>
          Draft again
        </button>
      )}

      {!postseason?.qualified && (
        <button type="button" className="text-btn recap-btn" onClick={onShowRecap}>
          View regular season recap
        </button>
      )}

      {postseason?.qualified && (
        <div className="results-standings">
          <p className="results-standings-heading">Eastern Conference standings</p>
          <div className="standings-group">
            <p className="standings-group-label">Atlantic</p>
            <ol className="standings-table standings-table-primary">
              {postseason.atlanticStandings.map((team, i) => (
                <li key={team.name} className={team.isPlayer ? 'you' : ''}>
                  <span className="standings-rank">#{i + 1}</span>
                  <span className="standings-name">{team.isPlayer ? `You (${TEAM_NAME})` : team.name}</span>
                  <span className="standings-points">{team.points} pts</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="standings-group">
            <p className="standings-group-label">Metropolitan</p>
            <ol className="standings-table standings-table-secondary">
              {metroStandings.map((team, i) => (
                <li key={team.name}>
                  <span className="standings-rank">#{i + 1}</span>
                  <span className="standings-name">{team.name}</span>
                  <span className="standings-points">{team.points} pts</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="results-roster">
        {SLOT_ORDER.map((slot) => {
          const pick = bySlot.get(slot);
          if (!pick) return null;
          const season = seasonsById.get(pick.seasonId)!;
          const pct = pickPercentile(pick.player, season);
          return (
            <div key={slot} className="results-roster-row">
              <span className={squareClass(pct)} />
              <span className="results-roster-slot">{slot}</span>
              <span className="results-roster-name">{pick.player.name}</span>
              <span className="results-roster-season">{season.year}</span>
            </div>
          );
        })}
      </div>

      {rankInfo && (
        <>
          <div className="results-rank">
            Rank <strong>#{rankInfo.rank}</strong> of {rankInfo.total} in r/{subreddit} today
          </div>

          <ol className="mock-leaderboard">
            {nearby.map((entry, i) => {
              const entryRank = Math.max(0, rankInfo.rank - 4) + i + 1;
              const isYou = entryRank === rankInfo.rank;
              const entryRecord = isYou ? simResult : entry;
              return (
                <li key={entry.username + i} className={isYou ? 'you' : ''}>
                  <span className="mock-leaderboard-rank">#{entryRank}</span>
                  <span className="mock-leaderboard-name">{isYou ? 'You' : entry.username}</span>
                  <span className="mock-leaderboard-record">
                    {entryRecord.wins}-{entryRecord.losses}-{entryRecord.otl}
                  </span>
                  <span className="mock-leaderboard-score">{entryRecord.points} pts</span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <div className="share-block">
        <pre className="share-text">{shareText}</pre>
        <button type="button" className="primary-btn" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy shareable result'}
        </button>
      </div>

      {platform.showsLeaderboard && (
        <p className="results-daily-note">
          One play per day. Come back tomorrow for a fresh draft and leaderboard.
        </p>
      )}

      {import.meta.env.DEV && (
        <button type="button" className="text-btn dev-reset" onClick={onPlayAgain}>
          ↺ Replay (dev only — real game is once per day)
        </button>
      )}
    </div>
  );
}

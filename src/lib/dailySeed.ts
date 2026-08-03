import { hashStringToInt } from './prng';

/** UTC calendar date as YYYY-MM-DD, used for display only — spins are no longer tied to it. */
export function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Fresh random seed for a single playthrough — every play can land on any season, no shared/repeatable sequence. */
export function getRandomSeed(): number {
  const timePart = Date.now() & 0xffffffff;
  const randPart = Math.floor(Math.random() * 0xffffffff);
  return hashStringToInt(`${timePart}:${randPart}`);
}

/** Seed for the day's mock leaderboard pool — this one IS still tied to the calendar date, since "everyone who played today" is a date-scoped concept even though individual spins are no longer shared. */
export function getDateSeed(date: Date = new Date()): number {
  return hashStringToInt(`red-wings-daily-draft:leaderboard:${getUtcDateString(date)}`);
}

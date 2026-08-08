// GM/Coach mechanic (V2 priority 5): the simplest of the season modifiers. Once the
// draft's six positions are filled, roll a GM and a Coach independently from tiered
// pools of real historical Red Wings figures. A figure's tier sets a FLAT season-long
// win% nudge; the two stack additively on top of baseWinPct and apply across all 82
// games (no roster mutation, no time-windowed effect).
//
// Two design rules baked in here:
//   - Recency weighting: figures whose Detroit tenure started in 1990 or later roll
//     twice as often (they're the names players recognize). The pools are tiered and
//     sized so that, even with that weighting, the combined GM+Coach modifier lands in
//     a roughly normal curve centered near zero.
//   - Same-person bar: several people held both jobs, so the Coach is drawn from the
//     pool minus whoever was rolled as GM (no "Jack Adams reports to Jack Adams").
//
// Tone: every summary is strictly performance-based and light. Never reference off-ice
// conduct or personal controversy for any real figure, regardless of public record.

export type FrontOfficeTier = 'elite' | 'strong' | 'average' | 'weak' | 'rough';

export interface FrontOfficeRoll {
  name: string;
  tier: FrontOfficeTier;
  modifier: number;
  summary: string;
}

export interface GmCoachResult {
  gm: FrontOfficeRoll;
  coach: FrontOfficeRoll;
  // Combined flat win% adjustment (gm.modifier + coach.modifier), applied to every
  // game's baseWinPct for the whole season.
  totalModifier: number;
}

// Per-roll flat win% nudge by tier (1 tier step = 0.0125 win%). Each roll spans
// +/-0.025, so the two rolls together swing at most +/-0.05 — a modest luck nudge,
// deliberately decoupled from (and much smaller than) the March Collapse skill event.
// Tune here.
export const TIER_MODIFIER: Record<FrontOfficeTier, number> = {
  elite: 0.025,
  strong: 0.0125,
  average: 0,
  weak: -0.0125,
  rough: -0.025,
};

// A pool entry: tier drives the modifier, startYear drives the recency weight (2x if
// 1990 or later), summary is the one-line reveal blurb.
interface PoolEntry {
  name: string;
  tier: FrontOfficeTier;
  startYear: number;
  summary: string;
}

const GM_POOL: PoolEntry[] = [
  { name: 'Jack Adams', tier: 'elite', startYear: 1927, summary: 'Built the Red Wings into a powerhouse, overseeing a dynasty that raised seven Stanley Cup banners.' },
  { name: 'Ken Holland', tier: 'elite', startYear: 1997, summary: 'Architect of the modern contender, with three Stanley Cups and a decades-long run of playoff seasons.' },
  { name: 'Jim Devellano', tier: 'strong', startYear: 1982, summary: 'Drafted the cornerstones of the next dynasty, from Steve Yzerman to Nicklas Lidstrom.' },
  { name: 'Steve Yzerman', tier: 'strong', startYear: 2019, summary: 'The Captain returned to run the rebuild, restocking the pipeline with premium draft picks.' },
  { name: 'Sid Abel', tier: 'average', startYear: 1962, summary: 'Guided competitive Wings teams through the 1960s without breaking through to a title.' },
  { name: 'Bryan Murray', tier: 'average', startYear: 1990, summary: 'Ran strong regular-season rosters in the early 90s that kept falling short in the playoffs.' },
  { name: 'Ted Lindsay', tier: 'average', startYear: 1977, summary: 'Briefly revived the front office at the end of the 70s before the wins tailed off.' },
  { name: 'Alex Delvecchio', tier: 'weak', startYear: 1974, summary: 'Took the GM reins during the lean mid-70s and never found traction in the standings.' },
  { name: 'Jimmy Skinner', tier: 'weak', startYear: 1980, summary: 'Managed through a rebuilding stretch in the early 80s with little to show for it.' },
  { name: 'Ned Harkness', tier: 'rough', startYear: 1970, summary: 'His front-office tenure defined the franchise rockiest stretch of the early 70s.' },
];

const COACH_POOL: PoolEntry[] = [
  { name: 'Scotty Bowman', tier: 'elite', startYear: 1993, summary: 'The winningest coach in NHL history, steering Detroit to three Stanley Cups.' },
  { name: 'Tommy Ivan', tier: 'elite', startYear: 1947, summary: 'Coached the 1950s dynasty to three Stanley Cups in six seasons.' },
  { name: 'Jack Adams', tier: 'strong', startYear: 1927, summary: 'Patrolled the bench for two decades and delivered the franchise first Stanley Cups.' },
  { name: 'Jacques Demers', tier: 'strong', startYear: 1986, summary: 'Won back-to-back coach of the year and pushed the Wings to consecutive conference finals.' },
  { name: 'Sid Abel', tier: 'average', startYear: 1957, summary: 'Coached the Wings through more than a decade of 1960s near-misses.' },
  { name: 'Jimmy Skinner', tier: 'average', startYear: 1954, summary: 'Won the 1955 Cup early on, though the dynasty wound down over his brief tenure.' },
  { name: 'Bobby Kromm', tier: 'average', startYear: 1977, summary: 'Led the late-70s Wings back to the playoffs for a rare bright spot in a down era.' },
  { name: 'Todd McLellan', tier: 'average', startYear: 2024, summary: 'The current bench boss, brought in mid-season to steady a rebuilding club.' },
  { name: 'Mike Babcock', tier: 'average', startYear: 2005, summary: 'Ran a decade of playoff teams through the late 2000s and early 2010s.' },
  { name: 'Dave Lewis', tier: 'average', startYear: 2002, summary: 'Won big in the regular season in the early 2000s but stalled in the early playoff rounds.' },
  { name: 'Jeff Blashill', tier: 'weak', startYear: 2015, summary: 'Coached through the long rebuild, missing the playoffs in most of his seasons.' },
  { name: 'Alex Delvecchio', tier: 'weak', startYear: 1973, summary: 'Ran the bench during the lean mid-70s with little success.' },
  { name: 'Derek Lalonde', tier: 'weak', startYear: 2022, summary: 'Guided the rebuild next step without quite breaking the playoff drought.' },
  { name: 'Nick Polano', tier: 'weak', startYear: 1982, summary: 'Coached the early-80s Wings through some of the franchise thinnest rosters.' },
  { name: 'Bill Gadsby', tier: 'weak', startYear: 1968, summary: 'A Hall of Fame defenseman whose brief late-60s coaching stint did not take.' },
  { name: 'Johnny Wilson', tier: 'weak', startYear: 1971, summary: 'Coached a couple of middling early-70s seasons behind the Detroit bench.' },
  { name: 'Ned Harkness', tier: 'rough', startYear: 1970, summary: 'His short bench tenure marked one of the franchise low points.' },
  { name: 'Harry Neale', tier: 'rough', startYear: 1985, summary: 'Took over a struggling mid-80s club and could not turn its fortunes around.' },
  { name: 'Ted Garvin', tier: 'rough', startYear: 1973, summary: 'Lasted just a dozen games behind the bench in the fall of 1973.' },
];

// Name lists for the spin-reel animation on the front-office reveal (display only).
export const GM_NAMES: string[] = GM_POOL.map((e) => e.name);
export const COACH_NAMES: string[] = COACH_POOL.map((e) => e.name);

function weightOf(entry: PoolEntry): number {
  return entry.startYear >= 1990 ? 2 : 1;
}

function toRoll(entry: PoolEntry): FrontOfficeRoll {
  return { name: entry.name, tier: entry.tier, modifier: TIER_MODIFIER[entry.tier], summary: entry.summary };
}

// Weighted pick from a pool: draws one rng value and walks the cumulative weights.
function weightedPick(pool: PoolEntry[], rng: () => number): PoolEntry {
  const total = pool.reduce((sum, e) => sum + weightOf(e), 0);
  let r = rng() * total;
  for (const entry of pool) {
    r -= weightOf(entry);
    if (r < 0) return entry;
  }
  return pool[pool.length - 1]; // rng===1 fallback (never with mulberry32, which is [0,1))
}

/**
 * Rolls the GM and Coach for a season. Consumes exactly two draws from the given rng
 * (GM first, then Coach), so callers must invoke it at a fixed point in a deterministic
 * rng stream. The Coach is drawn from the pool minus whoever was rolled as GM.
 */
export function rollGmCoach(rng: () => number): GmCoachResult {
  const gm = weightedPick(GM_POOL, rng);
  const coach = weightedPick(COACH_POOL.filter((e) => e.name !== gm.name), rng);
  const gmRoll = toRoll(gm);
  const coachRoll = toRoll(coach);
  return { gm: gmRoll, coach: coachRoll, totalModifier: gmRoll.modifier + coachRoll.modifier };
}

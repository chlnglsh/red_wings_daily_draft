import type { FrontOfficeConfig } from '../types';

// Tiered pools of real historical Red Wings figures for the GM/Coach roll (see
// lib/gmCoach.ts for the mechanic). The pools are tiered and sized so that, even
// with the 2x recency weighting from 1990 on, the combined GM+Coach modifier lands
// in a roughly normal curve centered near zero.
//
// Tone: every summary is strictly performance-based and light. Never reference off-ice
// conduct or personal controversy for any real figure, regardless of public record.
export const FRONT_OFFICE: FrontOfficeConfig = {
  recencyCutoffYear: 1990,
  gmPool: [
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
  ],
  coachPool: [
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
  ],
};

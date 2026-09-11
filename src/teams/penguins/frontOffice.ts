import type { FrontOfficeConfig } from '../types';

// Tiered pools of real Penguins GMs and coaches for the GM/Coach roll (see
// lib/gmCoach.ts). Membership, tiers, and start years are LOCKED per the Penguins
// spec (2026-09-10) and the combined curve was checked against Detroit's shape.
// Two team-specific rules from that spec: recency weighting kicks in at 1989 so
// Craig Patrick rolls 2x with the Cup-era names, and Red Kelly rolls 2x in BOTH
// pools as a named legend (weight override; tiers stay strictly performance-based).
//
// VERIFY names and years against Wikipedia before this ships (roadmap open question
// 5); only Red Kelly's GM stint (May 1970 to Jan 1972) has been verified so far.
//
// Tone: every summary is strictly performance-based and light. Never reference off-ice
// conduct or personal controversy for any real figure, regardless of public record.
export const FRONT_OFFICE: FrontOfficeConfig = {
  recencyCutoffYear: 1989,
  gmPool: [
    { name: 'Craig Patrick', tier: 'elite', startYear: 1989, summary: 'Assembled the back-to-back Cup teams of 1991 and 1992 and ran the front office for 17 years.' },
    { name: 'Jim Rutherford', tier: 'elite', startYear: 2014, summary: 'Retooled a stalled contender on the fly into back-to-back Stanley Cup champions.' },
    { name: 'Ray Shero', tier: 'strong', startYear: 2006, summary: 'Built around Crosby and Malkin and delivered the 2009 Stanley Cup.' },
    { name: 'Kyle Dubas', tier: 'average', startYear: 2023, summary: 'The current general manager, still writing his Pittsburgh chapter.' },
    { name: 'Eddie Johnston', tier: 'average', startYear: 1983, summary: 'Held the top pick that became Mario Lemieux and started the climb back.' },
    { name: 'Baz Bastien', tier: 'average', startYear: 1976, summary: 'Steered the late-70s Penguins to a string of playoff appearances.' },
    { name: 'Ron Hextall', tier: 'average', startYear: 2021, summary: 'Two seasons at the helm, one playoff trip and one near miss.' },
    { name: 'Jack Button', tier: 'weak', startYear: 1974, summary: 'A one-season stint in the front office during the mid-70s shuffle.' },
    { name: 'Wren Blair', tier: 'weak', startYear: 1975, summary: 'Briefly ran hockey operations in the mid-70s without moving the standings.' },
    { name: 'Red Kelly', tier: 'weak', startYear: 1970, weight: 2, summary: 'The Hall of Famer doubled as general manager in the early 70s with mixed results.' },
    { name: 'Jack Riley', tier: 'rough', startYear: 1967, summary: 'The original general manager, whose two stints spanned the lean expansion years.' },
    { name: 'Tony Esposito', tier: 'rough', startYear: 1988, summary: 'The Hall of Fame goalie lasted one turbulent season in the front office.' },
  ],
  coachPool: [
    { name: 'Mike Sullivan', tier: 'elite', startYear: 2015, summary: 'Took over midseason and won back-to-back Stanley Cups in his first two years.' },
    { name: 'Scotty Bowman', tier: 'elite', startYear: 1991, summary: 'Stepped in behind the bench and steered the Penguins to the 1992 Stanley Cup.' },
    { name: 'Bob Johnson', tier: 'elite', startYear: 1990, summary: 'Badger Bob coached Pittsburgh to its first Stanley Cup in 1991.' },
    { name: 'Dan Bylsma', tier: 'strong', startYear: 2009, summary: 'Took over in February and had the Cup in June, then five straight playoff years.' },
    { name: 'Michel Therrien', tier: 'strong', startYear: 2005, summary: 'Coached the young core to the 2008 Stanley Cup Final.' },
    { name: 'Eddie Johnston', tier: 'average', startYear: 1980, summary: 'Two separate turns behind the bench across the 80s and 90s, playoffs in most of them.' },
    { name: 'Kevin Constantine', tier: 'average', startYear: 1997, summary: 'A division title in his first year, then a slide the following season.' },
    { name: 'Ivan Hlinka', tier: 'average', startYear: 2000, summary: 'Guided the 2001 team to the conference final in his only full season.' },
    { name: 'Herb Brooks', tier: 'average', startYear: 1999, summary: 'The Miracle on Ice coach steadied a midseason club into the playoffs.' },
    { name: 'Red Kelly', tier: 'average', startYear: 1969, weight: 2, summary: 'Coached the Penguins to their first playoff series win in 1970.' },
    { name: 'Rick Kehoe', tier: 'average', startYear: 2001, summary: 'A franchise scoring great whose bench tenure came as the roster thinned out.' },
    { name: 'Dan Muse', tier: 'average', startYear: 2025, summary: 'The current bench boss, still writing his Pittsburgh chapter.' },
    { name: 'Johnny Wilson', tier: 'weak', startYear: 1977, summary: 'Three late-70s seasons behind the bench with a couple of quick playoff exits.' },
    { name: 'Bob Berry', tier: 'weak', startYear: 1984, summary: 'Coached the first Lemieux seasons while the roster was still being rebuilt.' },
    { name: 'Eddie Olczyk', tier: 'weak', startYear: 2003, summary: 'Ran the bench through the last-place season that landed the Fleury era.' },
    { name: 'Mike Johnston', tier: 'weak', startYear: 2014, summary: 'A season and a half of a stalled contender before the midseason change.' },
    { name: 'Ken Schinkel', tier: 'weak', startYear: 1973, summary: 'Two separate mid-70s stints behind the bench without a playoff breakthrough.' },
    { name: 'Marc Boileau', tier: 'weak', startYear: 1974, summary: 'Coached the 89-point 1975 team that let a 3-0 series lead slip away.' },
    { name: 'Red Sullivan', tier: 'weak', startYear: 1967, summary: 'The franchise\'s first coach, through two expansion-era seasons.' },
    { name: 'Lou Angotti', tier: 'rough', startYear: 1983, summary: 'Behind the bench for the worst season in franchise history.' },
    { name: 'Pierre Creamer', tier: 'rough', startYear: 1987, summary: 'One season that missed the playoffs on the final day despite 168 Lemieux points.' },
    { name: 'Gene Ubriaco', tier: 'rough', startYear: 1988, summary: 'A playoff round won in 1989, then a fast exit the following autumn.' },
  ],
};

import type { Season } from '../../types';

// Pittsburgh Penguins season/roster data. EMPTY until real, user-approved seasons
// land here — defineTeam() refuses an empty pool, so a TEAM=penguins build will
// not start until the first one does. That is deliberate: no roster or stat in
// this file is ever generated; each season is sourced from its Wikipedia season
// page (hockey-reference blocks automated access) and approved before it goes in.
//
// Roster shape per season, same as Detroit: top 4 LW / 4 C / 4 RW / 6 D / 2 G by
// games played. Fields: id, year, label ("1990-91 Penguins"), scheduledGames,
// leagueAvgGoalsPerGame (2x the league's average goals-for per team per game),
// teamPoints, era (below), blurb (one line, performance-based, no em-dashes),
// roster. Pre-1955-56 goalies would omit savePct, but no Penguins season predates it.
//
// LOCKED SEASON POOL (38 seasons, user-selected 2026-09-10; 2025-26 excluded):
//   era 'expansion' (1967-84, 8):  1967-68, 1969-70, 1971-72, 1974-75, 1975-76,
//                                  1978-79, 1981-82, 1983-84
//   era 'lemieux'   (1984-2004, 14): 1984-85, 1987-88, 1988-89, 1989-90, 1990-91,
//                                  1991-92, 1992-93, 1993-94, 1994-95, 1995-96,
//                                  1997-98, 1999-2000, 2000-01, 2003-04
//   era 'crosby'    (2005-, 16):   2005-06, 2006-07, 2007-08, 2008-09, 2010-11,
//                                  2011-12, 2012-13, 2013-14, 2014-15, 2015-16,
//                                  2016-17, 2018-19, 2020-21, 2021-22, 2022-23,
//                                  2024-25
// Verify each season's record and hook against its Wikipedia page when sourcing.
export const SEASONS: Season[] = [];

// Pixel art that replaces an emoji inside the results-tier badge circle
// (.results-tier-emoji). User art, 2026-09-14; roadmap item 35, the
// emoji-to-pixel-art pass. Each PNG was drawn for this 84px circle, keyed off a
// green screen, cropped to the glyph and centred in a 256px square so 2x and 3x
// phone screens stay crisp. Glyph size is set by canvas padding, not CSS: the
// cup is padded 1.04x its glyph; crown and medal 1.22x; the broken stick 1.30x;
// tools, bubbles, skate and flame 1.40x, so the busier glyphs sit smaller in the
// circle (user sizing, 2026-09-14). Every tier has one; the emoji in each team's flavor pack is now only used by the
// share text and the inline 'Predicted standing' lines.
//
// Shared across teams for now: the circle already carries the team colour. If a
// team ever wants its own set, this is the map to route through TeamConfig.
import type { TierId } from '../teams/types';
import rebuildYear from '../assets/badge-rebuild-year.png';
import bubbleTeam from '../assets/badge-bubble-team.png';
import playoffPush from '../assets/badge-playoff-push.png';
import contender from '../assets/badge-contender.png';
import cupContender from '../assets/badge-cup-contender.png';
import dynasty from '../assets/badge-dynasty.png';
import lostFinal from '../assets/badge-lost-final.png';
import eliminated from '../assets/badge-eliminated.png';

/** Regular-season result tiers, one per TierId. */
export const TIER_BADGE_ART: Record<TierId, string> = {
  rebuildYear,
  bubbleTeam,
  playoffPush,
  contender,
  cupContender,
  dynasty,
};

/** Playoff-exit badges on the finished postseason screen (champions get the big Cup). */
export const PLAYOFF_BADGE_ART = {
  lostFinal,
  eliminated,
};

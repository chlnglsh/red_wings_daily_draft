import type { TeamConfig } from './types';

// Builds a team config and validates the cross-references a type can't: every
// season points at a declared era, ids are unique, and no era's rival pool
// contains the team itself (the feed would show you playing yourself). Throws
// at module load — a config mistake fails the build/dev server immediately
// instead of surfacing as a silent wrong spin or a bad opponent name.
export function defineTeam(config: TeamConfig): TeamConfig {
  const { id, identity, eras, seasons, frontOffice } = config;
  const fullName = `${identity.city} ${identity.name}`;
  const fail = (msg: string): never => {
    throw new Error(`Team config "${id}": ${msg}`);
  };

  if (eras.length === 0) fail('needs at least one era');
  const eraIds = new Set<string>();
  for (const era of eras) {
    if (eraIds.has(era.id)) fail(`duplicate era id "${era.id}"`);
    eraIds.add(era.id);
    if (!(era.weight > 0)) fail(`era "${era.id}" needs a positive weight`);
    if (era.rivals.length === 0) fail(`era "${era.id}" needs at least one rival`);
    if (era.rivals.includes(fullName)) fail(`era "${era.id}" lists the team itself as a rival`);
  }

  if (seasons.length === 0) fail('needs at least one season');
  const seasonIds = new Set<string>();
  for (const season of seasons) {
    if (seasonIds.has(season.id)) fail(`duplicate season id "${season.id}"`);
    seasonIds.add(season.id);
    if (!eraIds.has(season.era)) fail(`season "${season.id}" uses undeclared era "${season.era}"`);
  }

  if (frontOffice) {
    if (frontOffice.gmPool.length === 0) fail('frontOffice.gmPool is empty');
    if (frontOffice.coachPool.length < 2) fail('frontOffice.coachPool needs at least two entries (the coach is drawn from the pool minus the rolled GM)');
  }

  return config;
}

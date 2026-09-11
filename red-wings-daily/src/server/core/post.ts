/* global __TEAM_NAME__ */
import { reddit } from '@devvit/web/server';

// Server code runs outside the symlinked app/ tree (see redditPlatform.ts's own
// comment on why), so the team name arrives as a build-time constant from
// vite.config.ts rather than an import of the team config.
export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: `${__TEAM_NAME__} Daily Draft! Click to draft a team to make your cup run`,
  });
};

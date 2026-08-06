import { reddit } from '@devvit/web/server';

// Server code runs outside the symlinked app/ tree (see redditPlatform.ts's own
// comment on why), so it can't import src/data/team.ts or flavorText.ts directly —
// this title has to be kept in sync with TEAM_FULL_NAME by hand when reskinning.
export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'Red Wings Daily Draft! Click to draft a team to make your cup run',
  });
};

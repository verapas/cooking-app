import type { PageServerLoad } from './$types';
import { requireSpaceId } from '$lib/server/spaces';
import { listTags } from '$lib/server/queries';

export const load: PageServerLoad = async ({ locals }) => {
  return { tags: await listTags(requireSpaceId(locals)) };
};

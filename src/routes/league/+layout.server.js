import { redirect } from '@sveltejs/kit';

export async function load({ parent, url }) {
  const { profile } = await parent();

  if (url.pathname.startsWith('/league/applicants')) {
    if (!profile?.is_admin && !profile?.is_commissioner) {
      throw redirect(303, '/league');
    }
  }

  return {};
}

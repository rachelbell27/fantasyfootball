import { redirect, fail } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session, profile } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  console.log('[PROFILE load] profile from parent:', profile
    ? {
        id: profile.id,
        username: profile.username,
        is_admin: profile.is_admin,
        is_commissioner: profile.is_commissioner,
        primary_color: profile.primary_color,
        secondary_color: profile.secondary_color,
        timezone: profile.timezone,
      }
    : null
  );

  return { profile };
}

export const actions = {
  update: async ({ request, parent }) => {
    const { session, profile } = await parent();
    if (!session) throw redirect(303, '/auth/login');

    const data = await request.formData();
    const displayName = data.get('displayName')?.toString().trim();
    const primaryColor = data.get('primaryColor')?.toString().trim();
    const secondaryColor = data.get('secondaryColor')?.toString().trim();
    const timezone = data.get('timezone')?.toString().trim();

    console.log('[PROFILE update] form values received:', {
      displayName,
      primaryColor,
      secondaryColor,
      timezone,
      profileId: profile?.id,
    });

    if (!displayName) return fail(400, { error: 'Display name is required' });

    if (!profile?.id) {
      console.error('[PROFILE update] no profile.id — cannot update');
      return fail(400, { error: 'User profile not found. Try signing out and back in.' });
    }

    const db = await createClient();
    try {
      console.log('[PROFILE update] running DB UPDATE for user id:', profile.id);
      const result = await db.query(
        `UPDATE users
         SET display_name = $1, primary_color = $2, secondary_color = $3,
             timezone = $4
         WHERE id = $5
         RETURNING id, display_name, primary_color, secondary_color, timezone`,
        [displayName, primaryColor || null, secondaryColor || null, timezone || null, profile.id]
      );

      console.log('[PROFILE update] DB result rows:', result.rows.length, result.rows[0] ?? '(none)');

      if (result.rows.length === 0) return fail(404, { error: 'User not found in DB' });

      return { success: true, profile: result.rows[0] };
    } catch (e) {
      console.error('[PROFILE update] DB error:', e.message, e.stack);
      return fail(500, { error: `DB error: ${e.message}` });
    } finally {
      await db.end();
    }
  }
};

import { serverSupabase, supabasePublicConfig } from '$lib/server/auth.js';
import { createClient } from '$lib/server/db.js';

export async function load({ cookies }) {
  let session = null;
  let profile = null;

  try {
    const supabase = serverSupabase(cookies);
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch (e) {
    console.error('Supabase session error:', e);
  }

  if (session) {
    let db;
    try {
      db = await createClient();
      let result = await db.query(
        `SELECT id, username, display_name, is_admin, is_commissioner,
                primary_color, secondary_color, timezone
         FROM users WHERE supabase_uid = $1`,
        [session.user.id]
      );

      if (result.rows.length === 0) {
        const email = session.user.email ?? '';
        const displayName = session.user.user_metadata?.display_name
          ?? email.split('@')[0];

        result = await db.query(
          `INSERT INTO users (username, display_name, supabase_uid, is_admin)
           VALUES ($1, $2, $3, false)
           ON CONFLICT (supabase_uid) DO UPDATE SET username = EXCLUDED.username
           RETURNING id, username, display_name, is_admin, is_commissioner,
                     primary_color, secondary_color, timezone`,
          [email, displayName, session.user.id]
        );

        if (result.rows.length > 0) {
          await db.query(
            `INSERT INTO league_members (league_id, user_id)
             VALUES (1, $1) ON CONFLICT DO NOTHING`,
            [result.rows[0].id]
          );
        }
      }

      profile = result.rows[0] ?? null;
    } catch (e) {
      console.error('DB profile error:', e);
    } finally {
      await db?.end();
    }
  }

  return { session, profile, supabase: supabasePublicConfig };
}

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

  let availableYears = [];
  if (session) {
    let db;
    try {
      db = await createClient();

      const yearsRes = await db.query(
        `SELECT DISTINCT season_year FROM games ORDER BY season_year DESC`
      );
      availableYears = yearsRes.rows.map(r => r.season_year);

      const profileCols = `id, username, display_name, is_admin, is_commissioner,
                           primary_color, secondary_color, timezone, theme_preference`;

      let result = await db.query(
        `SELECT ${profileCols} FROM users WHERE supabase_uid = $1`,
        [session.user.id]
      );

      if (result.rows.length === 0) {
        const email = session.user.email ?? '';
        const displayName = session.user.user_metadata?.display_name
          ?? email.split('@')[0];

        // Check if an existing user row matches by email (pre-Supabase account)
        const byEmail = await db.query(
          `SELECT ${profileCols} FROM users WHERE LOWER(username) = LOWER($1)`,
          [email]
        );

        if (byEmail.rows.length > 0) {
          // Link the existing user row to this Supabase account
          await db.query(
            `UPDATE users SET supabase_uid = $1 WHERE id = $2`,
            [session.user.id, byEmail.rows[0].id]
          );
          result = byEmail;
        } else {
          // Brand new user — create a row
          result = await db.query(
            `INSERT INTO users (username, display_name, supabase_uid, is_admin)
             VALUES ($1, $2, $3, false)
             ON CONFLICT (supabase_uid) DO UPDATE SET username = EXCLUDED.username
             RETURNING ${profileCols}`,
            [email, displayName, session.user.id]
          );
        }
      }

      // Set profile before any non-critical follow-up queries
      profile = result.rows[0] ?? null;

      // Add to default league membership (non-critical — table may not exist yet)
      if (profile) {
        try {
          await db.query(
            `INSERT INTO league_members (league_id, user_id)
             VALUES (1, $1) ON CONFLICT DO NOTHING`,
            [profile.id]
          );
        } catch { /* league_members table may not exist yet */ }
      }
    } catch (e) {
      console.error('DB profile error:', e);
    } finally {
      await db?.end();
    }
  }

  return { session, profile, supabase: supabasePublicConfig, availableYears };
}

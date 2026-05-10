import { serverSupabase, supabasePublicConfig } from '$lib/server/auth.js';
import { createClient } from '$lib/server/db.js';

export async function load({ cookies }) {
  console.log('>>> LAYOUT LOAD RUNNING <<<');
  let session = null;
  let profile = null;

  try {
    const supabase = serverSupabase(cookies);
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch (e) {
    console.error('Supabase session error:', e);
  }

  console.log('>>> LAYOUT session:', session ? `found (${session.user.email})` : 'null');

  let availableYears = [];
  if (session) {
    const uid = session.user.id;
    const email = session.user.email ?? '';
    console.log(`[LAYOUT] session found — uid: ${uid.slice(0, 8)}… email: ${email}`);

    let db;
    try {
      db = await createClient();

      // Ensure all required columns exist (safe no-ops if already present)
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_uid UUID UNIQUE`).catch(() => {});
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_commissioner BOOLEAN DEFAULT false`).catch(() => {});
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_color TEXT`).catch(() => {});
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_color TEXT`).catch(() => {});
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York'`).catch(() => {});
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark'`).catch(() => {});
      await db.query(`CREATE TABLE IF NOT EXISTS league_members (id SERIAL PRIMARY KEY, league_id INTEGER NOT NULL DEFAULT 1, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(league_id, user_id))`).catch(() => {});
      await db.query(`CREATE TABLE IF NOT EXISTS leagues (id SERIAL PRIMARY KEY, sport TEXT NOT NULL DEFAULT 'Football', platform TEXT NOT NULL, commissioner_name TEXT NOT NULL, league_name TEXT NOT NULL, url TEXT NOT NULL, sort_order INTEGER DEFAULT 0, expiration_date DATE, winner TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`).catch(() => {});

      const yearsRes = await db.query(
        `SELECT DISTINCT season_year FROM games ORDER BY season_year DESC`
      ).catch(() => ({ rows: [] }));
      availableYears = yearsRes.rows.map(r => r.season_year);

      const profileCols = `id, username, display_name, is_admin, is_commissioner,
                           primary_color, secondary_color, timezone, theme_preference`;

      let result = await db.query(
        `SELECT ${profileCols} FROM users WHERE supabase_uid = $1`,
        [uid]
      );
      console.log(`[LAYOUT] lookup by supabase_uid → ${result.rows.length} row(s)`);

      if (result.rows.length === 0) {
        const displayName = session.user.user_metadata?.display_name
          ?? email.split('@')[0];

        // Check if an existing user row matches by email (pre-Supabase account)
        const byEmail = await db.query(
          `SELECT ${profileCols} FROM users WHERE LOWER(username) = LOWER($1)`,
          [email]
        );
        console.log(`[LAYOUT] lookup by email → ${byEmail.rows.length} row(s)`);

        if (byEmail.rows.length > 0) {
          // Link the existing user row to this Supabase account
          await db.query(
            `UPDATE users SET supabase_uid = $1 WHERE id = $2`,
            [uid, byEmail.rows[0].id]
          );
          console.log(`[LAYOUT] linked existing user id=${byEmail.rows[0].id} to supabase_uid`);
          result = byEmail;
        } else {
          // Brand new user — create a row
          console.log(`[LAYOUT] no existing user found — inserting new row for ${email}`);
          result = await db.query(
            `INSERT INTO users (username, display_name, supabase_uid, is_admin)
             VALUES ($1, $2, $3, false)
             ON CONFLICT (supabase_uid) DO UPDATE SET username = EXCLUDED.username
             RETURNING ${profileCols}`,
            [email, displayName, uid]
          );
        }
      }

      // Set profile before any non-critical follow-up queries
      profile = result.rows[0] ?? null;

      if (profile) {
        console.log('[LAYOUT] profile loaded:', {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          is_admin: profile.is_admin,
          is_commissioner: profile.is_commissioner,
          primary_color: profile.primary_color,
          secondary_color: profile.secondary_color,
          timezone: profile.timezone,
          theme_preference: profile.theme_preference,
        });
      } else {
        console.warn('[LAYOUT] profile is null after all lookup attempts');
      }

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
      console.error('[LAYOUT] DB profile error:', e.message, e.stack);
    } finally {
      await db?.end();
    }
  }

  return { session, profile, supabase: supabasePublicConfig, availableYears };
}

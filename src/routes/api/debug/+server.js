import { json } from '@sveltejs/kit';
import { serverSupabase } from '$lib/server/auth.js';
import { createClient } from '$lib/server/db.js';

export async function GET({ cookies }) {
  const result = { session: null, dbConnected: false, userTableColumns: [], bySupabaseUid: null, byEmail: null, errors: [] };

  // 1. Check Supabase session
  try {
    const supabase = serverSupabase(cookies);
    const { data, error } = await supabase.auth.getSession();
    if (error) result.errors.push({ step: 'supabase_session', message: error.message });
    if (data?.session) {
      result.session = {
        uid: data.session.user.id,
        email: data.session.user.email,
        role: data.session.user.role,
      };
    }
  } catch (e) {
    result.errors.push({ step: 'supabase_session', message: e.message });
  }

  // 2. Check DB and schema
  let db;
  try {
    db = await createClient();
    result.dbConnected = true;

    // Get column list first so we know what's safe to query
    const cols = await db.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'users'
       ORDER BY ordinal_position`
    );
    result.userTableColumns = cols.rows.map(r => `${r.column_name} (${r.data_type})`);

    const availableCols = new Set(cols.rows.map(r => r.column_name));
    const wantedCols = ['id', 'username', 'display_name', 'is_admin', 'is_commissioner',
                        'primary_color', 'secondary_color', 'timezone', 'theme_preference', 'supabase_uid'];
    const safeCols = wantedCols.filter(c => availableCols.has(c)).join(', ');

    if (result.session && safeCols) {
      const byUid = await db.query(
        `SELECT ${safeCols} FROM users WHERE supabase_uid = $1`,
        [result.session.uid]
      ).catch(e => { result.errors.push({ step: 'byUid', message: e.message }); return { rows: [] }; });
      result.bySupabaseUid = byUid.rows[0] ?? null;

      const byEmail = await db.query(
        `SELECT ${safeCols} FROM users WHERE LOWER(username) = LOWER($1)`,
        [result.session.email]
      ).catch(e => { result.errors.push({ step: 'byEmail', message: e.message }); return { rows: [] }; });
      result.byEmail = byEmail.rows[0] ?? null;
    }
  } catch (e) {
    result.errors.push({ step: 'db', message: e.message });
  } finally {
    await db?.end();
  }

  return json(result, { headers: { 'Cache-Control': 'no-store' } });
}

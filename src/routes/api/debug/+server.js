import { json } from '@sveltejs/kit';
import { serverSupabase } from '$lib/server/auth.js';
import { createClient } from '$lib/server/db.js';

export async function GET({ cookies, url }) {
  const result = {
    session: null,
    dbConnected: false,
    userTableColumns: [],
    allUsers: [],
    bySupabaseUid: null,
    byEmail: null,
    linked: null,
    errors: []
  };

  // 1. Check Supabase session
  try {
    const supabase = serverSupabase(cookies);
    const { data, error } = await supabase.auth.getSession();
    if (error) result.errors.push({ step: 'supabase_session', message: error.message });
    if (data?.session) {
      result.session = { uid: data.session.user.id, email: data.session.user.email };
    }
  } catch (e) {
    result.errors.push({ step: 'supabase_session', message: e.message });
  }

  let db;
  try {
    db = await createClient();
    result.dbConnected = true;

    // Get column list
    const cols = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
    );
    result.userTableColumns = cols.rows.map(r => r.column_name);
    const availableCols = new Set(result.userTableColumns);

    // List all users
    const users = await db.query(`SELECT id, username, display_name, is_admin FROM users ORDER BY id`);
    result.allUsers = users.rows;

    // ?linkUserId=N — link current Supabase session to that user row
    const linkUserId = url.searchParams.get('linkUserId');
    if (linkUserId && result.session) {
      const uid = result.session.uid;
      const id = parseInt(linkUserId, 10);
      result.linkAttempt = { uid, id };

      const updateRes = await db.query(
        `UPDATE users SET supabase_uid = $1::uuid WHERE id = $2::int`,
        [uid, id]
      ).catch(e => { result.errors.push({ step: 'link_update', message: e.message }); return null; });

      result.rowsUpdated = updateRes?.rowCount ?? 0;

      // Verify by selecting the row back regardless
      const verifyRes = await db.query(
        `SELECT id, username, display_name, is_admin, supabase_uid FROM users WHERE id = $1::int`,
        [id]
      ).catch(e => { result.errors.push({ step: 'link_verify', message: e.message }); return { rows: [] }; });
      result.linked = verifyRes.rows[0] ?? null;
    }

    if (result.session && availableCols.has('supabase_uid')) {
      const byUid = await db.query(
        `SELECT id, username, display_name, is_admin, supabase_uid FROM users WHERE supabase_uid = $1`,
        [result.session.uid]
      ).catch(e => { result.errors.push({ step: 'byUid', message: e.message }); return { rows: [] }; });
      result.bySupabaseUid = byUid.rows[0] ?? null;

      const byEmail = await db.query(
        `SELECT id, username, display_name, is_admin FROM users WHERE LOWER(username) = LOWER($1)`,
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

import { json } from '@sveltejs/kit';
import { serverSupabase, adminSupabase } from '$lib/server/auth.js';
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

    // Check if RLS is enabled on users table
    const rlsRes = await db.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'users' AND relnamespace = 'public'::regnamespace`
    ).catch(() => ({ rows: [] }));
    result.rlsEnabled = rlsRes.rows[0]?.relrowsecurity ?? 'unknown';

    // ?linkUserId=N — link current Supabase session to that user row
    const linkUserId = url.searchParams.get('linkUserId');
    if (linkUserId && result.session) {
      const uid = result.session.uid;
      const id = parseInt(linkUserId, 10);
      result.linkAttempt = { uid, id };

      // Try via pg client first (reports rowCount so we know if RLS is blocking)
      const pgUpdate = await db.query(
        `UPDATE users SET supabase_uid = $1::uuid WHERE id = $2::int`,
        [uid, id]
      ).catch(e => { result.errors.push({ step: 'pg_update', message: e.message }); return null; });
      result.pgRowsUpdated = pgUpdate?.rowCount ?? 0;

      // Also try via service-role Supabase client (bypasses RLS)
      const admin = adminSupabase();
      const { data: adminData, error: adminError } = await admin
        .from('users')
        .update({ supabase_uid: uid })
        .eq('id', id)
        .select('id, username, display_name, is_admin, supabase_uid');
      if (adminError) result.errors.push({ step: 'admin_update', message: adminError.message });
      result.adminRowsUpdated = adminData?.length ?? 0;

      // Verify final state
      const verifyRes = await db.query(
        `SELECT id, username, display_name, is_admin, supabase_uid FROM users WHERE id = $1::int`,
        [id]
      ).catch(e => { result.errors.push({ step: 'verify', message: e.message }); return { rows: [] }; });
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

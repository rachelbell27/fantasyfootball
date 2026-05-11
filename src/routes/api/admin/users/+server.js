import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase, adminSupabase } from '$lib/server/auth.js';

async function getUser(cookies, db) {
  try {
    const supabase = serverSupabase(cookies);
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    const res = await db.query(
      'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
      [session.user.id]
    );
    return res.rows[0] ?? null;
  } catch { return null; }
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');
    if (!user.is_admin) throw error(403, 'Admin only');

    const { name, email } = await request.json();
    if (!name?.trim() || !email?.trim()) throw error(400, 'Name and email required');

    const admin = adminSupabase();
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { data: { display_name: name.trim() } }
    );

    if (inviteErr) {
      console.error('[POST /api/admin/users] invite error:', inviteErr.message);
      if (inviteErr.message?.includes('already been registered')) {
        throw error(409, 'An account with that email already exists.');
      }
      throw error(500, inviteErr.message);
    }

    return json({ ok: true, userId: inviteData.user?.id });
  } catch (e) {
    if (e.status) throw e;
    console.error('[POST /api/admin/users]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}

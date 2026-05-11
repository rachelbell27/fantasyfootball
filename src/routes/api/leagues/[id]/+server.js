import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getUser(cookies, db) {
  try {
    const supabase = serverSupabase(cookies);
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    const res = await db.query(
      'SELECT id, is_admin, is_commissioner FROM users WHERE supabase_uid = $1',
      [session.user.id]
    );
    return res.rows[0] ?? null;
  } catch { return null; }
}

export async function PUT({ params, request, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');
    if (!user.is_admin && !user.is_commissioner) throw error(403, 'Forbidden');

    const body = await request.json();
    const { sport, platform, commissioner_name, league_name, url, sort_order, expiration_date, winner } = body;

    const result = await db.query(
      `UPDATE leagues
       SET sport = $1, platform = $2, commissioner_name = $3, league_name = $4,
           url = $5, sort_order = $6, expiration_date = $7, winner = $8
       WHERE id = $9
       RETURNING id`,
      [sport, platform, commissioner_name, league_name, url,
       sort_order ?? 0, expiration_date || null, winner || null, params.id]
    );
    if (result.rows.length === 0) throw error(404, 'Not found');
    return json(result.rows[0]);
  } catch (e) {
    if (e.status) throw e;
    console.error('[PUT /api/leagues/:id]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}

export async function DELETE({ params, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');
    if (!user.is_admin && !user.is_commissioner) throw error(403, 'Forbidden');

    await db.query('DELETE FROM leagues WHERE id = $1', [params.id]);
    return json({ ok: true });
  } catch (e) {
    if (e.status) throw e;
    console.error('[DELETE /api/leagues/:id]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}

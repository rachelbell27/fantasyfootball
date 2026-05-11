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

export async function GET({ cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');
    const result = await db.query(
      `SELECT id, sport, platform, commissioner_name, league_name, url,
              sort_order, winner,
              to_char(expiration_date, 'YYYY-MM-DD') AS expiration_date
       FROM leagues ORDER BY sort_order ASC, id ASC`
    );
    return json(result.rows);
  } catch (e) {
    if (e.status) throw e; // re-throw SvelteKit HttpErrors (401, 403, etc.)
    console.error('[GET /api/leagues]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user) throw error(401, 'Unauthorized');
    if (!user.is_admin && !user.is_commissioner) throw error(403, 'Forbidden');

    const body = await request.json();
    const { sport, platform, commissioner_name, league_name, url, sort_order, expiration_date, winner } = body;

    const result = await db.query(
      `INSERT INTO leagues (sport, platform, commissioner_name, league_name, url, sort_order, expiration_date, winner)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [sport, platform, commissioner_name, league_name, url, sort_order || 0,
       expiration_date || null, winner || null]
    );
    return json(result.rows[0], { status: 201 });
  } catch (e) {
    if (e.status) throw e;
    console.error('[POST /api/leagues]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}

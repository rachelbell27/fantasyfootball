import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getAdminUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data } = await supabase.auth.getSession(); const session = data?.session;
  if (!session) return null;
  const res = await db.query(
    'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
    [session.user.id]
  );
  const user = res.rows[0];
  if (!user?.is_admin) return null;
  return user;
}

export async function GET({ url, cookies }) {
  const q = url.searchParams.get('q') ?? '';
  const dbsParam = url.searchParams.get('dbs') ?? '';

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    if (q.length < 2) return json([]);

    const dbIds = dbsParam
      ? dbsParam.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
      : [];

    const dbFilter = dbIds.length > 0 ? 'AND tp.database_id = ANY($2)' : '';
    const params = dbIds.length > 0 ? [`%${q}%`, dbIds] : [`%${q}%`];

    const res = await db.query(`
      SELECT
        tp.id, tp.full_name, tp.aliases, tp.database_id,
        tp.college, tp.draft_year, tp.headshot_url,
        tdb.name AS database_name,
        (
          SELECT COALESCE(JSON_AGG(t_row), '[]'::json)
          FROM (
            SELECT DISTINCT ON (tt2.id)
              tt2.id, tt2.display_name, tt2.abbreviation, tt2.logo_url, tt2.color
            FROM trivia_rosters tr2
            JOIN trivia_teams tt2 ON tt2.id = tr2.team_id
            WHERE tr2.player_id = tp.id
            ORDER BY tt2.id, tr2.season DESC
          ) t_row
        ) AS teams
      FROM trivia_players tp
      JOIN trivia_databases tdb ON tdb.id = tp.database_id
      WHERE tp.full_name ILIKE $1 ${dbFilter}
      ORDER BY tp.full_name ASC
      LIMIT 20
    `, params);

    return json(res.rows);
  } finally {
    await db.end();
  }
}

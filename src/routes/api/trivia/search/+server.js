import { json } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

export async function GET({ url, cookies }) {
  const supabase = serverSupabase(cookies);
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

  const gameId = url.searchParams.get('gameId');
  const q = url.searchParams.get('q') ?? '';
  if (!gameId || q.length < 2) return json([]);

  const db = await createClient();
  try {
    const userRes = await db.query('SELECT id FROM users WHERE supabase_uid = $1', [session.user.id]);
    if (!userRes.rows.length) return json({ error: 'Unauthorized' }, { status: 401 });

    const gameRes = await db.query(
      'SELECT database_ids FROM trivia_games WHERE id = $1 AND published = true',
      [gameId]
    );
    if (!gameRes.rows.length) return json([]);

    const { database_ids } = gameRes.rows[0];
    const prefix = `${q}%`;

    const res = await db.query(`
      SELECT
        tp.id,
        tp.full_name,
        tp.college,
        (SELECT position FROM trivia_rosters WHERE player_id = tp.id ORDER BY season DESC LIMIT 1) AS position,
        (
          SELECT JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('name', tt.display_name))
          FROM trivia_rosters tr
          JOIN trivia_teams tt ON tt.id = tr.team_id
          WHERE tr.player_id = tp.id
        ) AS teams
      FROM trivia_players tp
      WHERE tp.database_id = ANY($1::int[])
        AND (
          tp.full_name ILIKE $2
          OR EXISTS (SELECT 1 FROM unnest(tp.aliases) a WHERE a ILIKE $2)
        )
      ORDER BY
        CASE WHEN tp.full_name ILIKE $2 THEN 0 ELSE 1 END,
        tp.full_name ASC
      LIMIT 8
    `, [database_ids, prefix]);

    return json(res.rows.map(r => ({
      id: r.id,
      full_name: r.full_name,
      position: r.position ?? null,
      college: r.college ?? null,
      teams: r.teams ?? [],
    })));
  } finally {
    await db.end();
  }
}

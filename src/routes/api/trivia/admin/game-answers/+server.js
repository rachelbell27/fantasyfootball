import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';
import { VALID_STAT_KEYS } from '$lib/trivia-stats.js';

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
  const gameId = url.searchParams.get('gameId');
  if (!gameId) throw error(400, 'gameId required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    // Get game config to determine whether to include stat preview
    const gameRes = await db.query(
      `SELECT hint_type, hint_stat_field FROM trivia_games WHERE id = $1`,
      [gameId]
    );
    const { hint_type, hint_stat_field } = gameRes.rows[0] ?? {};
    const safeStatField = (hint_type === 'stat_line' && VALID_STAT_KEYS.includes(hint_stat_field))
      ? hint_stat_field : null;

    const statSubquery = safeStatField
      ? `(SELECT ps.${safeStatField}
          FROM trivia_player_stats ps
          JOIN trivia_rosters tr2 ON tr2.id = ps.roster_id
          WHERE tr2.player_id = tp.id
          ORDER BY tr2.season DESC LIMIT 1) AS stat_preview,`
      : `NULL::numeric AS stat_preview,`;

    const res = await db.query(`
      SELECT
        tga.id, tga.game_id, tga.player_id, tga.hint_data, tga.sort_order,
        tp.full_name, tp.aliases, tp.headshot_url,
        ${statSubquery}
        (
          SELECT COALESCE(JSON_AGG(t_row), '[]'::json)
          FROM (
            SELECT DISTINCT ON (tt3.id)
              tt3.id, tt3.display_name, tt3.abbreviation, tt3.logo_url, tt3.color
            FROM trivia_rosters rr
            JOIN trivia_teams tt3 ON tt3.id = rr.team_id
            WHERE rr.player_id = tp.id
            ORDER BY tt3.id, rr.season DESC
          ) t_row
        ) AS player_teams
      FROM trivia_game_answers tga
      JOIN trivia_players tp ON tp.id = tga.player_id
      WHERE tga.game_id = $1
      ORDER BY tga.sort_order ASC, tga.id ASC
    `, [gameId]);

    return json(res.rows);
  } finally {
    await db.end();
  }
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const { gameId, playerId, hintData = {}, sortOrder = 0 } = await request.json();
    if (!gameId || !playerId) throw error(400, 'gameId and playerId required');

    const res = await db.query(
      `INSERT INTO trivia_game_answers (game_id, player_id, hint_data, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (game_id, player_id) DO UPDATE
         SET hint_data = EXCLUDED.hint_data, sort_order = EXCLUDED.sort_order
       RETURNING id, game_id, player_id, hint_data, sort_order`,
      [gameId, playerId, hintData, sortOrder]
    );

    return json(res.rows[0], { status: 201 });
  } finally {
    await db.end();
  }
}

export async function PATCH({ url, request, cookies }) {
  const id = url.searchParams.get('id');
  if (!id) throw error(400, 'id required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const { hintData, sortOrder } = await request.json();

    const cols = [];
    const vals = [];
    if (hintData !== undefined) { cols.push(`hint_data = $${vals.length + 1}`); vals.push(hintData); }
    if (sortOrder !== undefined) { cols.push(`sort_order = $${vals.length + 1}`); vals.push(sortOrder); }
    if (cols.length === 0) throw error(400, 'Nothing to update');

    vals.push(id);
    const res = await db.query(
      `UPDATE trivia_game_answers SET ${cols.join(', ')} WHERE id = $${vals.length}
       RETURNING id, game_id, player_id, hint_data, sort_order`,
      vals
    );
    if (res.rows.length === 0) throw error(404, 'Answer not found');
    return json(res.rows[0]);
  } finally {
    await db.end();
  }
}

export async function DELETE({ url, cookies }) {
  const id = url.searchParams.get('id');
  if (!id) throw error(400, 'id required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    await db.query('DELETE FROM trivia_game_answers WHERE id = $1', [id]);
    return json({ success: true });
  } finally {
    await db.end();
  }
}

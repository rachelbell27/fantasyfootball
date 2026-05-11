import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

const BLOCKED_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE', 'EXECUTE', 'CALL'];

async function getAdminUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) return null;
  const res = await db.query('SELECT id, is_admin FROM users WHERE supabase_uid = $1', [session.user.id]);
  const user = res.rows[0];
  if (!user?.is_admin) return null;
  return user;
}

export async function GET({ cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const res = await db.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name LIKE 'trivia_%'
      ORDER BY table_name, ordinal_position
    `);

    const schema = {};
    for (const { table_name, column_name, data_type } of res.rows) {
      (schema[table_name] ??= []).push({ column: column_name, type: data_type });
    }
    return json(schema);
  } finally {
    await db.end();
  }
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const { gameId, sql } = await request.json();
    if (!gameId || !sql?.trim()) throw error(400, 'gameId and sql required');

    const trimmed = sql.trim().replace(/;+$/, '');
    if (trimmed.includes(';')) throw error(400, 'Multi-statement queries are not allowed');

    const upper = trimmed.toUpperCase();
    if (!upper.startsWith('SELECT')) throw error(400, 'Only SELECT statements are allowed');
    for (const kw of BLOCKED_KEYWORDS) {
      if (new RegExp(`\\b${kw}\\b`).test(upper)) {
        throw error(400, `Statement may not contain ${kw}`);
      }
    }

    const gameRes = await db.query('SELECT database_ids FROM trivia_games WHERE id = $1', [gameId]);
    if (!gameRes.rows.length) throw error(404, 'Game not found');
    const { database_ids } = gameRes.rows[0];

    // Run in read-only transaction for safety
    await db.query('BEGIN');
    await db.query('SET TRANSACTION READ ONLY');
    let queryRows;
    try {
      const res = await db.query(trimmed);
      queryRows = res.rows;
    } finally {
      await db.query('ROLLBACK');
    }

    if (!queryRows.length) return json({ added: [], skipped: 0, notFound: 0 });
    if (!('id' in queryRows[0])) throw error(400, 'Query must return an `id` column');

    const ids = [...new Set(queryRows.map(r => r.id).filter(v => v != null))];

    const playerRes = await db.query(
      `SELECT id, full_name FROM trivia_players WHERE id = ANY($1::int[]) AND database_id = ANY($2::int[])`,
      [ids, database_ids]
    );

    const existingRes = await db.query('SELECT player_id FROM trivia_game_answers WHERE game_id = $1', [gameId]);
    const existingIds = new Set(existingRes.rows.map(r => r.player_id));

    const toAdd = playerRes.rows.filter(p => !existingIds.has(p.id));
    const maxRes = await db.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM trivia_game_answers WHERE game_id = $1', [gameId]);
    let nextOrder = (maxRes.rows[0]?.m ?? -1) + 1;

    const added = [];
    for (const player of toAdd) {
      const ansRes = await db.query(
        `INSERT INTO trivia_game_answers (game_id, player_id, hint_data, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id, player_id, hint_data, sort_order`,
        [gameId, player.id, {}, nextOrder++]
      );
      added.push({
        ...ansRes.rows[0],
        full_name: player.full_name,
        player_teams: [],
        stat_preview: null,
        headshot_url: null,
      });
    }

    return json({
      added,
      skipped: playerRes.rows.length - toAdd.length,
      notFound: ids.length - playerRes.rows.length,
    });
  } finally {
    await db.end();
  }
}

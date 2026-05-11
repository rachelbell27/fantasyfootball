import { createClient } from '$lib/server/db.js';

export async function load() {
  const db = await createClient();
  try {
    const gamesRes = await db.query(`
      SELECT
        tg.id, tg.title, tg.prompt, tg.slug, tg.time_limit_seconds,
        tg.published, tg.database_ids, tg.hint_fields,
        tg.hint_type, tg.search_display_fields, tg.hint_stat_field,
        tg.created_at,
        COUNT(tga.id)::int AS answer_count,
        ARRAY_AGG(DISTINCT td.name) FILTER (WHERE td.name IS NOT NULL) AS databases
      FROM trivia_games tg
      LEFT JOIN trivia_game_answers tga ON tga.game_id = tg.id
      LEFT JOIN trivia_databases td ON td.id = ANY(tg.database_ids)
      GROUP BY tg.id
      ORDER BY tg.created_at DESC
    `);

    const dbsRes = await db.query(
      `SELECT id, name, slug FROM trivia_databases ORDER BY name ASC`
    );

    return {
      games: gamesRes.rows,
      databases: dbsRes.rows,
    };
  } finally {
    await db.end();
  }
}

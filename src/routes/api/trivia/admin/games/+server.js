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

export async function GET({ cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const res = await db.query(`
      SELECT
        tg.id, tg.title, tg.prompt, tg.slug, tg.time_limit_seconds,
        tg.published, tg.database_ids, tg.hint_fields,
        tg.hint_type, tg.search_display_fields, tg.hint_stat_field,
        tg.created_at, tg.updated_at,
        COUNT(tga.id)::int AS answer_count,
        ARRAY_AGG(DISTINCT td.name) FILTER (WHERE td.name IS NOT NULL) AS databases
      FROM trivia_games tg
      LEFT JOIN trivia_game_answers tga ON tga.game_id = tg.id
      LEFT JOIN trivia_databases td ON td.id = ANY(tg.database_ids)
      GROUP BY tg.id
      ORDER BY tg.created_at DESC
    `);

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

    const {
      title, prompt, slug,
      time_limit_seconds = 180, database_ids = [], hint_fields = [], published = false,
      hint_type = 'blank', search_display_fields = [], hint_stat_field = null,
    } = await request.json();
    if (!title || !prompt || !slug) throw error(400, 'title, prompt, and slug are required');

    const res = await db.query(
      `INSERT INTO trivia_games
         (title, prompt, slug, time_limit_seconds, database_ids, hint_fields, published,
          hint_type, search_display_fields, hint_stat_field, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
       RETURNING id, title, prompt, slug, time_limit_seconds, database_ids, hint_fields,
                 published, hint_type, search_display_fields, hint_stat_field`,
      [title, prompt, slug, time_limit_seconds, database_ids, hint_fields, published,
       hint_type, search_display_fields, hint_stat_field, admin.id]
    );

    return json(res.rows[0], { status: 201 });
  } finally {
    await db.end();
  }
}

export async function PUT({ url, request, cookies }) {
  const gameId = url.searchParams.get('id');
  if (!gameId) throw error(400, 'id required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const {
      title, prompt, slug, time_limit_seconds, database_ids, hint_fields, published,
      hint_type, search_display_fields, hint_stat_field,
    } = await request.json();

    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined)                { fields.push(`title = $${idx++}`);                values.push(title); }
    if (prompt !== undefined)               { fields.push(`prompt = $${idx++}`);               values.push(prompt); }
    if (slug !== undefined)                 { fields.push(`slug = $${idx++}`);                 values.push(slug); }
    if (time_limit_seconds !== undefined)   { fields.push(`time_limit_seconds = $${idx++}`);   values.push(time_limit_seconds); }
    if (database_ids !== undefined)         { fields.push(`database_ids = $${idx++}`);         values.push(database_ids); }
    if (hint_fields !== undefined)          { fields.push(`hint_fields = $${idx++}`);          values.push(hint_fields); }
    if (published !== undefined)            { fields.push(`published = $${idx++}`);            values.push(published); }
    if (hint_type !== undefined)            { fields.push(`hint_type = $${idx++}`);            values.push(hint_type); }
    if (search_display_fields !== undefined){ fields.push(`search_display_fields = $${idx++}`);values.push(search_display_fields); }
    if (hint_stat_field !== undefined)      { fields.push(`hint_stat_field = $${idx++}`);      values.push(hint_stat_field); }
    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) throw error(400, 'No fields to update');

    values.push(gameId);
    const res = await db.query(
      `UPDATE trivia_games SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (res.rows.length === 0) throw error(404, 'Game not found');
    return json(res.rows[0]);
  } finally {
    await db.end();
  }
}

export async function DELETE({ url, cookies }) {
  const gameId = url.searchParams.get('id');
  if (!gameId) throw error(400, 'id required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    await db.query('DELETE FROM trivia_games WHERE id = $1', [gameId]);
    return json({ success: true });
  } finally {
    await db.end();
  }
}

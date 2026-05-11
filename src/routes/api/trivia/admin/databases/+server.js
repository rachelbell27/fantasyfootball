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

    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_teams (
        id SERIAL PRIMARY KEY, database_id INTEGER REFERENCES trivia_databases(id) ON DELETE CASCADE,
        espn_id VARCHAR(20) NOT NULL, display_name VARCHAR(150) NOT NULL,
        abbreviation VARCHAR(10), location VARCHAR(100), slug VARCHAR(100),
        logo_url TEXT, color VARCHAR(7), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(database_id, espn_id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_rosters (
        id SERIAL PRIMARY KEY, team_id INTEGER REFERENCES trivia_teams(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES trivia_players(id) ON DELETE CASCADE,
        season INTEGER NOT NULL, position VARCHAR(10), jersey VARCHAR(5),
        stats JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(team_id, player_id, season)
      )
    `);
    await db.query(`ALTER TABLE trivia_rosters ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'`);

    const res = await db.query(`
      SELECT
        td.id, td.name, td.slug, td.api_league_id, td.description, td.created_at,
        COUNT(DISTINCT tp.id)::int  AS player_count,
        COUNT(DISTINCT tt.id)::int  AS team_count
      FROM trivia_databases td
      LEFT JOIN trivia_players tp ON tp.database_id = td.id
      LEFT JOIN trivia_teams   tt ON tt.database_id = td.id
      GROUP BY td.id
      ORDER BY td.name ASC
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

    const { name, slug, api_league_id = null, description = '' } = await request.json();
    if (!name || !slug) throw error(400, 'name and slug are required');

    const res = await db.query(
      `INSERT INTO trivia_databases (name, slug, api_league_id, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, api_league_id, description`,
      [name, slug, api_league_id, description]
    );

    return json(res.rows[0], { status: 201 });
  } finally {
    await db.end();
  }
}

export async function DELETE({ url, cookies }) {
  const dbId = url.searchParams.get('id');
  if (!dbId) throw error(400, 'id required');

  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    await db.query('DELETE FROM trivia_databases WHERE id = $1', [dbId]);
    return json({ success: true });
  } finally {
    await db.end();
  }
}

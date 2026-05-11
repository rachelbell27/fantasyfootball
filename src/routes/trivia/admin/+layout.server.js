import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

export async function load({ cookies, parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const supabase = serverSupabase(cookies);
  const { data: { session: sess } } = await supabase.auth.getSession();
  if (!sess) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const res = await db.query(
      'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
      [sess.user.id]
    );
    const user = res.rows[0];
    if (!user?.is_admin) throw redirect(303, '/trivia');

    // Self-heal trivia schema so the admin pages always have tables to work with
    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_databases (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        api_league_id INTEGER,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_players (
        id SERIAL PRIMARY KEY,
        database_id INTEGER REFERENCES trivia_databases(id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        aliases TEXT[],
        metadata JSONB,
        api_player_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(api_player_id, database_id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_games (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        prompt TEXT NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        time_limit_seconds INTEGER DEFAULT 180,
        published BOOLEAN DEFAULT FALSE,
        database_ids INTEGER[],
        hint_fields TEXT[],
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS trivia_game_answers (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES trivia_games(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES trivia_players(id) ON DELETE CASCADE,
        hint_data JSONB,
        sort_order INTEGER DEFAULT 0,
        UNIQUE(game_id, player_id)
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_answers_game ON trivia_game_answers(game_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_games_slug ON trivia_games(slug)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_trivia_games_published ON trivia_games(published)`);
    await db.query(`
      INSERT INTO trivia_databases (name, slug, api_league_id, description) VALUES
        ('NFL', 'nfl', 1, 'National Football League'),
        ('NCAA Football', 'ncaa-football', 2, 'NCAA Division I Football (FBS)')
      ON CONFLICT (slug) DO NOTHING
    `);

    return {};
  } finally {
    await db.end();
  }
}

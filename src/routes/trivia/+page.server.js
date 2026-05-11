import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

async function ensureTriviaSchema(db) {
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
}

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    await ensureTriviaSchema(db);

    const res = await db.query(`
      SELECT
        tg.id,
        tg.title,
        tg.prompt,
        tg.slug,
        tg.time_limit_seconds,
        COUNT(tga.id)::int AS answer_count,
        ARRAY_AGG(DISTINCT td.name) FILTER (WHERE td.name IS NOT NULL) AS databases
      FROM trivia_games tg
      LEFT JOIN trivia_game_answers tga ON tga.game_id = tg.id
      LEFT JOIN trivia_databases td ON td.id = ANY(tg.database_ids)
      WHERE tg.published = true
      GROUP BY tg.id
      ORDER BY tg.created_at DESC
    `);

    return { games: res.rows };
  } finally {
    await db.end();
  }
}

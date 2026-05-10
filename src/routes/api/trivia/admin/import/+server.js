import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';
import { env } from '$env/dynamic/private';

async function getAdminUser(cookies, db) {
  const supabase = serverSupabase(cookies);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const res = await db.query(
    'SELECT id, is_admin FROM users WHERE supabase_uid = $1',
    [session.user.id]
  );
  const user = res.rows[0];
  if (!user?.is_admin) return null;
  return user;
}

async function upsertPlayers(db, databaseId, players) {
  let inserted = 0;
  let updated = 0;

  for (const p of players) {
    const { full_name, aliases = [], metadata = {}, api_player_id = null } = p;
    if (!full_name) continue;

    if (api_player_id) {
      // Upsert by api_player_id + database_id
      const res = await db.query(
        `INSERT INTO trivia_players (database_id, full_name, aliases, metadata, api_player_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (api_player_id, database_id) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               aliases = EXCLUDED.aliases,
               metadata = EXCLUDED.metadata
         RETURNING (xmax = 0) AS is_insert`,
        [databaseId, full_name, aliases, metadata, api_player_id]
      );
      if (res.rows[0]?.is_insert) inserted++; else updated++;
    } else {
      // No api_player_id — plain insert
      await db.query(
        `INSERT INTO trivia_players (database_id, full_name, aliases, metadata)
         VALUES ($1, $2, $3, $4)`,
        [databaseId, full_name, aliases, metadata]
      );
      inserted++;
    }
  }

  return { inserted, updated };
}

async function importFromApi(db, databaseId, season) {
  // Look up league id for this database
  const dbRes = await db.query(
    'SELECT api_league_id FROM trivia_databases WHERE id = $1',
    [databaseId]
  );
  if (dbRes.rows.length === 0) throw error(404, 'Database not found');
  const leagueId = dbRes.rows[0].api_league_id;
  if (!leagueId) throw error(400, 'Database has no api_league_id configured');

  const apiUrl = `https://v1.american-football.api-sports.io/players/statistics?league=${leagueId}&season=${season}`;
  const resp = await fetch(apiUrl, {
    headers: {
      'x-rapidapi-host': 'v1.american-football.api-sports.io',
      'x-rapidapi-key': env.SPORTSIO_APIKEY ?? ''
    }
  });

  if (!resp.ok) throw error(502, `API Sports returned ${resp.status}`);
  const data = await resp.json();
  const results = data.response ?? [];

  const players = results.map(entry => {
    const player = entry.player ?? {};
    const teams = (entry.teams ?? []).map(t => t.team?.name).filter(Boolean);
    return {
      full_name: [player.firstname, player.lastname].filter(Boolean).join(' '),
      aliases: [],
      api_player_id: player.id ?? null,
      metadata: {
        position: player.position ?? null,
        teams,
        season
      }
    };
  }).filter(p => p.full_name);

  return upsertPlayers(db, databaseId, players);
}

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    const body = await request.json();
    const { databaseId, importType, season, players } = body;

    if (!databaseId) throw error(400, 'databaseId required');

    let result;
    if (importType === 'api') {
      if (!season) throw error(400, 'season required for api import');
      result = await importFromApi(db, databaseId, season);
    } else if (Array.isArray(players)) {
      result = await upsertPlayers(db, databaseId, players);
    } else {
      throw error(400, 'Either players array or importType=api + season required');
    }

    return json({ success: true, ...result });
  } finally {
    await db.end();
  }
}

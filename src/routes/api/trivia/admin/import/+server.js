import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

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

async function ensureSchema(db) {
  // Must create in dependency order: databases → players → teams → rosters
  await db.query(`
    CREATE TABLE IF NOT EXISTS trivia_databases (
      id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL,
      slug VARCHAR(50) UNIQUE NOT NULL, api_league_id INTEGER,
      description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS trivia_players (
      id SERIAL PRIMARY KEY,
      database_id INTEGER REFERENCES trivia_databases(id) ON DELETE CASCADE,
      full_name VARCHAR(150) NOT NULL, aliases TEXT[], metadata JSONB,
      api_player_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(api_player_id, database_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS trivia_teams (
      id           SERIAL PRIMARY KEY,
      database_id  INTEGER REFERENCES trivia_databases(id) ON DELETE CASCADE,
      espn_id      VARCHAR(20) NOT NULL,
      display_name VARCHAR(150) NOT NULL,
      abbreviation VARCHAR(10), location VARCHAR(100), slug VARCHAR(100),
      logo_url TEXT, color VARCHAR(7),
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(database_id, espn_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS trivia_rosters (
      id        SERIAL PRIMARY KEY,
      team_id   INTEGER REFERENCES trivia_teams(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES trivia_players(id) ON DELETE CASCADE,
      season    INTEGER NOT NULL, position VARCHAR(10), jersey VARCHAR(5),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, player_id, season)
    )
  `);
  // Seed default databases
  await db.query(`
    INSERT INTO trivia_databases (name, slug, description) VALUES
      ('NFL', 'nfl', 'National Football League'),
      ('College Football', 'college-football', 'NCAA Division I Football (FBS)')
    ON CONFLICT (slug) DO NOTHING
  `);
}

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football';

const LEAGUE_MAP = {
  'nfl':              'nfl',
  'college-football': 'college-football',
  'ncaa-football':    'college-football',
};

// ── Teams ──────────────────────────────────────────────────────────────────

async function upsertTeams(db, databaseId, espnLeague) {
  const resp = await fetch(`${SITE}/${espnLeague}/teams?limit=200`);
  if (!resp.ok) throw error(502, `ESPN /teams: ${resp.status}`);
  const data = await resp.json();
  const teams = (data.sports?.[0]?.leagues?.[0]?.teams ?? []).map(t => t.team).filter(t => t?.id);

  const teamLookup = {}; // espn_id (string) → { id: db_pk, displayName }

  for (const team of teams) {
    const res = await db.query(
      `INSERT INTO trivia_teams (database_id, espn_id, display_name, abbreviation, location, slug, logo_url, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (database_id, espn_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             abbreviation = EXCLUDED.abbreviation,
             location     = EXCLUDED.location,
             slug         = EXCLUDED.slug,
             logo_url     = EXCLUDED.logo_url,
             color        = EXCLUDED.color
       RETURNING id, espn_id, display_name`,
      [
        databaseId, String(team.id), team.displayName, team.abbreviation,
        team.location, team.slug,
        team.logos?.[0]?.href ?? null,
        team.color ? `#${team.color}` : null,
      ]
    );
    const row = res.rows[0];
    teamLookup[row.espn_id] = { id: row.id, displayName: row.display_name };
  }

  return teamLookup;
}


// ── CFB / others: site API team-by-team rosters (inline data) ──────────────

async function fetchRostersFromTeams(teamLookup, espnLeague) {
  const teamIds = Object.keys(teamLookup);
  const BATCH = 10;
  const players = [];

  for (let i = 0; i < teamIds.length; i += BATCH) {
    const batch = teamIds.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(espnTeamId =>
        fetch(`${SITE}/${espnLeague}/teams/${espnTeamId}/roster`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const data = results[j];
      const espnTeamId = batch[j];
      if (!data) continue;

      for (const group of data.athletes ?? []) {
        for (const player of group.items ?? []) {
          const fullName = player.fullName ?? [player.firstName, player.lastName].filter(Boolean).join(' ');
          if (!fullName) continue;
          players.push({
            espnId:     String(player.id),
            fullName,
            shortName:  player.shortName ?? null,
            position:   player.position?.abbreviation ?? null,
            jersey:     player.jersey ?? null,
            espnTeamId,
          });
        }
      }
    }
  }

  return players;
}

// ── DB upsert (players + rosters) ──────────────────────────────────────────

async function savePlayersAndRosters(db, databaseId, teamLookup, parsedPlayers, season) {
  let inserted = 0, updated = 0, rosterRows = 0;

  // Collect roster entries separately to batch-insert after player upserts
  const rosterPlan = []; // { teamDbId, espnId }

  for (const p of parsedPlayers) {
    const teamInfo = p.espnTeamId ? teamLookup[p.espnTeamId] : null;
    const aliases = (p.shortName && p.shortName !== p.fullName) ? [p.shortName] : [];
    const metadata = {
      position: p.position,
      teams:    teamInfo ? [teamInfo.displayName] : [],
      seasons:  [String(season)],
      jersey:   p.jersey,
    };

    const res = await db.query(
      `INSERT INTO trivia_players (database_id, full_name, aliases, metadata, api_player_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (api_player_id, database_id) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             aliases   = EXCLUDED.aliases,
             metadata  = jsonb_strip_nulls(
               trivia_players.metadata || jsonb_build_object(
                 'position', EXCLUDED.metadata->>'position',
                 'jersey',   EXCLUDED.metadata->>'jersey'
               ) || jsonb_build_object(
                 'teams',    (
                   SELECT jsonb_agg(DISTINCT v)
                   FROM jsonb_array_elements(
                     COALESCE(trivia_players.metadata->'teams', '[]'::jsonb) ||
                     EXCLUDED.metadata->'teams'
                   ) v
                 ),
                 'seasons',  (
                   SELECT jsonb_agg(DISTINCT v ORDER BY v)
                   FROM jsonb_array_elements(
                     COALESCE(trivia_players.metadata->'seasons', '[]'::jsonb) ||
                     EXCLUDED.metadata->'seasons'
                   ) v
                 )
               )
             )
       RETURNING id, (xmax = 0) AS is_insert`,
      [databaseId, p.fullName, aliases, metadata, Number(p.espnId)]
    );

    const row = res.rows[0];
    if (row.is_insert) inserted++; else updated++;

    if (teamInfo) {
      rosterPlan.push({ teamDbId: teamInfo.id, playerDbId: row.id });
    }
  }

  // Bulk insert roster entries
  if (rosterPlan.length > 0) {
    const teamIds   = rosterPlan.map(r => r.teamDbId);
    const playerIds = rosterPlan.map(r => r.playerDbId);
    const positions = parsedPlayers.filter(p => p.espnTeamId && teamLookup[p.espnTeamId]).map(p => p.position);
    const jerseys   = parsedPlayers.filter(p => p.espnTeamId && teamLookup[p.espnTeamId]).map(p => p.jersey);

    // Use unnest for bulk insert
    await db.query(
      `INSERT INTO trivia_rosters (team_id, player_id, season, position, jersey)
       SELECT unnest($1::int[]), unnest($2::int[]), $3, unnest($4::text[]), unnest($5::text[])
       ON CONFLICT (team_id, player_id, season) DO UPDATE
         SET position = EXCLUDED.position,
             jersey   = EXCLUDED.jersey`,
      [teamIds, playerIds, season, positions, jerseys]
    );
    rosterRows = rosterPlan.length;
  }

  return { inserted, updated, rosterRows };
}

// ── CSV import (unchanged) ──────────────────────────────────────────────────

async function upsertFromCsv(db, databaseId, players) {
  let inserted = 0, updated = 0;
  for (const { full_name, aliases = [], metadata = {}, api_player_id = null } of players) {
    if (!full_name) continue;
    if (api_player_id) {
      const res = await db.query(
        `INSERT INTO trivia_players (database_id, full_name, aliases, metadata, api_player_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (api_player_id, database_id) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               aliases   = EXCLUDED.aliases,
               metadata  = EXCLUDED.metadata
         RETURNING (xmax = 0) AS is_insert`,
        [databaseId, full_name, aliases, metadata, api_player_id]
      );
      if (res.rows[0]?.is_insert) inserted++; else updated++;
    } else {
      await db.query(
        'INSERT INTO trivia_players (database_id, full_name, aliases, metadata) VALUES ($1,$2,$3,$4)',
        [databaseId, full_name, aliases, metadata]
      );
      inserted++;
    }
  }
  return { inserted, updated };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST({ request, cookies }) {
  const db = await createClient();
  try {
    const admin = await getAdminUser(cookies, db);
    if (!admin) throw error(403, 'Forbidden');

    await ensureSchema(db).catch(e => { throw error(500, `Schema setup failed: ${e.message}`); });

    const body = await request.json();
    const { databaseId, importType, season, players } = body;
    if (!databaseId) throw error(400, 'databaseId required');

    if (importType === 'espn') {
      if (!season) throw error(400, 'season is required for ESPN import');

      const dbRes = await db.query('SELECT slug FROM trivia_databases WHERE id = $1', [databaseId]);
      const slug = dbRes.rows[0]?.slug;
      const espnLeague = LEAGUE_MAP[slug];
      if (!espnLeague) throw error(400, `No ESPN mapping for database slug "${slug}"`);

      // 1. Import teams first (needed for roster linkage)
      const teamLookup = await upsertTeams(db, databaseId, espnLeague);

      // 2. Fetch athletes via site API team rosters (inline data, no per-player fetches)
      const parsedPlayers = await fetchRostersFromTeams(teamLookup, espnLeague);

      // 3. Upsert players + roster entries
      const result = await savePlayersAndRosters(db, databaseId, teamLookup, parsedPlayers, season);

      return json({
        success: true,
        teams:   Object.keys(teamLookup).length,
        ...result,
      });

    } else if (Array.isArray(players)) {
      const result = await upsertFromCsv(db, databaseId, players);
      return json({ success: true, ...result });

    } else {
      throw error(400, 'importType=espn with season, or players array required');
    }
  } catch (e) {
    // Re-throw SvelteKit errors (they already carry status codes)
    if (e?.status) throw e;
    // Return plain errors as JSON so the UI sees a message instead of an HTML 500 page
    return json({ message: e?.message ?? 'Unknown error' }, { status: 500 });
  } finally {
    await db.end();
  }
}

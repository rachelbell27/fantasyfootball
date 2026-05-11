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
      stats     JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, player_id, season)
    )
  `);
  await db.query(`ALTER TABLE trivia_rosters ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'`);
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
  const url = `${SITE}/${espnLeague}/teams?limit=200`;
  console.log('[import] fetching teams:', url);
  const resp = await fetch(url);
  if (!resp.ok) throw error(502, `ESPN /teams: ${resp.status}`);
  const data = await resp.json();
  const teams = (data.sports?.[0]?.leagues?.[0]?.teams ?? []).map(t => t.team).filter(t => t?.id);
  console.log('[import] teams found:', teams.length);

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
  console.log('[import] fetching rosters for', teamIds.length, 'teams in batches of', BATCH);

  for (let i = 0; i < teamIds.length; i += BATCH) {
    const batch = teamIds.slice(i, i + BATCH);
    console.log(`[import] roster batch ${Math.floor(i / BATCH) + 1}: teams`, batch.join(','));
    const results = await Promise.all(
      batch.map(espnTeamId =>
        fetch(`${SITE}/${espnLeague}/teams/${espnTeamId}/roster`)
          .then(r => {
            if (!r.ok) { console.warn(`[import] roster fetch failed for team ${espnTeamId}: ${r.status}`); return null; }
            return r.json();
          })
          .catch(e => { console.warn(`[import] roster fetch error for team ${espnTeamId}:`, e.message); return null; })
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const data = results[j];
      const espnTeamId = batch[j];
      if (!data) continue;

      let teamPlayerCount = 0;
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
          teamPlayerCount++;
        }
      }
      console.log(`[import]   team ${espnTeamId}: ${teamPlayerCount} players`);
    }
  }

  console.log('[import] total players parsed:', players.length);
  return players;
}

// ── DB upsert (players + rosters) ──────────────────────────────────────────

async function savePlayersAndRosters(db, databaseId, teamLookup, parsedPlayers, season) {
  console.log('[import] saving', parsedPlayers.length, 'players for season', season);
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

  console.log('[import] players upserted — inserted:', inserted, 'updated:', updated, 'roster plan:', rosterPlan.length);

  // Bulk insert roster entries
  if (rosterPlan.length > 0) {
    const teamIds   = rosterPlan.map(r => r.teamDbId);
    const playerIds = rosterPlan.map(r => r.playerDbId);
    const positions = parsedPlayers.filter(p => p.espnTeamId && teamLookup[p.espnTeamId]).map(p => p.position);
    const jerseys   = parsedPlayers.filter(p => p.espnTeamId && teamLookup[p.espnTeamId]).map(p => p.jersey);

    // Use unnest for bulk insert
    await db.query(
      `INSERT INTO trivia_rosters (team_id, player_id, season, position, jersey, stats)
       SELECT unnest($1::int[]), unnest($2::int[]), $3, unnest($4::text[]), unnest($5::text[]), '{}'::jsonb
       ON CONFLICT (team_id, player_id, season) DO UPDATE
         SET position = EXCLUDED.position,
             jersey   = EXCLUDED.jersey`,
      [teamIds, playerIds, season, positions, jerseys]
    );
    rosterRows = rosterPlan.length;
  }

  return { inserted, updated, rosterRows };
}

// ── Team lookup from DB (for chunked imports after teams are already saved) ─

async function getTeamLookupFromDb(db, databaseId) {
  const res = await db.query(
    'SELECT id, espn_id, display_name FROM trivia_teams WHERE database_id = $1 ORDER BY espn_id',
    [databaseId]
  );
  const lookup = {};
  for (const row of res.rows) {
    lookup[row.espn_id] = { id: row.id, displayName: row.display_name };
  }
  return lookup;
}

// ── Stats import ───────────────────────────────────────────────────────────

const CORE = 'https://sports.core.api.espn.com/v2/sports/football';

async function fetchPlayerStats(espnLeague, espnId, season) {
  const url = `${CORE}/leagues/${espnLeague}/seasons/${season}/athletes/${espnId}/statistics`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const stats = {};
    for (const cat of data.splits?.categories ?? []) {
      const flat = {};
      for (const s of cat.stats ?? []) {
        if (s.value != null && s.value !== 0) flat[s.name] = s.value;
      }
      if (Object.keys(flat).length > 0) stats[cat.name] = flat;
    }
    return Object.keys(stats).length > 0 ? stats : null;
  } catch {
    return null;
  }
}

async function importStats(db, databaseId, espnLeague, season, offset, limit) {
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM trivia_rosters r
     JOIN trivia_players p ON p.id = r.player_id
     WHERE r.season = $1 AND p.database_id = $2 AND p.api_player_id IS NOT NULL`,
    [season, databaseId]
  );
  const total = countRes.rows[0].total;

  const playersRes = await db.query(
    `SELECT r.id AS roster_id, p.api_player_id AS espn_id
     FROM trivia_rosters r
     JOIN trivia_players p ON p.id = r.player_id
     WHERE r.season = $1 AND p.database_id = $2 AND p.api_player_id IS NOT NULL
     ORDER BY r.id
     LIMIT $3 OFFSET $4`,
    [season, databaseId, limit, offset]
  );

  const rows = playersRes.rows;
  let updated = 0;
  console.log(`[stats] offset=${offset} limit=${limit} fetching ${rows.length} of ${total}`);

  const BATCH = 20;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(r => fetchPlayerStats(espnLeague, r.espn_id, season))
    );
    for (let j = 0; j < batch.length; j++) {
      const stats = results[j];
      if (!stats) continue;
      await db.query(
        `UPDATE trivia_rosters SET stats = $1 WHERE id = $2`,
        [JSON.stringify(stats), batch[j].roster_id]
      );
      updated++;
    }
  }

  const nextOffset = offset + rows.length;
  console.log(`[stats] updated ${updated}, nextOffset=${nextOffset}, total=${total}`);
  return { updated, total, hasMore: nextOffset < total, nextOffset };
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
    const { databaseId, importType, season, players, offset = 0, limit = 8 } = body;
    if (!databaseId) throw error(400, 'databaseId required');

    if (importType === 'espn-stats') {
      if (!season) throw error(400, 'season is required for stats import');
      const dbRes = await db.query('SELECT slug FROM trivia_databases WHERE id = $1', [databaseId]);
      const slug = dbRes.rows[0]?.slug;
      const espnLeague = LEAGUE_MAP[slug];
      if (!espnLeague) throw error(400, `No ESPN mapping for database slug "${slug}"`);

      const result = await importStats(db, databaseId, espnLeague, season, offset, limit);
      return json({ success: true, ...result });

    } else if (importType === 'espn') {
      if (!season) throw error(400, 'season is required for ESPN import');

      const dbRes = await db.query('SELECT slug FROM trivia_databases WHERE id = $1', [databaseId]);
      const slug = dbRes.rows[0]?.slug;
      const espnLeague = LEAGUE_MAP[slug];
      if (!espnLeague) throw error(400, `No ESPN mapping for database slug "${slug}"`);

      // On first batch, fetch + save all teams from ESPN (idempotent upsert)
      // On subsequent batches, read the already-saved teams from the DB
      const fullLookup = offset === 0
        ? await upsertTeams(db, databaseId, espnLeague)
        : await getTeamLookupFromDb(db, databaseId);

      const allTeamIds = Object.keys(fullLookup);
      const total = allTeamIds.length;
      const batchIds = allTeamIds.slice(offset, offset + limit);
      console.log(`[import] espn batch: offset=${offset} limit=${limit} teams=${batchIds.length}/${total}`);

      if (batchIds.length === 0) {
        return json({ success: true, teams: total, inserted: 0, updated: 0, rosterRows: 0, hasMore: false, nextOffset: offset, total });
      }

      const subsetLookup = {};
      for (const id of batchIds) subsetLookup[id] = fullLookup[id];

      const parsedPlayers = await fetchRostersFromTeams(subsetLookup, espnLeague);
      const result = await savePlayersAndRosters(db, databaseId, subsetLookup, parsedPlayers, season);

      const nextOffset = offset + batchIds.length;
      return json({
        success: true,
        teams:  total,
        ...result,
        hasMore:    nextOffset < total,
        nextOffset,
        total,
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
    console.error('[import] unhandled error:', e?.message, e?.stack);
    // Return plain errors as JSON so the UI sees a message instead of an HTML 500 page
    return json({ message: e?.message ?? 'Unknown error' }, { status: 500 });
  } finally {
    await db.end();
  }
}

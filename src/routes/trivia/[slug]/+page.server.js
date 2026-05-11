import { redirect, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { VALID_STAT_KEYS, statLabel } from '$lib/trivia-stats.js';

export async function load({ parent, params }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const { slug } = params;
  const db = await createClient();
  try {
    const gameRes = await db.query(
      `SELECT id, title, prompt, slug, time_limit_seconds,
              hint_type, hint_stat_field, search_display_fields
       FROM trivia_games
       WHERE slug = $1 AND published = true`,
      [slug]
    );
    if (gameRes.rows.length === 0) throw error(404, 'Game not found');
    const game = gameRes.rows[0];
    const hintType = game.hint_type ?? 'blank';

    // Base slot query — always join player for name/headshot
    const slotsRes = await db.query(
      `SELECT tga.id, tga.hint_data, tga.sort_order,
              tp.id AS player_id, tp.full_name, tp.headshot_url
       FROM trivia_game_answers tga
       JOIN trivia_players tp ON tp.id = tga.player_id
       WHERE tga.game_id = $1
       ORDER BY tga.sort_order ASC, tga.id ASC`,
      [game.id]
    );
    const rawSlots = slotsRes.rows;

    // Resolve hint_data based on hint_type
    let slots;

    if (hintType === 'player_name' || hintType === 'player_headshot') {
      slots = rawSlots.map(r => ({
        id: r.id, sort_order: r.sort_order,
        hintData: { ...r.hint_data, player_name: r.full_name, headshot_url: r.headshot_url },
      }));

    } else if (hintType === 'team_logo' || hintType === 'team_name') {
      // Collect explicitly-set team IDs
      const teamIds = rawSlots.map(r => r.hint_data?.display_team_id).filter(Boolean);
      let teamMap = {};
      if (teamIds.length > 0) {
        const teamRes = await db.query(
          `SELECT id, display_name, abbreviation, logo_url, logo_dark_url, color
           FROM trivia_teams WHERE id = ANY($1)`,
          [teamIds]
        );
        teamMap = Object.fromEntries(teamRes.rows.map(t => [t.id, t]));
      }

      // For slots with no explicit team (e.g. added via SQL fill), fall back to most recent roster team
      const needsFallback = rawSlots.filter(r => !r.hint_data?.display_team_id && !r.hint_data?.display_all_teams);
      let fallbackTeamMap = {};
      if (needsFallback.length > 0) {
        const fbRes = await db.query(
          `SELECT DISTINCT ON (tr.player_id)
                  tr.player_id, tt.id, tt.display_name, tt.abbreviation,
                  tt.logo_url, tt.logo_dark_url, tt.color
           FROM trivia_rosters tr
           JOIN trivia_teams tt ON tt.id = tr.team_id
           WHERE tr.player_id = ANY($1)
           ORDER BY tr.player_id, tr.season DESC`,
          [needsFallback.map(r => r.player_id)]
        );
        fallbackTeamMap = Object.fromEntries(fbRes.rows.map(r => [r.player_id, r]));
      }

      // For display_all_teams slots, fetch all rosters in one query
      const allTeamsPlayerIds = rawSlots
        .filter(r => r.hint_data?.display_all_teams)
        .map(r => r.player_id);
      let playerTeamsMap = {};
      if (allTeamsPlayerIds.length > 0) {
        const rRes = await db.query(
          `SELECT DISTINCT tr.player_id,
                  tt.id, tt.display_name, tt.abbreviation, tt.logo_url, tt.color
           FROM trivia_rosters tr
           JOIN trivia_teams tt ON tt.id = tr.team_id
           WHERE tr.player_id = ANY($1)`,
          [allTeamsPlayerIds]
        );
        for (const row of rRes.rows) {
          if (!playerTeamsMap[row.player_id]) playerTeamsMap[row.player_id] = [];
          playerTeamsMap[row.player_id].push({
            id: row.id, display_name: row.display_name, abbreviation: row.abbreviation,
            logo_url: row.logo_url, color: row.color,
          });
        }
      }

      slots = rawSlots.map(r => {
        const hd = r.hint_data ?? {};
        let resolved = { ...hd };
        if (hd.display_all_teams) {
          resolved.teams = playerTeamsMap[r.player_id] ?? [];
        } else if (hd.display_team_id && teamMap[hd.display_team_id]) {
          const t = teamMap[hd.display_team_id];
          resolved = { ...resolved, team_name: t.display_name, logo_url: t.logo_url, logo_dark_url: t.logo_dark_url, team_color: t.color };
        } else {
          // Fallback: most recent rostered team (covers SQL-fill and any unset hint_data)
          const t = fallbackTeamMap[r.player_id];
          if (t) resolved = { ...resolved, team_name: t.display_name, logo_url: t.logo_url, logo_dark_url: t.logo_dark_url, team_color: t.color };
        }
        return { id: r.id, sort_order: r.sort_order, hintData: resolved };
      });

    } else if (hintType === 'stat_line' && VALID_STAT_KEYS.includes(game.hint_stat_field)) {
      const field = game.hint_stat_field;
      const playerIds = rawSlots.map(r => r.player_id);
      // Get most recent stat per player
      const statsRes = await db.query(
        `SELECT DISTINCT ON (tr.player_id) tr.player_id, ps.${field} AS stat_value
         FROM trivia_player_stats ps
         JOIN trivia_rosters tr ON tr.id = ps.roster_id
         WHERE tr.player_id = ANY($1) AND ps.${field} IS NOT NULL
         ORDER BY tr.player_id, tr.season DESC`,
        [playerIds]
      );
      const statsMap = Object.fromEntries(statsRes.rows.map(r => [r.player_id, r.stat_value]));

      slots = rawSlots.map(r => ({
        id: r.id, sort_order: r.sort_order,
        hintData: {
          ...r.hint_data,
          stat_label: statLabel(field),
          stat_value: statsMap[r.player_id] ?? null,
        },
      }));

    } else {
      slots = rawSlots.map(r => ({ id: r.id, sort_order: r.sort_order, hintData: r.hint_data ?? {} }));
    }

    return {
      game: {
        id: game.id,
        title: game.title,
        prompt: game.prompt,
        slug: game.slug,
        time_limit_seconds: game.time_limit_seconds,
        hint_type: hintType,
        search_display_fields: game.search_display_fields ?? [],
        total: slots.length,
      },
      slots,
    };
  } finally {
    await db.end();
  }
}

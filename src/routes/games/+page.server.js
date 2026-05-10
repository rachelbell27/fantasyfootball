import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent, url }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const requestedYear = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')) : null;

  const db = await createClient();
  try {
    const now = new Date();

    const weekRes = requestedYear
      ? await db.query(
          `SELECT week_number, season_year, week_type,
                  CASE week_type
                    WHEN 'regular'    THEN 0 WHEN 'wildcard'   THEN 1
                    WHEN 'divisional' THEN 2 WHEN 'conference' THEN 3
                    WHEN 'superbowl'  THEN 4 ELSE 5
                  END as type_order
           FROM games WHERE season_year = $1
           ORDER BY type_order DESC, week_number DESC LIMIT 1`,
          [requestedYear]
        )
      : await db.query(
          `SELECT week_number, season_year, week_type,
                  CASE week_type
                    WHEN 'regular'    THEN 0 WHEN 'wildcard'   THEN 1
                    WHEN 'divisional' THEN 2 WHEN 'conference' THEN 3
                    WHEN 'superbowl'  THEN 4 ELSE 5
                  END as type_order
           FROM games WHERE game_time <= $1
           ORDER BY season_year DESC, type_order DESC, week_number DESC LIMIT 1`,
          [now]
        );
    const currentWeek = weekRes.rows[0] ?? {
      week_number: 1,
      season_year: now.getFullYear(),
      week_type: 'regular'
    };

    const gamesRes = await db.query(
      `SELECT id, season_year, week_number, week_type,
              home_team, home_team_abbr, home_team_logo, home_score,
              away_team, away_team_abbr, away_team_logo, away_score,
              game_time, game_status, winner
       FROM games
       WHERE season_year = $1 AND week_number = $2 AND week_type = $3
       ORDER BY game_time`,
      [currentWeek.season_year, currentWeek.week_number, currentWeek.week_type]
    );

    // Available weeks for the week switcher
    const weeksRes = await db.query(
      `SELECT season_year, week_number, week_type, COUNT(*) as game_count,
              CASE week_type
                WHEN 'regular'    THEN 0 WHEN 'wildcard'   THEN 1
                WHEN 'divisional' THEN 2 WHEN 'conference' THEN 3
                WHEN 'superbowl'  THEN 4 ELSE 5
              END as type_order
       FROM games
       GROUP BY season_year, week_number, week_type
       ORDER BY season_year DESC, type_order DESC, week_number DESC`
    );

    return {
      week: {
        number: currentWeek.week_number,
        year: currentWeek.season_year,
        type: currentWeek.week_type
      },
      games: gamesRes.rows,
      availableWeeks: weeksRes.rows
    };
  } finally {
    await db.end();
  }
}

import { redirect, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent, params }) {
  const { session, profile } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const year = parseInt(params.year);
  if (!year || year < 2000 || year > 2100) throw error(400, 'Invalid year');

  const db = await createClient();
  try {
    const res = await db.query(
      `SELECT
         g.week_number, g.week_type, g.game_time, g.game_status,
         g.away_team, g.away_team_abbr, g.away_team_logo, g.away_score,
         g.home_team, g.home_team_abbr, g.home_team_logo, g.home_score,
         g.winner,
         p.predicted_winner, p.is_correct
       FROM picks p
       JOIN games g ON p.game_id = g.id
       WHERE p.user_id = $1 AND g.season_year = $2
       ORDER BY
         CASE g.week_type
           WHEN 'regular'    THEN 0 WHEN 'wildcard'   THEN 1
           WHEN 'divisional' THEN 2 WHEN 'conference' THEN 3
           WHEN 'superbowl'  THEN 4 ELSE 5
         END,
         g.week_number,
         g.game_time`,
      [profile.id, year]
    );

    const byWeek = {};
    for (const row of res.rows) {
      const key = `${row.week_type}-${row.week_number}`;
      if (!byWeek[key]) {
        byWeek[key] = { week_number: row.week_number, week_type: row.week_type, games: [] };
      }
      byWeek[key].games.push(row);
    }

    return { year, weeks: Object.values(byWeek) };
  } finally {
    await db.end();
  }
}

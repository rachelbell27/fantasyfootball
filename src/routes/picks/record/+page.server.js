import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session, profile } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const res = await db.query(
      `SELECT
         g.season_year,
         g.week_number,
         g.week_type,
         COUNT(*)::int                                            AS total,
         COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int  AS wins,
         COUNT(CASE WHEN p.is_correct = false THEN 1 END)::int  AS losses,
         COUNT(CASE WHEN p.is_correct IS NULL THEN 1 END)::int  AS pending
       FROM picks p
       JOIN games g ON p.game_id = g.id
       WHERE p.user_id = $1
       GROUP BY g.season_year, g.week_number, g.week_type
       ORDER BY
         g.season_year DESC,
         CASE g.week_type
           WHEN 'regular'     THEN 0 WHEN 'wildcard'   THEN 1
           WHEN 'divisional'  THEN 2 WHEN 'conference' THEN 3
           WHEN 'superbowl'   THEN 4 ELSE 5
         END DESC,
         g.week_number DESC`,
      [profile.id]
    );

    const byYear = {};
    for (const row of res.rows) {
      if (!byYear[row.season_year]) {
        byYear[row.season_year] = { year: row.season_year, wins: 0, losses: 0, pending: 0, weeks: [] };
      }
      byYear[row.season_year].wins    += row.wins;
      byYear[row.season_year].losses  += row.losses;
      byYear[row.season_year].pending += row.pending;
      byYear[row.season_year].weeks.push(row);
    }

    return { record: Object.values(byYear).sort((a, b) => b.year - a.year) };
  } finally {
    await db.end();
  }
}

import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

const WEEK_ORDER = `CASE week_type
  WHEN 'regular'     THEN 0 WHEN 'wildcard'    THEN 1
  WHEN 'divisional'  THEN 2 WHEN 'conference'  THEN 3
  WHEN 'superbowl'   THEN 4 ELSE 5 END`;

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const now = new Date();

    const weekRes = await db.query(
      `SELECT week_number, season_year, week_type FROM games
       WHERE game_time <= $1
       ORDER BY season_year DESC, ${WEEK_ORDER} DESC, week_number DESC LIMIT 1`,
      [now]
    );
    const cw = weekRes.rows[0] ?? { week_number: 1, season_year: now.getFullYear(), week_type: 'regular' };
    const { season_year: yr, week_number: wn, week_type: wt } = cw;

    // Season + this-week stats in one pass
    const boardRes = await db.query(
      `SELECT
         u.id   AS user_id,
         u.display_name,
         u.primary_color,
         -- Season
         COUNT(CASE WHEN p.is_correct = true  THEN 1 END)::int AS season_wins,
         COUNT(CASE WHEN p.is_correct = false THEN 1 END)::int AS season_losses,
         COUNT(CASE WHEN p.is_correct IS NULL AND p.id IS NOT NULL THEN 1 END)::int AS season_pending,
         -- This week
         COUNT(CASE WHEN g.week_number=$2 AND g.week_type=$3 AND p.is_correct = true  THEN 1 END)::int AS week_wins,
         COUNT(CASE WHEN g.week_number=$2 AND g.week_type=$3 AND p.is_correct = false THEN 1 END)::int AS week_losses,
         COUNT(CASE WHEN g.week_number=$2 AND g.week_type=$3 AND p.is_correct IS NULL AND p.id IS NOT NULL THEN 1 END)::int AS week_pending,
         COUNT(CASE WHEN g.week_number=$2 AND g.week_type=$3 THEN 1 END)::int AS week_picks,
         -- Ranks
         RANK() OVER (ORDER BY COUNT(CASE WHEN p.is_correct = true THEN 1 END) DESC)::int AS season_rank,
         RANK() OVER (ORDER BY COUNT(CASE WHEN g.week_number=$2 AND g.week_type=$3 AND p.is_correct = true THEN 1 END) DESC)::int AS week_rank
       FROM league_members lm
       JOIN users u ON lm.user_id = u.id
       LEFT JOIN picks p  ON u.id = p.user_id AND p.league_id = lm.league_id
       LEFT JOIN games g  ON p.game_id = g.id AND g.season_year = $1
       WHERE lm.league_id = 1
       GROUP BY u.id, u.display_name, u.primary_color
       ORDER BY season_wins DESC, u.display_name`,
      [yr, wn, wt]
    );

    // Best single week per player this season
    const bestWeekRes = await db.query(
      `SELECT wk.user_id, MAX(wk.w)::int AS best_week
       FROM (
         SELECT p.user_id,
                COUNT(CASE WHEN p.is_correct = true THEN 1 END) AS w
         FROM picks p
         JOIN games g ON p.game_id = g.id AND g.season_year = $1
         JOIN league_members lm ON p.user_id = lm.user_id AND p.league_id = lm.league_id
         WHERE lm.league_id = 1
         GROUP BY p.user_id, g.week_number, g.week_type
       ) wk
       GROUP BY wk.user_id`,
      [yr]
    );
    const bestWeekMap = Object.fromEntries(bestWeekRes.rows.map(r => [r.user_id, r.best_week]));

    // This week's game counts
    const gamesRes = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(CASE WHEN game_status IN ('final','status_final') THEN 1 END)::int AS final_count,
         COUNT(CASE WHEN game_status IN ('in_progress','status_in_progress') THEN 1 END)::int AS live_count,
         COUNT(CASE WHEN game_status NOT IN ('final','status_final','in_progress','status_in_progress') THEN 1 END)::int AS upcoming_count
       FROM games WHERE season_year=$1 AND week_number=$2 AND week_type=$3`,
      [yr, wn, wt]
    );

    const leaderboard = boardRes.rows.map(r => {
      const done = r.season_wins + r.season_losses;
      return {
        ...r,
        best_week: bestWeekMap[r.user_id] ?? 0,
        season_win_pct: done > 0 ? Math.round((r.season_wins / done) * 100) : null,
      };
    });

    return {
      week: { number: wn, year: yr, type: wt },
      leaderboard,
      games: gamesRes.rows[0] ?? { total: 0, final_count: 0, live_count: 0, upcoming_count: 0 },
    };
  } finally {
    await db.end();
  }
}

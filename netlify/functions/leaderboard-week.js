const { createClient } = require('./db');

/**
 * GET /api/leaderboard/week?week={n}&leagueId={id}
 * Get leaderboard for a specific week
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const week = parseInt(params.week);
    const leagueId = parseInt(params.leagueId);
    const year = parseInt(params.year) || new Date().getFullYear();

    if (!week || !leagueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Week and leagueId required' })
      };
    }

    const db = await createClient();

    const result = await db.query(
      `SELECT
        u.id as user_id,
        u.username,
        u.display_name,
        u.primary_color,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as wins,
        COUNT(CASE WHEN p.is_correct = false THEN 1 END) as losses,
        COUNT(CASE WHEN p.is_correct IS NULL AND g.game_status = 'final' THEN 1 END) as ties,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as points,
        RANK() OVER (ORDER BY COUNT(CASE WHEN p.is_correct = true THEN 1 END) DESC) as rank
      FROM league_members lm
      JOIN users u ON lm.user_id = u.id
      LEFT JOIN picks p ON u.id = p.user_id AND p.league_id = lm.league_id
      LEFT JOIN games g ON p.game_id = g.id AND g.season_year = $1 AND g.week_number = $2
      WHERE lm.league_id = $3
      GROUP BY u.id, u.username, u.display_name, u.primary_color
      ORDER BY points DESC, u.display_name ASC`,
      [year, week, leagueId]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: result.rows.map(row => ({
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name,
          primaryColor: row.primary_color,
          wins: parseInt(row.wins),
          losses: parseInt(row.losses),
          ties: parseInt(row.ties),
          points: parseInt(row.points),
          rank: parseInt(row.rank)
        })),
        message: 'Weekly leaderboard retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting weekly leaderboard:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

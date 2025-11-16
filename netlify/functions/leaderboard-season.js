const { createClient } = require('./db');

/**
 * GET /api/leaderboard/season?leagueId={id}
 * Get season leaderboard
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
    const leagueId = parseInt(params.leagueId);
    const year = parseInt(params.year) || new Date().getFullYear();

    if (!leagueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'LeagueId required' })
      };
    }

    const db = await createClient();

    const result = await db.query(
      `SELECT
        u.id as user_id,
        u.username,
        u.display_name,
        u.primary_color,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as total_wins,
        COUNT(CASE WHEN p.is_correct = false THEN 1 END) as total_losses,
        COUNT(CASE WHEN p.is_correct IS NULL AND g.game_status = 'final' THEN 1 END) as total_ties,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as total_points,
        RANK() OVER (ORDER BY COUNT(CASE WHEN p.is_correct = true THEN 1 END) DESC) as rank
      FROM league_members lm
      JOIN users u ON lm.user_id = u.id
      LEFT JOIN picks p ON u.id = p.user_id AND p.league_id = lm.league_id
      LEFT JOIN games g ON p.game_id = g.id AND g.season_year = $1
      WHERE lm.league_id = $2
      GROUP BY u.id, u.username, u.display_name, u.primary_color
      ORDER BY total_points DESC, u.display_name ASC`,
      [year, leagueId]
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
          totalWins: parseInt(row.total_wins),
          totalLosses: parseInt(row.total_losses),
          totalTies: parseInt(row.total_ties),
          totalPoints: parseInt(row.total_points),
          rank: parseInt(row.rank)
        })),
        message: 'Season leaderboard retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting season leaderboard:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

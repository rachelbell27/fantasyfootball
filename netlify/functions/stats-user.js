const { createClient } = require('./db');

/**
 * GET /api/stats/user/{userId}?leagueId={id}
 * Get user statistics
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const pathParts = event.path.split('/');
    const userId = parseInt(pathParts[pathParts.length - 1]);

    const params = event.queryStringParameters || {};
    const leagueId = parseInt(params.leagueId);
    const year = parseInt(params.year) || new Date().getFullYear();

    if (!userId || !leagueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId and leagueId required' })
      };
    }

    const db = await createClient();

    // Get overall stats
    const overallResult = await db.query(
      `SELECT
        COUNT(p.id) as total_picks,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as correct_picks,
        COUNT(CASE WHEN p.is_correct = false THEN 1 END) as incorrect_picks,
        ROUND(
          CASE
            WHEN COUNT(p.id) > 0
            THEN (COUNT(CASE WHEN p.is_correct = true THEN 1 END)::numeric / COUNT(p.id)::numeric * 100)
            ELSE 0
          END,
          1
        ) as win_percentage
      FROM picks p
      JOIN games g ON p.game_id = g.id
      WHERE p.user_id = $1 AND p.league_id = $2 AND g.season_year = $3`,
      [userId, leagueId, year]
    );

    // Get weekly stats
    const weeklyResult = await db.query(
      `SELECT
        g.season_year,
        g.week_number,
        COUNT(p.id) as total_picks,
        COUNT(CASE WHEN p.is_correct = true THEN 1 END) as correct_picks,
        COUNT(CASE WHEN p.is_correct = false THEN 1 END) as incorrect_picks
      FROM picks p
      JOIN games g ON p.game_id = g.id
      WHERE p.user_id = $1 AND p.league_id = $2 AND g.season_year = $3
      GROUP BY g.season_year, g.week_number
      ORDER BY g.season_year DESC, g.week_number DESC`,
      [userId, leagueId, year]
    );

    const stats = overallResult.rows[0];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          stats: {
            total_picks: parseInt(stats.total_picks) || 0,
            correct_picks: parseInt(stats.correct_picks) || 0,
            incorrect_picks: parseInt(stats.incorrect_picks) || 0,
            win_percentage: parseFloat(stats.win_percentage) || 0
          },
          weekly: weeklyResult.rows.map(week => ({
            season_year: week.season_year,
            week_number: week.week_number,
            total_picks: parseInt(week.total_picks),
            correct_picks: parseInt(week.correct_picks),
            incorrect_picks: parseInt(week.incorrect_picks)
          }))
        },
        message: 'User stats retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

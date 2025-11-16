const { createClient } = require('./db');

/**
 * GET /api/games/weeks
 * Get all available weeks with games
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const db = await createClient();

    const result = await db.query(
      `SELECT DISTINCT season_year, week_number, week_type,
              MIN(game_time) as first_game_time,
              MAX(game_time) as last_game_time,
              COUNT(*) as game_count
       FROM games
       GROUP BY season_year, week_number, week_type
       ORDER BY season_year DESC, week_number DESC`
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: result.rows.map(week => ({
          year: week.season_year,
          weekNumber: week.week_number,
          weekType: week.week_type,
          firstGameTime: week.first_game_time,
          lastGameTime: week.last_game_time,
          gameCount: parseInt(week.game_count)
        })),
        message: 'Weeks retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting weeks:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

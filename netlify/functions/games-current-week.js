const { createClient } = require('./db');

/**
 * GET /api/games/current-week
 * Get the current NFL week based on today's date
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

    // Get the current week based on game times
    const now = new Date();
    const result = await db.query(
      `SELECT DISTINCT week_number, season_year, week_type
       FROM games
       WHERE game_time <= $1
       ORDER BY season_year DESC, week_number DESC
       LIMIT 1`,
      [now]
    );

    let weekNumber, year, weekType;

    if (result.rows.length > 0) {
      // Use the most recent week with games
      weekNumber = result.rows[0].week_number;
      year = result.rows[0].season_year;
      weekType = result.rows[0].week_type;
    } else {
      // No games found, use the earliest upcoming week
      const upcomingResult = await db.query(
        `SELECT DISTINCT week_number, season_year, week_type
         FROM games
         WHERE game_time > $1
         ORDER BY season_year ASC, week_number ASC
         LIMIT 1`,
        [now]
      );

      if (upcomingResult.rows.length > 0) {
        weekNumber = upcomingResult.rows[0].week_number;
        year = upcomingResult.rows[0].season_year;
        weekType = upcomingResult.rows[0].week_type;
      } else {
        // Default to week 1 of current year
        weekNumber = 1;
        year = now.getFullYear();
        weekType = 'regular';
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          weekNumber,
          year,
          weekType
        },
        message: 'Current week retrieved'
      })
    };

  } catch (error) {
    console.error('Error getting current week:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

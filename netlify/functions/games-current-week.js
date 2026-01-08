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

    // Get the current week based on game times and type ordering
    const now = new Date();
    const result = await db.query(
      `SELECT DISTINCT week_number, season_year, week_type,
              CASE
                WHEN week_type = 'regular' THEN 0
                WHEN week_type = 'wildcard' THEN 1
                WHEN week_type = 'divisional' THEN 2
                WHEN week_type = 'conference' THEN 3
                WHEN week_type = 'superbowl' THEN 4
                ELSE 5
              END as type_order
       FROM games
       WHERE game_time <= $1
       ORDER BY season_year DESC, type_order DESC, week_number DESC
       LIMIT 1`,
      [now]
    );

    let weekNumber, year, weekType;

    if (result.rows.length > 0) {
      // Get the most recent week with games
      weekNumber = result.rows[0].week_number;
      year = result.rows[0].season_year;
      weekType = result.rows[0].week_type;

      // Check if all games in this week are finished
      const weekGamesResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN game_status IN ('final', 'status_final') THEN 1 END) as finished
         FROM games
         WHERE week_number = $1 AND season_year = $2 AND week_type = $3`,
        [weekNumber, year, weekType]
      );

      const { total, finished } = weekGamesResult.rows[0];

      // If all games are finished, advance to next week
      if (total > 0 && parseInt(total) === parseInt(finished)) {
        const nextWeekResult = await db.query(
          `SELECT DISTINCT week_number, season_year, week_type,
                  CASE
                    WHEN week_type = 'regular' THEN 0
                    WHEN week_type = 'wildcard' THEN 1
                    WHEN week_type = 'divisional' THEN 2
                    WHEN week_type = 'conference' THEN 3
                    WHEN week_type = 'superbowl' THEN 4
                    ELSE 5
                  END as type_order
           FROM games
           WHERE season_year = $1
           AND (
             (week_type = $2 AND week_number > $3) OR
             (CASE
               WHEN week_type = 'regular' THEN 0
               WHEN week_type = 'wildcard' THEN 1
               WHEN week_type = 'divisional' THEN 2
               WHEN week_type = 'conference' THEN 3
               WHEN week_type = 'superbowl' THEN 4
               ELSE 5
             END) > (CASE
               WHEN $2 = 'regular' THEN 0
               WHEN $2 = 'wildcard' THEN 1
               WHEN $2 = 'divisional' THEN 2
               WHEN $2 = 'conference' THEN 3
               WHEN $2 = 'superbowl' THEN 4
               ELSE 5
             END)
           )
           ORDER BY type_order ASC, week_number ASC
           LIMIT 1`,
          [year, weekType, weekNumber]
        );

        if (nextWeekResult.rows.length > 0) {
          weekNumber = nextWeekResult.rows[0].week_number;
          year = nextWeekResult.rows[0].season_year;
          weekType = nextWeekResult.rows[0].week_type;
        }
      }
    } else {
      // No games found, use the earliest upcoming week
      const upcomingResult = await db.query(
        `SELECT DISTINCT week_number, season_year, week_type,
                CASE
                  WHEN week_type = 'regular' THEN 0
                  WHEN week_type = 'wildcard' THEN 1
                  WHEN week_type = 'divisional' THEN 2
                  WHEN week_type = 'conference' THEN 3
                  WHEN week_type = 'superbowl' THEN 4
                  ELSE 5
                END as type_order
         FROM games
         WHERE game_time > $1
         ORDER BY season_year ASC, type_order ASC, week_number ASC
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

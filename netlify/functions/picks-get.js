const { createClient } = require('./db');

/**
 * GET /api/picks?week={n}&year={y}&leagueId={id}
 * Get user's picks for a specific week
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get user ID from auth token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const token = authHeader.substring(7);
    let userId;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      userId = parseInt(decoded.split(':')[0]);
    } catch (e) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    const params = event.queryStringParameters || {};
    const week = parseInt(params.week);
    const year = parseInt(params.year) || new Date().getFullYear();
    const leagueId = parseInt(params.leagueId);

    if (!week || !leagueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Week and leagueId required' })
      };
    }

    const db = await createClient();

    const result = await db.query(
      `SELECT p.id, p.user_id, p.game_id, p.league_id,
              p.predicted_winner, p.is_correct, p.picked_at
       FROM picks p
       JOIN games g ON p.game_id = g.id
       WHERE p.user_id = $1
         AND p.league_id = $2
         AND g.season_year = $3
         AND g.week_number = $4
       ORDER BY g.game_time`,
      [userId, leagueId, year, week]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: result.rows.map(pick => ({
          id: pick.id,
          userId: pick.user_id,
          gameId: pick.game_id,
          leagueId: pick.league_id,
          predictedWinner: pick.predicted_winner,
          isCorrect: pick.is_correct,
          pickedAt: pick.picked_at
        })),
        message: 'Picks retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting picks:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

const { createClient } = require('./db');
const { getUserIdFromToken, unauthorizedResponse } = require('./auth-helper');

/**
 * GET /api/picks/all?week={n}&year={y}&leagueId={id}
 * Get all picks for a specific week/league (for comparison views)
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
    const userId = getUserIdFromToken(event);
    if (!userId) {
      return unauthorizedResponse();
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

    // Verify user is a member of the league
    const memberCheck = await db.query(
      'SELECT 1 FROM league_members WHERE user_id = $1 AND league_id = $2',
      [userId, leagueId]
    );

    if (memberCheck.rows.length === 0) {
      await db.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You are not a member of this league' })
      };
    }

    // Get all picks for this week/league from all users
    const result = await db.query(
      `SELECT p.id, p.user_id, p.game_id, p.league_id,
              p.predicted_winner, p.is_correct, p.picked_at,
              u.username, u.display_name, u.primary_color
       FROM picks p
       JOIN games g ON p.game_id = g.id
       JOIN users u ON p.user_id = u.id
       WHERE p.league_id = $1
         AND g.season_year = $2
         AND g.week_number = $3
       ORDER BY g.game_time, u.display_name`,
      [leagueId, year, week]
    );

    await db.end();

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
          pickedAt: pick.picked_at,
          username: pick.username,
          displayName: pick.display_name,
          primaryColor: pick.primary_color
        })),
        message: 'All picks retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting all picks:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

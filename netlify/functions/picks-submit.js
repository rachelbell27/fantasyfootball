const { createClient } = require('./db');

/**
 * POST /api/picks
 * Submit or update user picks
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
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

    const { picks } = JSON.parse(event.body);

    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Picks array required' })
      };
    }

    const db = await createClient();

    // Process each pick
    const results = [];
    for (const pick of picks) {
      const { gameId, predictedWinner, leagueId } = pick;

      if (!gameId || !predictedWinner || !leagueId) {
        continue;
      }

      // Check if game has started
      const gameResult = await db.query(
        'SELECT game_time, game_status FROM games WHERE id = $1',
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        continue;
      }

      const game = gameResult.rows[0];
      if (game.game_status !== 'scheduled') {
        continue; // Skip if game already started
      }

      // Upsert pick
      const upsertResult = await db.query(
        `INSERT INTO picks (user_id, game_id, league_id, predicted_winner, picked_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, game_id, league_id)
         DO UPDATE SET predicted_winner = $4, picked_at = NOW()
         RETURNING id`,
        [userId, gameId, leagueId, predictedWinner]
      );

      results.push(upsertResult.rows[0].id);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          submitted: results.length,
          pickIds: results
        },
        message: `${results.length} pick(s) submitted successfully`
      })
    };

  } catch (error) {
    console.error('Error submitting picks:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

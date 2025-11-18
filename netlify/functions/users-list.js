const { createClient } = require('./db');

/**
 * GET /api/users?leagueId={id}
 * Get all users (optionally filtered by league)
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
    const leagueId = params.leagueId ? parseInt(params.leagueId) : null;

    const db = await createClient();

    let result;
    if (leagueId) {
      // Get users in a specific league
      result = await db.query(
        `SELECT u.id, u.username, u.display_name, u.timezone,
                u.primary_color, u.secondary_color, u.is_admin, u.created_at
         FROM users u
         JOIN league_members lm ON u.id = lm.user_id
         WHERE lm.league_id = $1
         ORDER BY u.display_name ASC`,
        [leagueId]
      );
    } else {
      // Get all users
      result = await db.query(
        `SELECT id, username, display_name, timezone,
                primary_color, secondary_color, is_admin, created_at
         FROM users
         ORDER BY display_name ASC`
      );
    }

    await db.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: result.rows.map(user => ({
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          timezone: user.timezone,
          primaryColor: user.primary_color,
          secondaryColor: user.secondary_color,
          isAdmin: user.is_admin,
          createdAt: user.created_at
        })),
        message: 'Users retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error listing users:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

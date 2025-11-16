const { createClient } = require('./db');

/**
 * GET /api/users
 * Get all users (for admin or leaderboard)
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
      `SELECT id, username, display_name, timezone,
              primary_color, secondary_color, is_admin, created_at
       FROM users
       ORDER BY display_name ASC`
    );

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

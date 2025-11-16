const { createClient } = require('./db');

/**
 * GET /api/users/profile
 * Get current user's profile
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

    const db = await createClient();

    const result = await db.query(
      `SELECT id, username, display_name, timezone,
              primary_color, secondary_color, is_admin,
              must_change_password, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const user = result.rows[0];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          timezone: user.timezone,
          primaryColor: user.primary_color,
          secondaryColor: user.secondary_color,
          isAdmin: user.is_admin,
          mustChangePassword: user.must_change_password,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        message: 'Profile retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting profile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

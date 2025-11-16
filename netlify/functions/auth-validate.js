const { createClient } = require('@netlify/neon');

/**
 * GET /api/auth/validate
 * Validate auth token and return user data
 */
exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get token from Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'No token provided' })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Decode token (simplified - in production use JWT)
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

    // Connect to database
    const db = createClient(process.env.DATABASE_URL);

    // Get user data
    const result = await db.query(
      `SELECT id, username, display_name, timezone,
              primary_color, secondary_color, is_admin, must_change_password,
              created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    const user = result.rows[0];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          user: {
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
          }
        },
        message: 'Token valid'
      })
    };

  } catch (error) {
    console.error('Validate error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

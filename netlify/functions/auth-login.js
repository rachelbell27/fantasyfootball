const { createClient } = require('./db');
const bcrypt = require('bcrypt');

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    if (!username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Username and password required' })
      };
    }

    // Connect to database
    const db = await createClient();

    // Find user
    const result = await db.query(
      `SELECT id, username, display_name, password_hash, timezone,
              primary_color, secondary_color, is_admin, must_change_password
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid username or password' })
      };
    }

    const user = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid username or password' })
      };
    }

    // Create simple session token (in production, use JWT)
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    // Store session in environment or database (simplified for now)
    // In production, you'd want to store this in a session table

    // Return user data and token
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
      },
      body: JSON.stringify({
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            timezone: user.timezone,
            primaryColor: user.primary_color,
            secondaryColor: user.secondary_color,
            isAdmin: user.is_admin,
            mustChangePassword: user.must_change_password
          }
        },
        message: 'Login successful'
      })
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

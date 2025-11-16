const { createClient } = require('./db');

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'PUT') {
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

    const { displayName, primaryColor, secondaryColor, timezone } = JSON.parse(event.body);

    const db = await createClient();

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName);
    }
    if (primaryColor !== undefined) {
      updates.push(`primary_color = $${paramCount++}`);
      values.push(primaryColor);
    }
    if (secondaryColor !== undefined) {
      updates.push(`secondary_color = $${paramCount++}`);
      values.push(secondaryColor);
    }
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramCount++}`);
      values.push(timezone);
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No fields to update' })
      };
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, display_name, timezone,
                primary_color, secondary_color, is_admin
    `;

    const result = await db.query(query, values);

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
          isAdmin: user.is_admin
        },
        message: 'Profile updated successfully'
      })
    };

  } catch (error) {
    console.error('Error updating profile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

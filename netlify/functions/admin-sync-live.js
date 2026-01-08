const { createClient } = require('./db');
const { getUserIdFromToken, unauthorizedResponse } = require('./auth-helper');

/**
 * Manual trigger for live game sync (separate from scheduled function)
 * POST /api/admin/sync/live
 */
exports.handler = async (event, context) => {
  console.log('=== Manual Live Sync Started ===');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get user ID from auth token
    const userId = getUserIdFromToken(event);
    console.log('User ID:', userId);

    if (!userId) {
      return unauthorizedResponse();
    }

    // Check if user is admin
    const db = await createClient();
    const adminCheck = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [userId]
    );

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      await db.end();
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Admin access required' })
      };
    }

    await db.end();
    console.log('Admin verified, starting live sync...');

    // Just call the existing sync endpoint
    const syncResponse = await fetch(`${process.env.URL}/api/admin/games/sync`, {
      method: 'POST',
      headers: {
        'Authorization': event.headers.authorization,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const syncData = await syncResponse.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Live game sync completed successfully',
        triggeredBy: 'manual',
        data: syncData
      })
    };

  } catch (error) {
    console.error('Error in manual live sync:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Sync failed',
        message: error.message,
        stack: error.stack
      })
    };
  }
};

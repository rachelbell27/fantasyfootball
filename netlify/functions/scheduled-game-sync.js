const { createClient } = require('./db');
const { schedule } = require('@netlify/functions');

/**
 * Scheduled function to sync live game updates
 * Runs every 5 minutes during game days (Thursday-Monday)
 * Updates scores and game status for in-progress and upcoming games
 */
const syncLiveGames = async () => {
  console.log('Starting scheduled game sync...');

  try {
    const db = await createClient();
    const now = new Date();
    const currentYear = now.getFullYear();

    // Find all weeks with games that are either:
    // 1. In progress
    // 2. Scheduled within the next 6 hours
    // 3. Recently finished (within last hour) to catch final updates
    const activeWeeksResult = await db.query(`
      SELECT DISTINCT season_year, week_number, week_type
      FROM games
      WHERE game_status IN ('scheduled', 'in_progress', 'status_scheduled', 'status_in_progress')
        AND game_time BETWEEN NOW() - INTERVAL '1 hour' AND NOW() + INTERVAL '6 hours'
      ORDER BY season_year DESC, week_number DESC
    `);

    if (activeWeeksResult.rows.length === 0) {
      console.log('No active games found');
      await db.end();
      return;
    }

    let totalGamesUpdated = 0;

    // Sync each active week
    for (const weekInfo of activeWeeksResult.rows) {
      const { season_year, week_number, week_type } = weekInfo;

      // Determine season type for ESPN API
      const seasonType = week_type === 'regular' ? 2 : 3;

      // Map week types to ESPN playoff week numbers
      let espnWeekNumber = week_number;
      if (week_type !== 'regular') {
        const playoffWeekMap = {
          'wildcard': 1,
          'divisional': 2,
          'conference': 3,
          'superbowl': 4
        };
        espnWeekNumber = playoffWeekMap[week_type] || week_number;
      }

      console.log(`Syncing ${week_type} week ${week_number} (ESPN week ${espnWeekNumber}, seasonType ${seasonType})`);

      // Fetch games from ESPN API
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season_year}&seasontype=${seasonType}&week=${espnWeekNumber}`;
      const response = await fetch(espnUrl);

      if (!response.ok) {
        console.error(`Failed to fetch games for week ${week_number}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const events = data.events || [];

      for (const event of events) {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        const homeScore = parseInt(homeTeam.score) || 0;
        const awayScore = parseInt(awayTeam.score) || 0;
        const gameStatus = competition.status.type.name.toLowerCase();

        let winner = null;
        if (gameStatus === 'final' || gameStatus === 'status_final') {
          if (homeScore > awayScore) {
            winner = 'home';
          } else if (awayScore > homeScore) {
            winner = 'away';
          } else {
            winner = 'tie';
          }
        }

        // Update existing game (don't create new ones in scheduled sync)
        const updateResult = await db.query(
          `UPDATE games SET
            home_score = $1,
            away_score = $2,
            game_status = $3,
            winner = $4,
            last_synced_at = NOW(),
            updated_at = NOW()
          WHERE espn_game_id = $5
            AND sync_override = FALSE
          RETURNING id`,
          [homeScore, awayScore, gameStatus, winner, event.id]
        );

        if (updateResult.rows.length > 0) {
          totalGamesUpdated++;
          console.log(`Updated game ${event.id}: ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation} - ${gameStatus}`);
        }
      }
    }

    // Update pick results for completed games
    if (totalGamesUpdated > 0) {
      await db.query(`
        UPDATE picks p
        SET is_correct =
          CASE
            WHEN g.winner = p.predicted_winner THEN true
            WHEN g.winner IS NOT NULL AND g.winner != p.predicted_winner THEN false
            ELSE NULL
          END
        FROM games g
        WHERE p.game_id = g.id
          AND g.game_status IN ('final', 'status_final')
          AND g.winner IS NOT NULL
          AND p.is_correct IS NULL
      `);
      console.log('Updated pick results for completed games');
    }

    await db.end();
    console.log(`Scheduled sync completed: ${totalGamesUpdated} games updated`);

  } catch (error) {
    console.error('Error in scheduled game sync:', error);
    throw error;
  }
};

// Export handler that works both as scheduled and on-demand
const handler = async (event, context) => {
  // Allow admin users to trigger manually via POST
  if (event.httpMethod === 'POST') {
    const { getUserIdFromToken } = require('./auth-helper');
    const userId = getUserIdFromToken(event);

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Check if user is admin
    const { createClient } = require('./db');
    const db = await createClient();
    const adminCheck = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [userId]
    );
    await db.end();

    if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Admin access required' })
      };
    }

    // Run the sync
    try {
      await syncLiveGames();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Live game sync completed successfully',
          triggeredBy: 'manual'
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Sync failed',
          message: error.message
        })
      };
    }
  }

  // For scheduled runs, just execute the sync
  try {
    await syncLiveGames();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Scheduled live sync completed',
        triggeredBy: 'scheduled'
      })
    };
  } catch (error) {
    console.error('Scheduled live sync error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Scheduled live sync failed',
        message: error.message
      })
    };
  }
};

// Schedule to run every 5 minutes during game days
// Runs Thursday through Monday (when NFL games typically occur)
exports.handler = schedule('*/5 * * * *', handler);

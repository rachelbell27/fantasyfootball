const { createClient } = require('./db');
const { getUserIdFromToken, unauthorizedResponse } = require('./auth-helper');

/**
 * POST /api/admin/games/sync
 * Sync games from ESPN API
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
    const userId = getUserIdFromToken(event);
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
        body: JSON.stringify({ error: 'Forbidden: Admin access required' })
      };
    }

    // Parse request body
    const { week, year } = JSON.parse(event.body || '{}');
    const currentYear = year || new Date().getFullYear();

    // Default to current NFL week (approximate based on date)
    let defaultWeek = 1;
    const now = new Date();
    const seasonStart = new Date(currentYear, 8, 1); // September 1st
    if (now >= seasonStart) {
      const daysSinceStart = Math.floor((now - seasonStart) / (1000 * 60 * 60 * 24));
      defaultWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, 18);
    }

    const weekNumber = week || defaultWeek;

    // Fetch games from ESPN API
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${currentYear}&seasontype=2&week=${weekNumber}`;
    const response = await fetch(espnUrl);

    if (!response.ok) {
      await db.end();
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch games from ESPN' })
      };
    }

    const data = await response.json();
    const events = data.events || [];

    let gamesAdded = 0;
    let gamesUpdated = 0;

    for (const event of events) {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

      const gameData = {
        espnGameId: event.id,
        seasonYear: currentYear,
        weekNumber: weekNumber,
        weekType: 'regular',
        homeTeam: homeTeam.team.displayName,
        homeTeamAbbr: homeTeam.team.abbreviation,
        homeTeamLogo: homeTeam.team.logo,
        homeScore: parseInt(homeTeam.score) || 0,
        awayTeam: awayTeam.team.displayName,
        awayTeamAbbr: awayTeam.team.abbreviation,
        awayTeamLogo: awayTeam.team.logo,
        awayScore: parseInt(awayTeam.score) || 0,
        gameTime: new Date(event.date),
        gameStatus: competition.status.type.name.toLowerCase(),
        winner: null
      };

      // Determine winner if game is final
      if (gameData.gameStatus === 'final' || gameData.gameStatus === 'status_final') {
        if (gameData.homeScore > gameData.awayScore) {
          gameData.winner = 'home';
        } else if (gameData.awayScore > gameData.homeScore) {
          gameData.winner = 'away';
        } else {
          gameData.winner = 'tie';
        }
      }

      // Check if game exists
      const existingGame = await db.query(
        'SELECT id FROM games WHERE espn_game_id = $1',
        [gameData.espnGameId]
      );

      if (existingGame.rows.length > 0) {
        // Update existing game
        await db.query(
          `UPDATE games SET
            home_score = $1,
            away_score = $2,
            game_status = $3,
            winner = $4,
            updated_at = NOW()
          WHERE espn_game_id = $5`,
          [gameData.homeScore, gameData.awayScore, gameData.gameStatus, gameData.winner, gameData.espnGameId]
        );
        gamesUpdated++;
      } else {
        // Insert new game
        await db.query(
          `INSERT INTO games (
            espn_game_id, season_year, week_number, week_type,
            home_team, home_team_abbr, home_team_logo, home_score,
            away_team, away_team_abbr, away_team_logo, away_score,
            game_time, game_status, winner
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            gameData.espnGameId, gameData.seasonYear, gameData.weekNumber, gameData.weekType,
            gameData.homeTeam, gameData.homeTeamAbbr, gameData.homeTeamLogo, gameData.homeScore,
            gameData.awayTeam, gameData.awayTeamAbbr, gameData.awayTeamLogo, gameData.awayScore,
            gameData.gameTime, gameData.gameStatus, gameData.winner
          ]
        );
        gamesAdded++;
      }
    }

    // Update pick results for completed games
    if (gamesUpdated > 0) {
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
          AND g.season_year = $1
          AND g.week_number = $2
          AND g.game_status IN ('final', 'status_final')
      `, [currentYear, weekNumber]);
    }

    await db.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          gamesAdded,
          gamesUpdated,
          totalGames: events.length,
          week: weekNumber,
          year: currentYear
        },
        message: `Synced ${events.length} games (${gamesAdded} added, ${gamesUpdated} updated)`
      })
    };

  } catch (error) {
    console.error('Error syncing games:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

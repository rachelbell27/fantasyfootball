const { createClient } = require('./db');

/**
 * GET /api/games?week={n}&year={y}
 * Get all games for a specific week
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
    const week = parseInt(params.week);
    const year = parseInt(params.year) || new Date().getFullYear();

    if (!week) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Week parameter required' })
      };
    }

    const db = await createClient();

    const result = await db.query(
      `SELECT
        id, espn_game_id, season_year, week_number, week_type,
        home_team, home_team_abbr, home_team_logo, home_score,
        away_team, away_team_abbr, away_team_logo, away_score,
        game_time, game_status, winner, sync_override
       FROM games
       WHERE season_year = $1 AND week_number = $2
       ORDER BY game_time ASC`,
      [year, week]
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: result.rows.map(game => ({
          id: game.id,
          espnGameId: game.espn_game_id,
          seasonYear: game.season_year,
          weekNumber: game.week_number,
          weekType: game.week_type,
          homeTeam: game.home_team,
          homeTeamAbbr: game.home_team_abbr,
          homeTeamLogo: game.home_team_logo,
          homeScore: game.home_score,
          awayTeam: game.away_team,
          awayTeamAbbr: game.away_team_abbr,
          awayTeamLogo: game.away_team_logo,
          awayScore: game.away_score,
          gameTime: game.game_time,
          gameStatus: game.game_status,
          winner: game.winner,
          syncOverride: game.sync_override
        })),
        message: 'Games retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Error getting games:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

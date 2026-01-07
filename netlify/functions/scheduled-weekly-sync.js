const { createClient } = require('./db');
const { schedule } = require('@netlify/functions');

/**
 * Scheduled function to sync upcoming week schedules
 * Runs daily at 3 AM ET to fetch new games and schedule updates
 * Syncs current week and next 2 weeks to stay ahead
 */
const syncWeeklySchedule = async () => {
  console.log('Starting scheduled weekly sync...');

  try {
    const db = await createClient();
    const now = new Date();
    const currentYear = now.getFullYear();

    // Determine current week by checking games
    const currentWeekResult = await db.query(`
      SELECT DISTINCT week_number, season_year, week_type
      FROM games
      WHERE game_time <= $1
      ORDER BY season_year DESC, week_number DESC
      LIMIT 1
    `, [now]);

    let startWeek = 1;
    let startYear = currentYear;
    let currentWeekType = 'regular';

    if (currentWeekResult.rows.length > 0) {
      startWeek = currentWeekResult.rows[0].week_number;
      startYear = currentWeekResult.rows[0].season_year;
      currentWeekType = currentWeekResult.rows[0].week_type;

      // Check if all games are finished, if so advance to next week
      const weekGamesResult = await db.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN game_status IN ('final', 'status_final') THEN 1 END) as finished
         FROM games
         WHERE week_number = $1 AND season_year = $2 AND week_type = $3`,
        [startWeek, startYear, currentWeekType]
      );

      const { total, finished } = weekGamesResult.rows[0];
      if (total > 0 && parseInt(total) === parseInt(finished)) {
        // All games finished, move to next week
        const nextWeekResult = await db.query(
          `SELECT DISTINCT week_number, season_year, week_type
           FROM games
           WHERE (season_year = $1 AND week_number > $2) OR season_year > $1
           ORDER BY season_year ASC, week_number ASC
           LIMIT 1`,
          [startYear, startWeek]
        );

        if (nextWeekResult.rows.length > 0) {
          startWeek = nextWeekResult.rows[0].week_number;
          startYear = nextWeekResult.rows[0].season_year;
          currentWeekType = nextWeekResult.rows[0].week_type;
        }
      }
    } else {
      // No games found, estimate current week
      const seasonStart = new Date(currentYear, 8, 1); // September 1st
      if (now >= seasonStart) {
        const daysSinceStart = Math.floor((now - seasonStart) / (1000 * 60 * 60 * 24));
        startWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, 18);
      }
    }

    console.log(`Starting from ${currentWeekType} week ${startWeek}, year ${startYear}`);

    // Define weeks to sync
    const weeksToSync = [];

    // Regular season weeks (1-18)
    if (currentWeekType === 'regular') {
      for (let i = 0; i < 3; i++) {
        const weekNum = startWeek + i;
        if (weekNum <= 18) {
          weeksToSync.push({
            weekNumber: weekNum,
            weekType: 'regular',
            seasonType: 2,
            espnWeek: weekNum,
            year: startYear
          });
        } else {
          // Transition to playoffs after week 18
          break;
        }
      }

      // If we're near end of regular season, also fetch wildcard week
      if (startWeek >= 17) {
        weeksToSync.push({
          weekNumber: 1,
          weekType: 'wildcard',
          seasonType: 3,
          espnWeek: 1,
          year: startYear
        });
      }
    }

    // Playoff weeks
    if (currentWeekType !== 'regular' || startWeek >= 18) {
      const playoffWeeks = [
        { weekType: 'wildcard', espnWeek: 1 },
        { weekType: 'divisional', espnWeek: 2 },
        { weekType: 'conference', espnWeek: 3 },
        { weekType: 'superbowl', espnWeek: 4 }
      ];

      const currentPlayoffIndex = playoffWeeks.findIndex(w => w.weekType === currentWeekType);
      const startIndex = currentPlayoffIndex >= 0 ? currentPlayoffIndex : 0;

      for (let i = startIndex; i < Math.min(startIndex + 3, playoffWeeks.length); i++) {
        weeksToSync.push({
          weekNumber: playoffWeeks[i].espnWeek,
          weekType: playoffWeeks[i].weekType,
          seasonType: 3,
          espnWeek: playoffWeeks[i].espnWeek,
          year: startYear
        });
      }
    }

    let totalGamesAdded = 0;
    let totalGamesUpdated = 0;

    // Sync each week
    for (const weekInfo of weeksToSync) {
      const { weekNumber, weekType, seasonType, espnWeek, year } = weekInfo;

      console.log(`Syncing ${weekType} week ${weekNumber} (ESPN week ${espnWeek}, seasonType ${seasonType})`);

      // Fetch games from ESPN API
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=${seasonType}&week=${espnWeek}`;
      const response = await fetch(espnUrl);

      if (!response.ok) {
        console.error(`Failed to fetch games for ${weekType} week ${weekNumber}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const events = data.events || [];

      if (events.length === 0) {
        console.log(`No games found for ${weekType} week ${weekNumber}`);
        continue;
      }

      for (const event of events) {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        const gameData = {
          espnGameId: event.id,
          seasonYear: year,
          weekNumber: weekNumber,
          weekType: weekType,
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
          'SELECT id, sync_override FROM games WHERE espn_game_id = $1',
          [gameData.espnGameId]
        );

        if (existingGame.rows.length > 0) {
          // Only update if sync_override is not set
          if (!existingGame.rows[0].sync_override) {
            await db.query(
              `UPDATE games SET
                home_score = $1,
                away_score = $2,
                game_status = $3,
                winner = $4,
                game_time = $5,
                last_synced_at = NOW(),
                updated_at = NOW()
              WHERE espn_game_id = $6`,
              [gameData.homeScore, gameData.awayScore, gameData.gameStatus,
               gameData.winner, gameData.gameTime, gameData.espnGameId]
            );
            totalGamesUpdated++;
          }
        } else {
          // Insert new game
          await db.query(
            `INSERT INTO games (
              espn_game_id, season_year, week_number, week_type,
              home_team, home_team_abbr, home_team_logo, home_score,
              away_team, away_team_abbr, away_team_logo, away_score,
              game_time, game_status, winner, last_synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
            [
              gameData.espnGameId, gameData.seasonYear, gameData.weekNumber, gameData.weekType,
              gameData.homeTeam, gameData.homeTeamAbbr, gameData.homeTeamLogo, gameData.homeScore,
              gameData.awayTeam, gameData.awayTeamAbbr, gameData.awayTeamLogo, gameData.awayScore,
              gameData.gameTime, gameData.gameStatus, gameData.winner
            ]
          );
          totalGamesAdded++;
        }
      }

      console.log(`Synced ${events.length} games for ${weekType} week ${weekNumber}`);
    }

    // Update pick results for any newly completed games
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
    console.log(`Weekly sync completed: ${totalGamesAdded} games added, ${totalGamesUpdated} games updated`);

  } catch (error) {
    console.error('Error in scheduled weekly sync:', error);
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
      await syncWeeklySchedule();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Weekly sync completed successfully',
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
  await syncWeeklySchedule();
};

// Schedule to run daily at 3 AM ET (8 AM UTC)
// Cron format: minute hour day month dayOfWeek
exports.handler = schedule('0 8 * * *', handler);

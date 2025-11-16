const { createClient } = require('@netlify/neon');

/**
 * GET /api/picks/compare-week
 * Compare logged-in user's picks with all other league members for a specific week
 *
 * Query params:
 * - week: week number
 * - year: season year (optional, defaults to current year)
 * - leagueId: league ID
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
    // Get user from context (populated by auth middleware)
    const userId = context.clientContext?.user?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Parse query parameters
    const params = event.queryStringParameters || {};
    const week = parseInt(params.week);
    const year = parseInt(params.year) || new Date().getFullYear();
    const leagueId = parseInt(params.leagueId);

    if (!week || !leagueId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters: week, leagueId' })
      };
    }

    // Connect to database
    const db = createClient(process.env.DATABASE_URL);

    // Verify user is a member of the league
    const memberCheck = await db.query(
      'SELECT id FROM league_members WHERE user_id = $1 AND league_id = $2',
      [userId, leagueId]
    );

    if (memberCheck.rows.length === 0) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Not a member of this league' })
      };
    }

    // Get all games for the specified week
    const gamesResult = await db.query(
      `SELECT id, espn_game_id, week_number, week_type,
              home_team, home_team_abbr, home_team_logo, home_score,
              away_team, away_team_abbr, away_team_logo, away_score,
              game_time, game_status, winner
       FROM games
       WHERE season_year = $1 AND week_number = $2
       ORDER BY game_time`,
      [year, week]
    );

    const games = gamesResult.rows;

    // Get logged-in user's picks and stats for this week
    const yourPicksResult = await db.query(
      `SELECT p.*, u.display_name, u.primary_color
       FROM picks p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1 AND p.league_id = $2
         AND p.game_id IN (
           SELECT id FROM games
           WHERE season_year = $3 AND week_number = $4
         )`,
      [userId, leagueId, year, week]
    );

    const yourPicks = yourPicksResult.rows;
    const yourCorrect = yourPicks.filter(p => p.is_correct === true).length;
    const yourTotal = yourPicks.length;

    // Get your rank for this week
    const rankResult = await db.query(
      `WITH week_scores AS (
         SELECT
           p.user_id,
           COUNT(CASE WHEN p.is_correct = true THEN 1 END) as correct_picks,
           COUNT(*) as total_picks
         FROM picks p
         JOIN games g ON p.game_id = g.id
         WHERE g.season_year = $1 AND g.week_number = $2
           AND p.league_id = $3
         GROUP BY p.user_id
       )
       SELECT
         user_id,
         RANK() OVER (ORDER BY correct_picks DESC) as rank,
         COUNT(*) OVER () as total_users
       FROM week_scores
       WHERE user_id = $4`,
      [year, week, leagueId, userId]
    );

    const yourRank = rankResult.rows[0]?.rank || 0;
    const totalUsers = rankResult.rows[0]?.total_users || 0;

    // Get all other league members' picks for this week
    const allPicksResult = await db.query(
      `SELECT
         u.id as user_id,
         u.display_name,
         u.primary_color,
         p.game_id,
         p.predicted_winner,
         p.is_correct,
         g.winner,
         g.home_team,
         g.away_team
       FROM league_members lm
       JOIN users u ON lm.user_id = u.id
       LEFT JOIN picks p ON u.id = p.user_id
         AND p.league_id = $1
         AND p.game_id IN (
           SELECT id FROM games
           WHERE season_year = $2 AND week_number = $3
         )
       LEFT JOIN games g ON p.game_id = g.id
       WHERE lm.league_id = $1 AND lm.user_id != $4
       ORDER BY u.display_name, g.game_time`,
      [leagueId, year, week, userId]
    );

    // Group picks by user
    const userPicksMap = {};
    allPicksResult.rows.forEach(row => {
      if (!userPicksMap[row.user_id]) {
        userPicksMap[row.user_id] = {
          userId: row.user_id,
          displayName: row.display_name,
          primaryColor: row.primary_color,
          picks: []
        };
      }
      if (row.game_id) {
        userPicksMap[row.user_id].picks.push({
          gameId: row.game_id,
          predictedWinner: row.predicted_winner,
          isCorrect: row.is_correct,
          winner: row.winner,
          homeTeam: row.home_team,
          awayTeam: row.away_team
        });
      }
    });

    // Calculate comparison stats for each user
    const comparisons = [];
    let mostAgreedWith = null;
    let mostContrarian = null;
    let maxAgreement = -1;
    let minAgreement = 101;

    Object.values(userPicksMap).forEach(otherUser => {
      const theirPicks = otherUser.picks;
      const theirCorrect = theirPicks.filter(p => p.isCorrect === true).length;
      const theirTotal = theirPicks.length;

      // Calculate agreement
      let agreedGames = 0;
      let comparableGames = 0;
      let bothCorrectWhenAgreed = 0;
      let youCorrectWhenDisagreed = 0;
      let themCorrectWhenDisagreed = 0;

      games.forEach(game => {
        const yourPick = yourPicks.find(p => p.game_id === game.id);
        const theirPick = theirPicks.find(p => p.gameId === game.id);

        if (yourPick && theirPick) {
          comparableGames++;

          if (yourPick.predicted_winner === theirPick.predictedWinner) {
            agreedGames++;
            if (yourPick.is_correct && theirPick.isCorrect) {
              bothCorrectWhenAgreed++;
            }
          } else {
            // Disagreed
            if (yourPick.is_correct) youCorrectWhenDisagreed++;
            if (theirPick.isCorrect) themCorrectWhenDisagreed++;
          }
        }
      });

      const agreementRate = comparableGames > 0
        ? (agreedGames / comparableGames) * 100
        : 0;

      const jointSuccessRate = agreedGames > 0
        ? (bothCorrectWhenAgreed / agreedGames) * 100
        : 0;

      // Get their rank
      const theirRankResult = rankResult.rows.find(r => r.user_id === otherUser.userId);
      const theirRank = theirRankResult?.rank || 0;

      const comparison = {
        userId: otherUser.userId,
        displayName: otherUser.displayName,
        primaryColor: otherUser.primaryColor,
        record: {
          correct: theirCorrect,
          total: theirTotal
        },
        rank: theirRank,
        agreementRate: Math.round(agreementRate * 10) / 10,
        agreedGames,
        comparableGames,
        bothCorrectWhenAgreed,
        youCorrectWhenDisagreed,
        themCorrectWhenDisagreed,
        jointSuccessRate: Math.round(jointSuccessRate * 10) / 10,
        picks: theirPicks
      };

      comparisons.push(comparison);

      // Track most agreed/contrarian
      if (comparableGames > 0) {
        if (agreementRate > maxAgreement) {
          maxAgreement = agreementRate;
          mostAgreedWith = {
            userId: otherUser.userId,
            name: otherUser.displayName.split(' ')[0],
            rate: Math.round(agreementRate * 10) / 10,
            games: agreedGames
          };
        }
        if (agreementRate < minAgreement) {
          minAgreement = agreementRate;
          mostContrarian = {
            userId: otherUser.userId,
            name: otherUser.displayName.split(' ')[0],
            rate: Math.round(agreementRate * 10) / 10,
            games: comparableGames - agreedGames
          };
        }
      }
    });

    // Find boldest call (your correct underdog pick that few others chose)
    let boldestCall = null;
    if (yourPicks.length > 0) {
      // Get league consensus for each game
      const consensusResult = await db.query(
        `SELECT
           p.game_id,
           p.predicted_winner,
           COUNT(*) as pick_count,
           COUNT(*) OVER (PARTITION BY p.game_id) as total_picks
         FROM picks p
         WHERE p.league_id = $1
           AND p.game_id IN (
             SELECT id FROM games
             WHERE season_year = $2 AND week_number = $3
           )
         GROUP BY p.game_id, p.predicted_winner`,
        [leagueId, year, week]
      );

      const consensusMap = {};
      consensusResult.rows.forEach(row => {
        if (!consensusMap[row.game_id]) {
          consensusMap[row.game_id] = {
            totalPicks: row.total_picks,
            picks: []
          };
        }
        consensusMap[row.game_id].picks.push({
          winner: row.predicted_winner,
          count: parseInt(row.pick_count)
        });
      });

      // Find your most contrarian correct pick
      let lowestConsensus = 100;
      yourPicks.forEach(pick => {
        if (pick.is_correct && consensusMap[pick.game_id]) {
          const gameConsensus = consensusMap[pick.game_id];
          const yourPickCount = gameConsensus.picks.find(
            p => p.winner === pick.predicted_winner
          )?.count || 0;

          const consensusPercent = (yourPickCount / gameConsensus.totalPicks) * 100;

          if (consensusPercent < lowestConsensus && consensusPercent < 50) {
            lowestConsensus = consensusPercent;
            const game = games.find(g => g.id === pick.game_id);
            if (game) {
              boldestCall = {
                game: `${game.away_team_abbr} @ ${game.home_team_abbr}`,
                yourPick: pick.predicted_winner === 'home'
                  ? game.home_team
                  : pick.predicted_winner === 'away'
                    ? game.away_team
                    : 'Tie',
                consensusPercent: Math.round(consensusPercent),
                pickerCount: yourPickCount,
                totalPickers: gameConsensus.totalPicks,
                result: 'correct'
              };
            }
          }
        }
      });
    }

    // Sort comparisons by agreement rate (descending)
    comparisons.sort((a, b) => b.agreementRate - a.agreementRate);

    // Build response
    const response = {
      data: {
        yourPicks: {
          userId: parseInt(userId),
          displayName: yourPicksResult.rows[0]?.display_name || 'You',
          record: {
            correct: yourCorrect,
            total: yourTotal
          },
          rank: yourRank,
          totalUsers: totalUsers,
          picks: yourPicks.map(p => ({
            gameId: p.game_id,
            predictedWinner: p.predicted_winner,
            isCorrect: p.is_correct
          }))
        },
        comparisons,
        insights: {
          mostAgreedWith,
          mostContrarian,
          boldestCall
        },
        games: games.map(g => ({
          id: g.id,
          espnGameId: g.espn_game_id,
          weekNumber: g.week_number,
          weekType: g.week_type,
          homeTeam: g.home_team,
          homeTeamAbbr: g.home_team_abbr,
          homeTeamLogo: g.home_team_logo,
          homeScore: g.home_score,
          awayTeam: g.away_team,
          awayTeamAbbr: g.away_team_abbr,
          awayTeamLogo: g.away_team_logo,
          awayScore: g.away_score,
          gameTime: g.game_time,
          gameStatus: g.game_status,
          winner: g.winner
        })),
        week,
        year,
        leagueId
      },
      message: 'Picks comparison retrieved successfully'
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error in picks-compare-week:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

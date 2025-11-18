/**
 * Compare Picks Page
 *
 * Grid view showing all users' picks for each game in a week
 */

const ComparePicksPage = {
  state: {
    currentWeek: null,
    currentYear: null,
    leagueId: 1,
    games: [],
    users: [],
    allPicks: []
  },

  /**
   * Render the compare picks page
   */
  async render(container) {
    if (!container) {
      console.error('Container not found');
      return;
    }

    try {
      // Fetch current week
      const weekResponse = await API.games.getCurrentWeek();
      this.state.currentWeek = weekResponse.data.weekNumber;
      this.state.currentYear = weekResponse.data.year;

      // Fetch games
      const gamesResponse = await API.games.getGames(this.state.currentWeek, this.state.currentYear);
      this.state.games = gamesResponse.data;

      // Fetch all users in league
      const usersResponse = await API.users.list(this.state.leagueId);
      this.state.users = usersResponse.data;

      // Fetch all picks for this week/league from all users
      const picksResponse = await API.picks.getAll(this.state.currentWeek, this.state.currentYear, this.state.leagueId);
      this.state.allPicks = picksResponse.data;

      container.innerHTML = `
        <div class="compare-picks-page">
          ${this.renderHeader()}
          ${this.renderWeekSelector()}
          ${this.renderPicksGrid()}
        </div>
      `;

      this.attachEventListeners(container);

    } catch (error) {
      console.error('Error loading compare picks page:', error);
      container.innerHTML = `
        <div class="compare-picks-page">
          <div class="error-message card">
            <h2>Error Loading Data</h2>
            <p>${error.message || 'Failed to load comparison data'}</p>
            <button class="btn btn-primary" onclick="location.reload()">
              Retry
            </button>
          </div>
        </div>
      `;
    }
  },

  /**
   * Render header
   */
  renderHeader() {
    return `
      <div class="compare-picks-header">
        <h1>Compare All Picks</h1>
        <p class="compare-picks-subtitle">Week ${this.state.currentWeek} - ${this.state.currentYear} Season</p>
      </div>
    `;
  },

  /**
   * Render week selector
   */
  renderWeekSelector() {
    // For now, just show current week - we can add dropdown later
    return `
      <div class="week-selector-compact card">
        <button class="btn btn-secondary" id="prev-week-btn">
          ← Previous Week
        </button>
        <span class="week-display">Week ${this.state.currentWeek}</span>
        <button class="btn btn-secondary" id="next-week-btn">
          Next Week →
        </button>
      </div>
    `;
  },

  /**
   * Render picks grid
   */
  renderPicksGrid() {
    if (this.state.games.length === 0) {
      return '<div class="no-data card">No games found for this week</div>';
    }

    const gameRows = this.state.games.map(game => {
      return `
        <div class="pick-grid-game card">
          <div class="pick-grid-game-header">
            <div class="pick-grid-teams">
              <div class="pick-grid-team">
                <img src="${game.awayTeamLogo}" alt="${game.awayTeam}" class="team-logo-sm">
                <span class="team-abbr">${game.awayTeamAbbr}</span>
              </div>
              <span class="vs">@</span>
              <div class="pick-grid-team">
                <img src="${game.homeTeamLogo}" alt="${game.homeTeam}" class="team-logo-sm">
                <span class="team-abbr">${game.homeTeamAbbr}</span>
              </div>
            </div>
            ${this.renderGameStatus(game)}
          </div>
          <div class="pick-grid-picks">
            ${this.renderUserPicks(game)}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="picks-grid-container">
        ${gameRows}
      </div>
    `;
  },

  /**
   * Render game status
   */
  renderGameStatus(game) {
    const gameTime = new Date(game.gameTime);
    const isFinal = game.gameStatus === 'final' || game.gameStatus === 'status_final';
    const isPre = game.gameStatus === 'pre' || game.gameStatus === 'scheduled';

    if (isFinal) {
      return `
        <div class="pick-grid-score final">
          <span class="score">${game.awayScore} - ${game.homeScore}</span>
          <span class="status">Final</span>
        </div>
      `;
    } else if (isPre) {
      return `
        <div class="pick-grid-time">
          <span class="game-time">${Timezone.formatGameTime(gameTime)}</span>
        </div>
      `;
    } else {
      return `
        <div class="pick-grid-score live">
          <span class="score">${game.awayScore} - ${game.homeScore}</span>
          <span class="status">Live</span>
        </div>
      `;
    }
  },

  /**
   * Render picks for all users for a specific game
   */
  renderUserPicks(game) {
    const gamePicks = this.state.allPicks.filter(pick => pick.gameId === game.id);

    const userPickElements = this.state.users.map(user => {
      const userPick = gamePicks.find(pick => pick.userId === user.id);
      const currentUserId = Auth.currentUser?.id;
      const isCurrentUser = user.id === currentUserId;

      if (!userPick) {
        return `
          <div class="user-pick no-pick ${isCurrentUser ? 'current-user' : ''}">
            <div class="user-avatar-tiny" style="background-color: ${user.primaryColor || '#8AB4F8'}; color: ${Colors.getContrastColor(user.primaryColor || '#8AB4F8')};">
              ${user.displayName.charAt(0).toUpperCase()}
            </div>
            <span class="pick-status">-</span>
          </div>
        `;
      }

      const pickedTeam = userPick.predictedWinner === 'home' ? game.homeTeamAbbr : game.awayTeamAbbr;
      const isCorrect = userPick.isCorrect;
      const isFinal = game.gameStatus === 'final' || game.gameStatus === 'status_final';

      let pickClass = '';
      if (isFinal) {
        pickClass = isCorrect ? 'correct' : 'incorrect';
      }

      return `
        <div class="user-pick ${pickClass} ${isCurrentUser ? 'current-user' : ''}"
             title="${user.displayName} picked ${pickedTeam}">
          <div class="user-avatar-tiny" style="background-color: ${user.primaryColor || '#8AB4F8'}; color: ${Colors.getContrastColor(user.primaryColor || '#8AB4F8')};">
            ${user.displayName.charAt(0).toUpperCase()}
          </div>
          <span class="pick-team">${pickedTeam}</span>
          ${isFinal ? `<span class="pick-result">${isCorrect ? '✓' : '✗'}</span>` : ''}
        </div>
      `;
    }).join('');

    return userPickElements;
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    const prevBtn = container.querySelector('#prev-week-btn');
    const nextBtn = container.querySelector('#next-week-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', async () => {
        if (this.state.currentWeek > 1) {
          this.state.currentWeek--;
          await this.render(container);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (this.state.currentWeek < 18) {
          this.state.currentWeek++;
          await this.render(container);
        }
      });
    }
  }
};

// Make globally available
window.ComparePicksPage = ComparePicksPage;

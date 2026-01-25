/**
 * Compare Picks Page
 *
 * Grid view showing all users' picks for each game in a week
 */

const ComparePicksPage = {
  state: {
    currentWeek: null,
    currentYear: null,
    currentWeekType: null,
    leagueId: 1,
    games: [],
    users: [],
    allPicks: [],
    availableWeeks: []
  },

  /**
   * Get display name for week type
   */
  getWeekDisplayName(weekType, weekNumber) {
    if (weekType === 'regular') {
      return `Week ${weekNumber}`;
    }

    const weekTypeNames = {
      'wildcard': 'Wild Card',
      'divisional': 'Divisional Round',
      'conference': 'Conference Championship',
      'superbowl': 'Super Bowl'
    };
    return weekTypeNames[weekType] || weekType;
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
      // Fetch available weeks if not already loaded
      if (this.state.availableWeeks.length === 0) {
        const weeksResponse = await API.games.getWeeks();
        this.state.availableWeeks = weeksResponse.data || [];
      }

      // Only fetch current week if not already set (initial load)
      if (!this.state.currentWeek || !this.state.currentWeekType) {
        const weekResponse = await API.games.getCurrentWeek();
        this.state.currentWeek = weekResponse.data.weekNumber;
        this.state.currentYear = weekResponse.data.year;
        this.state.currentWeekType = weekResponse.data.weekType;
      }

      // Fetch games for the selected week
      const gamesResponse = await API.games.getGames(
        this.state.currentWeek,
        this.state.currentYear,
        this.state.currentWeekType
      );
      this.state.games = gamesResponse.data;

      // Fetch all users in league
      const usersResponse = await API.users.list(this.state.leagueId);
      this.state.users = usersResponse.data;

      // Fetch all picks for this week/league from all users
      const picksResponse = await API.picks.getAll(
        this.state.currentWeek,
        this.state.currentYear,
        this.state.leagueId,
        this.state.currentWeekType
      );
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
    const weekTitle = this.getWeekDisplayName(this.state.currentWeekType, this.state.currentWeek);

    return `
      <div class="compare-picks-header">
        <h1>Compare All Picks</h1>
        <p class="compare-picks-subtitle">${weekTitle} - ${this.state.currentYear} Season</p>
      </div>
    `;
  },

  /**
   * Render week selector
   */
  renderWeekSelector() {
    if (this.state.availableWeeks.length === 0) {
      return '<div class="week-selector-compact card">Loading weeks...</div>';
    }

    // Create dropdown options grouped by season type
    const regularWeeks = this.state.availableWeeks.filter(w => w.weekType === 'regular');
    const playoffWeeks = this.state.availableWeeks.filter(w => w.weekType !== 'regular');

    const regularOptions = regularWeeks.map(week => {
      const isSelected = week.weekNumber === this.state.currentWeek &&
                        week.weekType === this.state.currentWeekType &&
                        week.seasonYear === this.state.currentYear;
      return `<option value="${week.seasonYear}-${week.weekNumber}-${week.weekType}" ${isSelected ? 'selected' : ''}>
        Week ${week.weekNumber} (${week.seasonYear})
      </option>`;
    }).join('');

    const playoffOptions = playoffWeeks.map(week => {
      const isSelected = week.weekNumber === this.state.currentWeek &&
                        week.weekType === this.state.currentWeekType &&
                        week.seasonYear === this.state.currentYear;
      const displayName = this.getWeekDisplayName(week.weekType, week.weekNumber);
      return `<option value="${week.seasonYear}-${week.weekNumber}-${week.weekType}" ${isSelected ? 'selected' : ''}>
        ${displayName} (${week.seasonYear})
      </option>`;
    }).join('');

    return `
      <div class="week-selector-compact card">
        <label for="week-dropdown" class="week-selector-label">Select Week:</label>
        <select id="week-dropdown" class="form-input week-dropdown">
          ${regularOptions ? `<optgroup label="Regular Season">${regularOptions}</optgroup>` : ''}
          ${playoffOptions ? `<optgroup label="Playoffs">${playoffOptions}</optgroup>` : ''}
        </select>
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
    const isPre = game.gameStatus === 'pre' || game.gameStatus === 'scheduled' || game.gameStatus === 'status_scheduled';

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
    const weekDropdown = container.querySelector('#week-dropdown');

    if (weekDropdown) {
      weekDropdown.addEventListener('change', async (e) => {
        const [year, weekNumber, weekType] = e.target.value.split('-');
        this.state.currentYear = parseInt(year);
        this.state.currentWeek = parseInt(weekNumber);
        this.state.currentWeekType = weekType;
        await this.render(container);
      });
    }
  }
};

// Make globally available
window.ComparePicksPage = ComparePicksPage;

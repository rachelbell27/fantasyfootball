/**
 * Home Page
 *
 * Displays current week overview and leaderboard
 */

const HomePage = {
  state: {
    currentWeek: null,
    currentYear: null,
    currentWeekType: null,
    leagueId: 1 // Default league
  },

  /**
   * Render the home page
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
      this.state.currentWeekType = weekResponse.data.weekType;

      // Fetch leaderboard data
      const leaderboardResponse = await API.leaderboard.getWeek(
        this.state.currentWeek,
        this.state.leagueId,
        this.state.currentYear,
        this.state.currentWeekType
      );

      container.innerHTML = `
        <div class="home-page">
          ${this.renderHeader()}
          ${this.renderQuickActions()}
          ${this.renderLeaderboard(leaderboardResponse.data)}
        </div>
      `;

      this.attachEventListeners(container);

      // Listen for game updates from GameSync
      this.setupGameUpdateListener(container);

    } catch (error) {
      console.error('Error loading home page:', error);
      container.innerHTML = `
        <div class="home-page">
          <div class="error-message card">
            <h2>Error Loading Data</h2>
            <p>${error.message || 'Failed to load home page'}</p>
            <button class="btn btn-primary" onclick="location.reload()">
              Retry
            </button>
          </div>
        </div>
      `;
    }
  },

  /**
   * Setup listener for automatic game updates
   */
  setupGameUpdateListener(container) {
    // Remove any existing listener
    if (this.gameUpdateHandler) {
      window.removeEventListener('games-updated', this.gameUpdateHandler);
    }

    // Create new handler
    this.gameUpdateHandler = async (event) => {
      console.log('Games updated, refreshing home page...');
      // Re-render the page with updated data
      await this.render(container);
    };

    // Add listener
    window.addEventListener('games-updated', this.gameUpdateHandler);
  },

  /**
   * Get display name for week type
   */
  getWeekDisplayName(weekType) {
    const weekTypeNames = {
      'regular': 'Regular Season',
      'wildcard': 'Wild Card',
      'divisional': 'Divisional',
      'conference': 'Conference Championship',
      'superbowl': 'Super Bowl'
    };
    return weekTypeNames[weekType] || weekType;
  },

  /**
   * Render header section
   */
  renderHeader() {
    let weekTitle;
    if (this.state.currentWeekType === 'regular') {
      weekTitle = `Week ${this.state.currentWeek}`;
    } else {
      weekTitle = this.getWeekDisplayName(this.state.currentWeekType);
    }

    return `
      <div class="home-header">
        <h1>${weekTitle} Leaderboard</h1>
        <p class="home-subtitle">${this.state.currentYear} Season</p>
      </div>
    `;
  },

  /**
   * Render quick action buttons
   */
  renderQuickActions() {
    return `
      <div class="quick-actions">
        <a href="#picks" class="btn btn-primary">
          Make Your Picks
        </a>
        <a href="#compare-picks" class="btn btn-secondary">
          Compare Picks
        </a>
      </div>
    `;
  },

  /**
   * Render leaderboard
   */
  renderLeaderboard(leaderboardData) {
    const currentUserId = Auth.currentUser?.id;

    if (!leaderboardData || leaderboardData.length === 0) {
      return `
        <div class="leaderboard-empty card">
          <p>No leaderboard data available yet.</p>
          <p>Make your picks to get started!</p>
        </div>
      `;
    }

    const rows = leaderboardData.map(entry => {
      const isCurrentUser = entry.userId === currentUserId;
      const rowStyle = entry.primaryColor
        ? Colors.getRowTintStyle(entry.primaryColor)
        : '';

      return `
        <div class="leaderboard-row ${isCurrentUser ? 'current-user' : ''} expandable-row"
             style="${entry.primaryColor ? `border-left-color: ${entry.primaryColor}` : ''}"
             data-user-id="${entry.userId}">

          <!-- Top row: Rank, User, Points -->
          <div style="display: flex; align-items: center; gap: var(--spacing-sm); width: 100%;">
            <div class="leaderboard-rank">
              <span class="rank-number">#${entry.rank}</span>
            </div>

            <div class="leaderboard-user">
              <div class="user-info">
                <div class="user-name">
                  ${entry.displayName}
                  ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
                </div>
                <div class="user-record">${entry.wins}-${entry.losses}${entry.ties > 0 ? `-${entry.ties}` : ''}</div>
              </div>
            </div>

            <div class="leaderboard-points">
              <div class="points-value">${entry.points}</div>
              <div class="points-label">points</div>
            </div>
          </div>

          <!-- Bottom row: Actions -->
          <div class="leaderboard-actions">
            <button class="btn btn-text compare-user-btn"
                    data-user-id="${entry.userId}"
                    data-user-name="${entry.displayName}"
                    title="Compare picks with ${entry.displayName}">
              Compare
            </button>
          </div>
        </div>
      `;
    }).join('');

    let weekTitle;
    if (this.state.currentWeekType === 'regular') {
      weekTitle = `Week ${this.state.currentWeek}`;
    } else {
      weekTitle = this.getWeekDisplayName(this.state.currentWeekType);
    }

    return `
      <div class="leaderboard-container">
        <div class="leaderboard-header">
          <h2>${weekTitle} Standings</h2>
        </div>
        <div class="leaderboard">
          ${rows}
        </div>
        <div class="leaderboard-footer">
          <a href="#compare-picks"
             class="btn btn-secondary">
            Compare All Picks
          </a>
        </div>
      </div>
    `;
  },

  /**
   * Get rank icon (trophy for top 3)
   */
  getRankIcon(rank) {
    switch (rank) {
      case 1:
        return '<span class="rank-icon gold">🏆</span>';
      case 2:
        return '<span class="rank-icon silver">🥈</span>';
      case 3:
        return '<span class="rank-icon bronze">🥉</span>';
      default:
        return '';
    }
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Compare user buttons
    const compareButtons = container.querySelectorAll('.compare-user-btn');
    compareButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Navigate to compare picks page
        window.location.hash = `compare-picks`;
      });
    });

    // View season leaderboard
    const seasonBtn = container.querySelector('#view-season-leaderboard');
    if (seasonBtn) {
      seasonBtn.addEventListener('click', async () => {
        try {
          UI.showLoading();
          const seasonData = await API.leaderboard.getSeason(this.state.leagueId);

          // Update leaderboard display with season data
          const leaderboardContainer = container.querySelector('.leaderboard');
          if (leaderboardContainer) {
            leaderboardContainer.innerHTML = this.renderSeasonLeaderboard(seasonData.data);
          }

          // Update header
          const header = container.querySelector('.leaderboard-header h2');
          if (header) {
            header.textContent = `${this.state.currentYear} Season Standings`;
          }

          // Update button text
          seasonBtn.textContent = 'View This Week';
          seasonBtn.id = 'view-week-leaderboard';

          UI.hideLoading();
        } catch (error) {
          console.error('Error loading season leaderboard:', error);
          UI.showToast('Failed to load season standings', 'error');
          UI.hideLoading();
        }
      });
    }

    // View week leaderboard (when in season view)
    container.addEventListener('click', async (e) => {
      if (e.target.id === 'view-week-leaderboard') {
        await this.render(container);
      }
    });
  },

  /**
   * Render season leaderboard rows
   */
  renderSeasonLeaderboard(seasonData) {
    const currentUserId = Auth.currentUser?.id;

    return seasonData.map(entry => {
      const isCurrentUser = entry.userId === currentUserId;
      const rowStyle = entry.primaryColor
        ? Colors.getRowTintStyle(entry.primaryColor)
        : '';

      return `
        <div class="leaderboard-row ${isCurrentUser ? 'current-user' : ''}"
             style="${rowStyle}">
          <div class="leaderboard-rank">
            ${this.getRankIcon(entry.rank)}
            <span class="rank-number">#${entry.rank}</span>
          </div>

          <div class="leaderboard-user">
            <div class="user-avatar" style="${Colors.getAvatarStyle(entry.primaryColor)}">
              ${entry.displayName.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
              <div class="user-name">
                ${entry.displayName}
                ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
              </div>
              <div class="user-record">${entry.totalWins}-${entry.totalLosses}${entry.totalTies > 0 ? `-${entry.totalTies}` : ''}</div>
            </div>
          </div>

          <div class="leaderboard-points">
            <div class="points-value">${entry.totalPoints}</div>
            <div class="points-label">points</div>
          </div>

          <div class="leaderboard-actions">
            <button class="btn btn-icon" disabled title="Season comparison coming soon">
              🔍
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
};

// Make globally available
window.HomePage = HomePage;

/**
 * Home Page
 *
 * Displays current week overview and leaderboard
 */

const HomePage = {
  state: {
    currentWeek: null,
    currentYear: null,
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

      // Fetch leaderboard data
      const leaderboardResponse = await API.leaderboard.getWeek(
        this.state.currentWeek,
        this.state.leagueId
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
   * Render header section
   */
  renderHeader() {
    return `
      <div class="home-header">
        <h1>Week ${this.state.currentWeek} Leaderboard</h1>
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
        <a href="#comparison?week=${this.state.currentWeek}&year=${this.state.currentYear}&leagueId=${this.state.leagueId}"
           class="btn btn-secondary">
          📊 Compare Picks
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
             style="background-color: ${entry.primaryColor ? Colors.hexToRgba(entry.primaryColor, 0.05) : 'transparent'}; ${entry.primaryColor ? `border-left: 4px solid ${entry.primaryColor}` : ''}"
             data-user-id="${entry.userId}">
          <div class="leaderboard-rank">
            ${this.getRankIcon(entry.rank)}
            <span class="rank-number">#${entry.rank}</span>
          </div>

          <div class="leaderboard-user">
            <div class="user-avatar" style="background-color: ${entry.primaryColor || '#8AB4F8'}; color: ${Colors.getContrastColor(entry.primaryColor || '#8AB4F8')};">
              ${entry.displayName.charAt(0).toUpperCase()}
            </div>
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

          <div class="leaderboard-actions">
            <button class="btn btn-text compare-user-btn"
                    data-user-id="${entry.userId}"
                    data-user-name="${entry.displayName}"
                    title="Compare picks with ${entry.displayName}">
              Compare
            </button>
            <button class="btn btn-icon btn-text expand-user-btn"
                    data-user-id="${entry.userId}"
                    title="View ${entry.displayName}'s weekly performance">
              <span class="expand-icon">▼</span>
            </button>
          </div>
        </div>
        <div class="leaderboard-row-details" id="details-${entry.userId}" style="display: none;">
          <div class="loading">Loading weekly breakdown...</div>
        </div>
      `;
    }).join('');

    return `
      <div class="leaderboard-container card">
        <div class="leaderboard-header">
          <h2>Week ${this.state.currentWeek} Standings</h2>
          <button class="btn btn-text" id="view-season-leaderboard">
            View Season Standings
          </button>
        </div>
        <div class="leaderboard">
          ${rows}
        </div>
        <div class="leaderboard-footer">
          <a href="#comparison?week=${this.state.currentWeek}&year=${this.state.currentYear}&leagueId=${this.state.leagueId}"
             class="btn btn-secondary btn-full-width">
            📊 See Full Week ${this.state.currentWeek} Comparison
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
    // Expand user details buttons
    const expandButtons = container.querySelectorAll('.expand-user-btn');
    expandButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.dataset.userId;
        const detailsDiv = document.getElementById(`details-${userId}`);
        const expandIcon = btn.querySelector('.expand-icon');
        const row = btn.closest('.leaderboard-row');

        if (detailsDiv.style.display === 'none' || !detailsDiv.style.display) {
          // Expand
          try {
            // Check if we already loaded the data
            if (!detailsDiv.dataset.loaded) {
              detailsDiv.innerHTML = '<div class="loading">Loading weekly breakdown...</div>';
              detailsDiv.style.display = 'block';

              // Fetch user's weekly stats
              const response = await API.stats.getUser(userId, this.state.leagueId);

              // Render weekly breakdown
              detailsDiv.innerHTML = this.renderWeeklyBreakdown(response.data);
              detailsDiv.dataset.loaded = 'true';
            } else {
              detailsDiv.style.display = 'block';
            }

            expandIcon.textContent = '▲';
            row.classList.add('expanded');
          } catch (error) {
            console.error('Error loading weekly breakdown:', error);
            detailsDiv.innerHTML = `
              <div class="error-message">
                Failed to load weekly breakdown. Please try again.
              </div>
            `;
          }
        } else {
          // Collapse
          detailsDiv.style.display = 'none';
          expandIcon.textContent = '▼';
          row.classList.remove('expanded');
        }
      });
    });

    // Compare user buttons
    const compareButtons = container.querySelectorAll('.compare-user-btn');
    compareButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = btn.dataset.userId;
        const userName = btn.dataset.userName;

        // Navigate to comparison page
        window.location.hash = `#comparison?week=${this.state.currentWeek}&year=${this.state.currentYear}&leagueId=${this.state.leagueId}`;
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
   * Render weekly breakdown for a user
   */
  renderWeeklyBreakdown(statsData) {
    const weeklyData = statsData.weekly || [];

    if (weeklyData.length === 0) {
      return '<div class="no-data">No weekly data available</div>';
    }

    const weekRows = weeklyData.map(week => {
      const correctPicks = week.correct_picks || 0;
      const totalPicks = week.total_picks || 0;
      const incorrectPicks = week.incorrect_picks || 0;
      const percentage = totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0;

      return `
        <div class="week-stat-row">
          <div class="week-number">Week ${week.week_number}</div>
          <div class="week-record">${correctPicks}-${incorrectPicks}</div>
          <div class="week-percentage">${percentage}%</div>
        </div>
      `;
    }).join('');

    return `
      <div class="weekly-breakdown">
        <div class="breakdown-header">
          <div class="week-number">Week</div>
          <div class="week-record">Record</div>
          <div class="week-percentage">Accuracy</div>
        </div>
        ${weekRows}
      </div>
    `;
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

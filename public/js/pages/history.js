/**
 * History Page
 *
 * View past picks and results by week
 */

const HistoryPage = {
  state: {
    selectedWeek: null,
    selectedYear: null,
    leagueId: 1,
    availableWeeks: []
  },

  /**
   * Render the history page
   */
  async render(container) {
    if (!container) {
      console.error('Container not found');
      return;
    }

    try {
      // Fetch available weeks
      const weeksResponse = await API.games.getWeeks();
      this.state.availableWeeks = weeksResponse.data;

      // Get current week if not selected
      if (!this.state.selectedWeek) {
        const currentWeek = await API.games.getCurrentWeek();
        this.state.selectedWeek = currentWeek.data.weekNumber;
        this.state.selectedYear = currentWeek.data.year;
      }

      // Fetch games and picks for selected week
      const [gamesResponse, picksResponse] = await Promise.all([
        API.games.getGames(this.state.selectedWeek, this.state.selectedYear),
        API.picks.get(this.state.selectedWeek, this.state.selectedYear, this.state.leagueId)
      ]);

      const games = gamesResponse.data;
      const picks = picksResponse.data;

      // Calculate stats
      const stats = this.calculateWeekStats(games, picks);

      container.innerHTML = `
        <div class="history-page">
          ${this.renderHeader()}
          ${this.renderWeekSelector()}
          ${this.renderWeekStats(stats)}
          ${this.renderGamesHistory(games, picks)}
        </div>
      `;

      this.attachEventListeners(container);

      // Listen for game updates from GameSync
      this.setupGameUpdateListener(container);

    } catch (error) {
      console.error('Error loading history page:', error);
      container.innerHTML = `
        <div class="history-page">
          <div class="error-message card">
            <h2>Error Loading History</h2>
            <p>${error.message || 'Failed to load history data'}</p>
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
      console.log('Games updated, refreshing history page...');
      // Re-render the page with updated data
      await this.render(container);
    };

    // Add listener
    window.addEventListener('games-updated', this.gameUpdateHandler);
  },

  /**
   * Render header
   */
  renderHeader() {
    return `
      <div class="history-header">
        <h1>Pick History</h1>
        <p class="history-subtitle">Review your past predictions and results</p>
      </div>
    `;
  },

  /**
   * Render week selector
   */
  renderWeekSelector() {
    return `
      <div class="history-controls card">
        <div class="week-selector">
          <div class="selector-group">
            <label for="history-week">Week:</label>
            <select id="history-week" class="form-input">
              ${this.state.availableWeeks.map(week => `
                <option value="${week.weekNumber}"
                        data-year="${week.year}"
                        ${week.weekNumber === this.state.selectedWeek && week.year === this.state.selectedYear ? 'selected' : ''}>
                  Week ${week.weekNumber} (${week.year})
                </option>
              `).join('')}
            </select>
          </div>
          <button id="load-week-btn" class="btn btn-secondary">
            Load Week
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Render week stats summary
   */
  renderWeekStats(stats) {
    return `
      <div class="week-stats-compact card">
        <span class="stat-item">
          <span class="stat-value" style="color: var(--success)">${stats.correct}</span>
          <span class="stat-label">Correct</span>
        </span>
        <span class="stat-item">
          <span class="stat-value" style="color: var(--error)">${stats.incorrect}</span>
          <span class="stat-label">Incorrect</span>
        </span>
        <span class="stat-item">
          <span class="stat-value" style="color: var(--text-secondary)">${stats.pending}</span>
          <span class="stat-label">Pending</span>
        </span>
        <span class="stat-item">
          <span class="stat-value" style="color: var(--primary)">${stats.percentage}%</span>
          <span class="stat-label">Rate</span>
        </span>
      </div>
    `;
  },

  /**
   * Render games history
   */
  renderGamesHistory(games, picks) {
    if (games.length === 0) {
      return `
        <div class="games-history-empty card">
          <p>No games found for this week.</p>
        </div>
      `;
    }

    const gameCards = games.map(game => {
      const userPick = picks.find(p => p.gameId === game.id);
      return this.renderGameHistoryCard(game, userPick);
    }).join('');

    return `
      <div class="games-history">
        <h2>Game Results</h2>
        <div class="games-list">
          ${gameCards}
        </div>
      </div>
    `;
  },

  /**
   * Render individual game history card
   */
  renderGameHistoryCard(game, userPick) {
    const isFinal = game.gameStatus === 'final' || game.gameStatus === 'status_final';
    const isInProgress = game.gameStatus === 'in_progress' || game.gameStatus === 'in';

    let resultClass = '';
    let resultIcon = '';

    if (userPick && isFinal) {
      if (userPick.isCorrect) {
        resultClass = 'correct';
        resultIcon = '✓';
      } else {
        resultClass = 'incorrect';
        resultIcon = '✗';
      }
    }

    const yourPickTeam = userPick
      ? userPick.predictedWinner === 'home'
        ? game.homeTeam
        : userPick.predictedWinner === 'away'
          ? game.awayTeam
          : 'Tie'
      : null;

    return `
      <div class="game-history-card card ${resultClass}">
        <div class="game-history-header">
          <div class="game-time">
            ${new Date(game.gameTime).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </div>
          <div class="game-status-badge ${isFinal ? 'final' : isInProgress ? 'in-progress' : 'scheduled'}">
            ${isFinal ? 'Final' : isInProgress ? 'Live' : 'Scheduled'}
          </div>
        </div>

        <div class="game-history-matchup">
          <div class="team ${userPick?.predictedWinner === 'away' ? 'picked' : ''}">
            <img src="${game.awayTeamLogo}" alt="${game.awayTeam}" class="team-logo-small">
            <div class="team-info">
              <div class="team-name">${game.awayTeam}</div>
              <div class="team-abbr">${game.awayTeamAbbr}</div>
            </div>
            <div class="team-score ${game.winner === 'away' ? 'winner' : ''}">
              ${game.awayScore !== null ? game.awayScore : '-'}
            </div>
          </div>

          <div class="vs-separator">@</div>

          <div class="team ${userPick?.predictedWinner === 'home' ? 'picked' : ''}">
            <img src="${game.homeTeamLogo}" alt="${game.homeTeam}" class="team-logo-small">
            <div class="team-info">
              <div class="team-name">${game.homeTeam}</div>
              <div class="team-abbr">${game.homeTeamAbbr}</div>
            </div>
            <div class="team-score ${game.winner === 'home' ? 'winner' : ''}">
              ${game.homeScore !== null ? game.homeScore : '-'}
            </div>
          </div>
        </div>

        <div class="game-history-footer">
          <div class="your-pick">
            ${userPick
              ? `
                <span class="pick-label">Your Pick:</span>
                <span class="pick-value">
                  ${yourPickTeam}
                  ${isFinal ? `<span class="result-icon ${resultClass}">${resultIcon}</span>` : ''}
                </span>
              `
              : '<span class="no-pick">No pick made</span>'}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Calculate week stats
   */
  calculateWeekStats(games, picks) {
    const finalGames = games.filter(g => g.gameStatus === 'final' || g.gameStatus === 'status_final');
    const correctPicks = picks.filter(p => p.isCorrect === true).length;
    const incorrectPicks = picks.filter(p => p.isCorrect === false).length;
    const pendingPicks = picks.filter(p => p.isCorrect === null).length;

    const totalFinal = finalGames.length;
    const percentage = totalFinal > 0
      ? Math.round((correctPicks / totalFinal) * 100)
      : 0;

    return {
      correct: correctPicks,
      incorrect: incorrectPicks,
      pending: pendingPicks,
      percentage
    };
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Load week button
    const loadWeekBtn = container.querySelector('#load-week-btn');
    if (loadWeekBtn) {
      loadWeekBtn.addEventListener('click', async () => {
        const weekSelect = container.querySelector('#history-week');
        const selectedOption = weekSelect.options[weekSelect.selectedIndex];

        this.state.selectedWeek = parseInt(selectedOption.value);
        this.state.selectedYear = parseInt(selectedOption.dataset.year);

        await this.render(container);
      });
    }

    // See all picks buttons
    const seeAllPicksBtns = container.querySelectorAll('.see-all-picks-btn');
    seeAllPicksBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const week = btn.dataset.week;
        const year = btn.dataset.year;

        // Navigate to comparison page for this week
        window.location.hash = `#stats?week=${week}&year=${year}&leagueId=${this.state.leagueId}`;
      });
    });
  }
};

// Make globally available
window.HistoryPage = HistoryPage;

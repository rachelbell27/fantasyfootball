/**
 * Unified Picks/History Page
 *
 * Combined picks and history page with week selector
 * - Current week: Make picks
 * - Past weeks: View history and stats
 */

const PicksUnifiedPage = {
  state: {
    selectedWeek: null,
    selectedYear: null,
    selectedWeekType: null,
    currentWeek: null,
    currentYear: null,
    currentWeekType: null,
    leagueId: 1,
    games: [],
    picks: {},
    existingPicks: [],
    availableWeeks: [],
    isCurrentWeek: false,
    locked: false
  },

  /**
   * Render the unified picks/history page
   */
  async render(container) {
    if (!container) {
      console.error('Container not found');
      return;
    }

    try {
      // Fetch current week and available weeks
      const [weekResponse, weeksResponse] = await Promise.all([
        API.games.getCurrentWeek(),
        API.games.getWeeks()
      ]);

      this.state.currentWeek = weekResponse.data.weekNumber;
      this.state.currentYear = weekResponse.data.year;
      this.state.currentWeekType = weekResponse.data.weekType;
      this.state.availableWeeks = weeksResponse.data;

      // Set selected week based on route
      if (!this.state.selectedWeek) {
        const hash = window.location.hash.slice(1);

        // If coming from #history route, select most recent past week
        if (hash === 'history') {
          const pastWeeks = this.state.availableWeeks.filter(week => {
            if (week.year < this.state.currentYear) return true;
            if (week.year === this.state.currentYear) {
              if (week.weekType === this.state.currentWeekType) {
                return week.weekNumber < this.state.currentWeek;
              }
              // For week type ordering, regular < wildcard < divisional < conference < superbowl
              const typeOrder = { regular: 0, wildcard: 1, divisional: 2, conference: 3, superbowl: 4 };
              return typeOrder[week.weekType] < typeOrder[this.state.currentWeekType];
            }
            return false;
          });

          if (pastWeeks.length > 0) {
            const mostRecentPastWeek = pastWeeks[pastWeeks.length - 1];
            this.state.selectedWeek = mostRecentPastWeek.weekNumber;
            this.state.selectedYear = mostRecentPastWeek.year;
            this.state.selectedWeekType = mostRecentPastWeek.weekType;
          } else {
            // No past weeks, show current week
            this.state.selectedWeek = this.state.currentWeek;
            this.state.selectedYear = this.state.currentYear;
            this.state.selectedWeekType = this.state.currentWeekType;
          }
        } else {
          // Default to current week for #picks route
          this.state.selectedWeek = this.state.currentWeek;
          this.state.selectedYear = this.state.currentYear;
          this.state.selectedWeekType = this.state.currentWeekType;
        }
      }

      // Check if viewing current week
      this.state.isCurrentWeek = (
        this.state.selectedWeek === this.state.currentWeek &&
        this.state.selectedYear === this.state.currentYear &&
        this.state.selectedWeekType === this.state.currentWeekType
      );

      // Fetch games and existing picks
      const [gamesResponse, picksResponse] = await Promise.all([
        API.games.getGames(this.state.selectedWeek, this.state.selectedYear, this.state.selectedWeekType),
        API.picks.get(this.state.selectedWeek, this.state.selectedYear, this.state.leagueId, this.state.selectedWeekType)
      ]);

      this.state.games = gamesResponse.data;
      this.state.existingPicks = picksResponse.data;

      // Initialize picks object with existing picks
      this.state.picks = {};
      this.state.existingPicks.forEach(pick => {
        this.state.picks[pick.gameId] = pick.predictedWinner;
      });

      // Check if locked (all games started)
      const now = new Date();
      const allGamesStarted = this.state.games.every(game => {
        const gameTime = new Date(game.gameTime);
        return gameTime < now;
      });
      this.state.locked = allGamesStarted;

      // Calculate stats if viewing history
      const stats = this.state.isCurrentWeek ? null : this.calculateWeekStats();

      container.innerHTML = `
        <div class="picks-unified-page">
          ${this.renderHeader()}
          ${this.renderWeekSelector()}
          ${!this.state.isCurrentWeek ? this.renderWeekStats(stats) : ''}
          ${this.state.isCurrentWeek && !this.state.locked ? this.renderSubmitSection() : ''}
          ${this.renderGamesList()}
        </div>
      `;

      this.attachEventListeners(container);
      this.setupGameUpdateListener(container);

    } catch (error) {
      console.error('Error loading picks/history page:', error);
      container.innerHTML = `
        <div class="picks-unified-page">
          <div class="error-message card">
            <h2>Error Loading Page</h2>
            <p>${error.message || 'Failed to load data'}</p>
          </div>
        </div>
      `;
    }
  },

  /**
   * Setup listener for automatic game updates
   */
  setupGameUpdateListener(container) {
    if (this.gameUpdateHandler) {
      window.removeEventListener('games-updated', this.gameUpdateHandler);
    }

    this.gameUpdateHandler = async (event) => {
      console.log('Games updated, refreshing page...');
      await this.render(container);
    };

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
   * Render header with week selector inline
   */
  renderHeader() {
    console.log('[PicksUnified] renderHeader - availableWeeks:', this.state.availableWeeks);
    console.log('[PicksUnified] renderHeader - selected:', {
      week: this.state.selectedWeek,
      year: this.state.selectedYear,
      weekType: this.state.selectedWeekType
    });

    // For header title - show week number only for regular season
    const headerTitle = this.state.selectedWeekType === 'regular'
      ? `Week ${this.state.selectedWeek}`
      : this.getWeekDisplayName(this.state.selectedWeekType);

    return `
      <div class="picks-header-unified">
        <div class="header-content">
          <div class="header-left">
            <h1>${headerTitle}</h1>
            ${this.state.isCurrentWeek && !this.state.locked
              ? `<p class="picks-subtitle">Make your predictions for ${this.state.games.length} games</p>`
              : this.state.locked && this.state.isCurrentWeek
              ? `<p class="picks-subtitle">All games have started - picks are locked</p>`
              : `<p class="picks-subtitle">Review your picks and results</p>`
            }
          </div>
          <div class="header-right">
            <div class="week-selector-inline">
              <select id="week-select" class="form-input">
                ${this.state.availableWeeks.map((week, index) => {
                  const isSelected = (
                    week.weekNumber === this.state.selectedWeek &&
                    week.year === this.state.selectedYear &&
                    week.weekType === this.state.selectedWeekType
                  );

                  // Display label for dropdown
                  let displayLabel;
                  if (week.weekType === 'regular') {
                    displayLabel = `Week ${week.weekNumber} (Regular Season) (${week.year})`;
                  } else {
                    displayLabel = `${this.getWeekDisplayName(week.weekType)} (${week.year})`;
                  }

                  console.log('[PicksUnified] Dropdown option:', { week, index, displayLabel, isSelected });

                  return `
                    <option value="${index}"
                            data-week-number="${week.weekNumber}"
                            data-year="${week.year}"
                            data-week-type="${week.weekType}"
                            ${isSelected ? 'selected' : ''}>
                      ${displayLabel}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render week selector (hidden, kept for compatibility)
   */
  renderWeekSelector() {
    return '';
  },

  /**
   * Render submit section for current week
   */
  renderSubmitSection() {
    const picksCount = Object.keys(this.state.picks).length;
    const totalGames = this.state.games.length;
    const now = new Date();

    const incomplete = this.state.games.filter(g => {
      const gameTime = new Date(g.gameTime);
      const isScheduled = gameTime > now;
      return isScheduled && !this.state.picks[g.id];
    }).length;

    return `
      <div class="picks-submit-section card">
        <button id="submit-picks-btn" class="btn btn-primary btn-lg">
          Submit All Picks (${picksCount}/${totalGames})
        </button>
        ${incomplete > 0 ? `
          <p class="incomplete-notice">
            ${incomplete} pick${incomplete !== 1 ? 's' : ''} remaining
          </p>
        ` : ''}
      </div>
    `;
  },

  /**
   * Render week stats for history view
   */
  renderWeekStats(stats) {
    if (!stats) return '';

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
   * Render games list
   */
  renderGamesList() {
    if (this.state.games.length === 0) {
      return `
        <div class="games-empty card">
          <p>No games found for this week.</p>
        </div>
      `;
    }

    const now = new Date();
    const gameCards = this.state.games.map(game => {
      const userPick = this.state.existingPicks.find(p => p.gameId === game.id);
      const gameTime = new Date(game.gameTime);
      const gameHasStarted = gameTime < now;
      const canEdit = this.state.isCurrentWeek && !gameHasStarted;

      return this.renderGameCard(game, userPick, canEdit);
    }).join('');

    return `
      <div class="games-list">
        ${gameCards}
      </div>
    `;
  },

  /**
   * Render individual game card
   */
  renderGameCard(game, userPick, canEdit) {
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
      <div class="game-history-card card ${resultClass} ${canEdit ? '' : 'locked'}" data-game-id="${game.id}">
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
          <div class="team ${userPick?.predictedWinner === 'away' ? 'picked' : ''} ${canEdit ? 'clickable' : ''}"
               data-team="away"
               data-game-id="${game.id}"
               ${canEdit ? 'role="button" tabindex="0"' : ''}>
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

          <div class="team ${userPick?.predictedWinner === 'home' ? 'picked' : ''} ${canEdit ? 'clickable' : ''}"
               data-team="home"
               data-game-id="${game.id}"
               ${canEdit ? 'role="button" tabindex="0"' : ''}>
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
          ${canEdit ? `
            <button class="btn-text tie-btn" data-team="tie" data-game-id="${game.id}">
              ${userPick?.predictedWinner === 'tie' ? '✓ Tie' : 'Tie'}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Calculate week stats
   */
  calculateWeekStats() {
    const finalGames = this.state.games.filter(g => g.gameStatus === 'final' || g.gameStatus === 'status_final');
    const correctPicks = this.state.existingPicks.filter(p => p.isCorrect === true).length;
    const incorrectPicks = this.state.existingPicks.filter(p => p.isCorrect === false).length;
    const pendingPicks = this.state.existingPicks.filter(p => p.isCorrect === null).length;

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
    // Week selector
    const weekSelect = container.querySelector('#week-select');
    if (weekSelect) {
      weekSelect.addEventListener('change', async () => {
        const selectedOption = weekSelect.options[weekSelect.selectedIndex];
        this.state.selectedWeek = parseInt(selectedOption.dataset.weekNumber);
        this.state.selectedYear = parseInt(selectedOption.dataset.year);
        this.state.selectedWeekType = selectedOption.dataset.weekType;
        await this.render(container);
      });
    }

    // Team selection (only if current week and not locked)
    const teams = container.querySelectorAll('.team[role="button"]');
    teams.forEach(team => {
      team.addEventListener('click', () => {
        const gameId = parseInt(team.dataset.gameId);
        const teamSelection = team.dataset.team;
        this.state.picks[gameId] = teamSelection;
        this.updatePickSelection(container, gameId, teamSelection);
        this.updatePicksCount(container);
      });

      team.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          team.click();
        }
      });
    });

    // Tie buttons
    const tieBtns = container.querySelectorAll('.tie-btn');
    tieBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = parseInt(btn.dataset.gameId);
        this.state.picks[gameId] = 'tie';
        this.updatePickSelection(container, gameId, 'tie');
        this.updatePicksCount(container);
      });
    });

    // Submit button
    const submitBtn = container.querySelector('#submit-picks-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitPicks(container));
    }
  },

  /**
   * Update pick selection in UI
   */
  updatePickSelection(container, gameId, selection) {
    const card = container.querySelector(`.game-history-card[data-game-id="${gameId}"]`);
    if (!card) return;

    card.querySelectorAll('.team').forEach(team => {
      team.classList.remove('picked');
    });

    if (selection === 'away' || selection === 'home') {
      const selectedTeam = card.querySelector(`.team[data-team="${selection}"]`);
      if (selectedTeam) {
        selectedTeam.classList.add('picked');
      }
    }

    const tieBtn = card.querySelector('.tie-btn');
    if (tieBtn) {
      tieBtn.textContent = selection === 'tie' ? '✓ Tie' : 'Tie';
    }

    const yourPick = card.querySelector('.your-pick');
    if (yourPick) {
      const game = this.state.games.find(g => g.id === gameId);
      let pickTeam = '';
      if (selection === 'home') {
        pickTeam = game.homeTeam;
      } else if (selection === 'away') {
        pickTeam = game.awayTeam;
      } else {
        pickTeam = 'Tie';
      }

      yourPick.innerHTML = `
        <span class="pick-label">Your Pick:</span>
        <span class="pick-value">${pickTeam}</span>
      `;
    }
  },

  /**
   * Update picks count in UI
   */
  updatePicksCount(container) {
    const submitBtn = container.querySelector('#submit-picks-btn');
    const count = Object.keys(this.state.picks).length;
    const total = this.state.games.length;

    if (submitBtn) {
      submitBtn.textContent = `Submit All Picks (${count}/${total})`;
    }
  },

  /**
   * Submit picks
   */
  async submitPicks(container) {
    const picksArray = Object.entries(this.state.picks).map(([gameId, predictedWinner]) => ({
      gameId: parseInt(gameId),
      predictedWinner,
      leagueId: this.state.leagueId
    }));

    if (picksArray.length === 0) {
      UI.showToast('No picks to submit', 'warning');
      return;
    }

    try {
      UI.showLoading();
      const response = await API.picks.submit(picksArray);

      if (response.data.submitted > 0) {
        UI.showToast(`${response.data.submitted} pick(s) submitted successfully!`, 'success');
      } else {
        UI.showToast('No picks could be submitted.', 'warning');
      }

      await this.render(container);
      UI.hideLoading();
    } catch (error) {
      console.error('Error submitting picks:', error);
      UI.showToast(error.message || 'Failed to submit picks', 'error');
      UI.hideLoading();
    }
  }
};

// Make globally available
window.PicksUnifiedPage = PicksUnifiedPage;

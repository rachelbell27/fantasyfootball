/**
 * Picks Page
 *
 * Make and submit weekly picks
 */

const PicksPage = {
  state: {
    currentWeek: null,
    currentYear: null,
    leagueId: 1,
    games: [],
    picks: {},
    existingPicks: [],
    locked: false
  },

  /**
   * Render the picks page
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

      // Fetch games and existing picks
      const [gamesResponse, picksResponse] = await Promise.all([
        API.games.getGames(this.state.currentWeek, this.state.currentYear),
        API.picks.get(this.state.currentWeek, this.state.currentYear, this.state.leagueId)
      ]);

      this.state.games = gamesResponse.data;
      this.state.existingPicks = picksResponse.data;

      // Initialize picks object with existing picks
      this.state.picks = {};
      this.state.existingPicks.forEach(pick => {
        this.state.picks[pick.gameId] = pick.predictedWinner;
      });

      // Check if ALL games have started (for showing submit button)
      const now = new Date();
      const allGamesStarted = this.state.games.every(game => {
        const gameTime = new Date(game.gameTime);
        return gameTime < now;
      });
      this.state.locked = allGamesStarted;

      container.innerHTML = `
        <div class="picks-page">
          ${this.renderHeader()}
          ${this.renderPicksForm()}
        </div>
      `;

      this.attachEventListeners(container);

      // Listen for game updates from GameSync
      this.setupGameUpdateListener(container);

    } catch (error) {
      console.error('Error loading picks page:', error);
      container.innerHTML = `
        <div class="picks-page">
          <div class="error-message card">
            <h2>Error Loading Picks</h2>
            <p>${error.message || 'Failed to load picks page'}</p>
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
      console.log('Games updated, refreshing picks page...');
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
    const picksCount = Object.keys(this.state.picks).length;
    const totalGames = this.state.games.length;
    const now = new Date();

    // Count games that haven't started yet and don't have picks
    const incomplete = this.state.games.filter(g => {
      const gameTime = new Date(g.gameTime);
      const isScheduled = gameTime > now;
      return isScheduled && !this.state.picks[g.id];
    }).length;

    return `
      <div class="picks-header">
        <h1>Week ${this.state.currentWeek} Picks</h1>
        <p class="picks-subtitle">
          ${this.state.locked
            ? 'All games have started - picks are locked'
            : `Make your predictions for ${this.state.games.length} games`
          }
        </p>
      </div>

      ${!this.state.locked ? `
        <div class="picks-submit-top">
          <button id="submit-picks-btn" class="btn btn-primary btn-lg">
            Submit All Picks (${picksCount}/${totalGames})
          </button>
          ${incomplete > 0 ? `
            <p class="incomplete-notice">
              ${incomplete} pick${incomplete !== 1 ? 's' : ''} remaining
            </p>
          ` : ''}
        </div>
      ` : ''}
    `;
  },

  /**
   * Render picks form
   */
  renderPicksForm() {
    const now = new Date();
    const gameCards = this.state.games.map(game => {
      const userPick = this.state.existingPicks.find(p => p.gameId === game.id);
      // Each game locks individually when it starts
      const gameTime = new Date(game.gameTime);
      const gameHasStarted = gameTime < now;

      return this.renderGamePickCard(game, userPick, gameHasStarted);
    }).join('');

    return `
      <div class="picks-form">
        <div class="games-list">
          ${gameCards}
        </div>
      </div>
    `;
  },

  /**
   * Render individual game pick card (history-style layout)
   */
  renderGamePickCard(game, userPick, isLocked) {
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
      <div class="game-history-card card ${resultClass} ${isLocked ? 'locked' : ''}" data-game-id="${game.id}">
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
          <div class="team ${userPick?.predictedWinner === 'away' ? 'picked' : ''} ${!isLocked ? 'clickable' : ''}"
               data-team="away"
               data-game-id="${game.id}"
               ${!isLocked ? 'role="button" tabindex="0"' : ''}>
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

          <div class="team ${userPick?.predictedWinner === 'home' ? 'picked' : ''} ${!isLocked ? 'clickable' : ''}"
               data-team="home"
               data-game-id="${game.id}"
               ${!isLocked ? 'role="button" tabindex="0"' : ''}>
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
          ${!isLocked ? `
            <button class="btn-text tie-btn" data-team="tie" data-game-id="${game.id}">
              ${userPick?.predictedWinner === 'tie' ? '✓ Tie' : 'Tie'}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Attach team selection listeners
    const teams = container.querySelectorAll('.team[role="button"]');
    teams.forEach(team => {
      team.addEventListener('click', () => {
        const gameId = parseInt(team.dataset.gameId);
        const teamSelection = team.dataset.team;

        this.state.picks[gameId] = teamSelection;
        this.updatePickSelection(container, gameId, teamSelection);
        this.updatePicksCount(container);
      });

      // Keyboard support
      team.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          team.click();
        }
      });
    });

    // Tie button listeners
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

    // Remove all 'picked' classes from teams in this card
    card.querySelectorAll('.team').forEach(team => {
      team.classList.remove('picked');
    });

    // Add 'picked' class to selected team
    if (selection === 'away' || selection === 'home') {
      const selectedTeam = card.querySelector(`.team[data-team="${selection}"]`);
      if (selectedTeam) {
        selectedTeam.classList.add('picked');
      }
    }

    // Update tie button
    const tieBtn = card.querySelector('.tie-btn');
    if (tieBtn) {
      if (selection === 'tie') {
        tieBtn.textContent = '✓ Tie';
      } else {
        tieBtn.textContent = 'Tie';
      }
    }

    // Update footer pick display
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

    console.log('Submitting picks:', picksArray);

    if (picksArray.length === 0) {
      UI.showToast('No picks to submit', 'warning');
      return;
    }

    try {
      UI.showLoading();
      const response = await API.picks.submit(picksArray);
      console.log('Submit response:', response);

      if (response.data.skipped && response.data.skipped.length > 0) {
        console.log('Skipped picks:', response.data.skipped);
      }

      if (response.data.submitted > 0) {
        UI.showToast(`${response.data.submitted} pick(s) submitted successfully!`, 'success');
      } else {
        UI.showToast('No picks could be submitted. Check console for details.', 'warning');
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
window.PicksPage = PicksPage;

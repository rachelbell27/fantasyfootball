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

      // Check if picks are locked (first game started)
      const now = new Date();
      const firstGame = this.state.games.sort((a, b) =>
        new Date(a.gameTime) - new Date(b.gameTime)
      )[0];
      this.state.locked = firstGame && new Date(firstGame.gameTime) < now;

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
    const incomplete = this.state.games.filter(g =>
      g.gameStatus === 'scheduled' && !this.state.picks[g.id]
    ).length;

    return `
      <div class="picks-header">
        <h1>Week ${this.state.currentWeek} Picks</h1>
        <p class="picks-subtitle">
          ${this.state.locked
            ? 'Picks are locked - games have started'
            : `Make your predictions for ${this.state.games.length} games`
          }
        </p>
      </div>

      ${incomplete > 0 && !this.state.locked ? `
        <div class="incomplete-banner">
          <div class="banner-text">
            <strong>${incomplete} picks remaining</strong>
            <span>Complete all picks before the first game starts</span>
          </div>
          <button id="submit-picks-btn" class="btn btn-primary">
            Submit Picks (${Object.keys(this.state.picks).length}/${this.state.games.length})
          </button>
        </div>
      ` : ''}
    `;
  },

  /**
   * Render picks form
   */
  renderPicksForm() {
    const gameCards = this.state.games.map(game => {
      const userPick = this.state.existingPicks.find(p => p.gameId === game.id);
      return GameCard.render(
        game,
        userPick,
        this.state.locked,
        this.state.currentWeek,
        this.state.currentYear,
        this.state.leagueId
      );
    }).join('');

    return `
      <div class="picks-form">
        <div class="games-grid">
          ${gameCards}
        </div>
        ${!this.state.locked ? `
          <div class="picks-actions">
            <button id="submit-picks-btn-bottom" class="btn btn-primary btn-lg">
              Submit All Picks
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Attach game card listeners
    GameCard.attachEventListeners(container, (gameId, teamSelection) => {
      this.state.picks[gameId] = teamSelection;
      this.updatePicksCount(container);
    });

    // Submit buttons
    const submitBtns = container.querySelectorAll('#submit-picks-btn, #submit-picks-btn-bottom');
    submitBtns.forEach(btn => {
      btn.addEventListener('click', () => this.submitPicks(container));
    });
  },

  /**
   * Update picks count in UI
   */
  updatePicksCount(container) {
    const submitBtns = container.querySelectorAll('#submit-picks-btn, #submit-picks-btn-bottom');
    const count = Object.keys(this.state.picks).length;
    const total = this.state.games.length;

    submitBtns.forEach(btn => {
      btn.textContent = `Submit Picks (${count}/${total})`;
    });
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
      await API.picks.submit(picksArray);
      UI.showToast('Picks submitted successfully!', 'success');
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

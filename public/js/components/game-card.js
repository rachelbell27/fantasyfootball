/**
 * GameCard Component
 *
 * Reusable component for displaying individual game cards with pick selection
 */

const GameCard = {
  /**
   * Render a game card
   * @param {Object} game - Game data
   * @param {Object} userPick - User's pick for this game (if exists)
   * @param {Boolean} locked - Whether picks are locked
   * @param {Number} week - Week number
   * @param {Number} year - Year
   * @param {Number} leagueId - League ID
   */
  render(game, userPick = null, locked = false, week = null, year = null, leagueId = 1) {
    const isFinal = game.gameStatus === 'final' || game.gameStatus === 'status_final';
    const isInProgress = game.gameStatus === 'in_progress' || game.gameStatus === 'in';
    const isPending = game.gameStatus === 'scheduled' || game.gameStatus === 'pre';

    // Determine if card should be locked
    const isLocked = locked || isFinal || isInProgress;

    return `
      <div class="game-card ${isLocked ? 'locked' : ''}" data-game-id="${game.id}">
        ${this.renderHeader(game)}
        ${this.renderMatchup(game, userPick, isLocked)}
        ${this.renderFooter(game, userPick)}
      </div>
    `;
  },

  /**
   * Render game card header
   */
  renderHeader(game) {
    const gameTime = new Date(game.gameTime);
    const formattedTime = gameTime.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const isFinal = game.gameStatus === 'final' || game.gameStatus === 'status_final';
    const isInProgress = game.gameStatus === 'in_progress' || game.gameStatus === 'in';

    let statusBadge = '';
    if (isFinal) {
      statusBadge = '<span class="game-status-badge final">Final</span>';
    } else if (isInProgress) {
      statusBadge = '<span class="game-status-badge in-progress">Live</span>';
    } else {
      statusBadge = `<span class="game-status-badge scheduled">${formattedTime}</span>`;
    }

    return `
      <div class="game-card-header">
        <div class="game-info">
          <div class="game-week">Week ${game.weekNumber}</div>
          ${statusBadge}
        </div>
      </div>
    `;
  },

  /**
   * Render matchup section
   */
  renderMatchup(game, userPick, isLocked) {
    const awaySelected = userPick?.predictedWinner === 'away';
    const homeSelected = userPick?.predictedWinner === 'home';
    const tieSelected = userPick?.predictedWinner === 'tie';

    const isFinal = game.gameStatus === 'final' || game.gameStatus === 'status_final';

    return `
      <div class="game-matchup">
        <!-- Away Team -->
        <div class="game-team ${awaySelected ? 'selected' : ''} ${game.winner === 'away' ? 'winner' : ''}"
             data-team="away"
             data-game-id="${game.id}"
             ${!isLocked ? 'role="button" tabindex="0"' : ''}>
          <img src="${game.awayTeamLogo}" alt="${game.awayTeam}" class="game-team-logo">
          <div class="game-team-info">
            <div class="game-team-name">${game.awayTeam}</div>
            <div class="game-team-abbr">${game.awayTeamAbbr}</div>
          </div>
          ${isFinal ? `<div class="game-team-score">${game.awayScore}</div>` : ''}
          ${awaySelected ? '<div class="pick-indicator">✓</div>' : ''}
        </div>

        <!-- VS Separator -->
        <div class="game-vs">
          <div class="vs-text">@</div>
          ${!isLocked && game.gameStatus === 'scheduled' ? `
            <button class="btn-text tie-btn" data-team="tie" data-game-id="${game.id}">
              ${tieSelected ? '✓ Tie' : 'Tie'}
            </button>
          ` : ''}
        </div>

        <!-- Home Team -->
        <div class="game-team ${homeSelected ? 'selected' : ''} ${game.winner === 'home' ? 'winner' : ''}"
             data-team="home"
             data-game-id="${game.id}"
             ${!isLocked ? 'role="button" tabindex="0"' : ''}>
          <img src="${game.homeTeamLogo}" alt="${game.homeTeam}" class="game-team-logo">
          <div class="game-team-info">
            <div class="game-team-name">${game.homeTeam}</div>
            <div class="game-team-abbr">${game.homeTeamAbbr}</div>
          </div>
          ${isFinal ? `<div class="game-team-score">${game.homeScore}</div>` : ''}
          ${homeSelected ? '<div class="pick-indicator">✓</div>' : ''}
        </div>
      </div>
    `;
  },

  /**
   * Render footer with actions
   */
  renderFooter(game, userPick) {
    const isFinal = game.gameStatus === 'final' || game.gameStatus === 'status_final';

    let pickResult = '';
    if (userPick && isFinal) {
      if (userPick.isCorrect) {
        pickResult = '<span class="pick-result correct">✓ Correct</span>';
      } else {
        pickResult = '<span class="pick-result incorrect">✗ Incorrect</span>';
      }
    } else if (userPick) {
      pickResult = '<span class="pick-result pending">Pick made</span>';
    } else {
      pickResult = '<span class="pick-result no-pick">No pick yet</span>';
    }

    return `
      <div class="game-card-footer">
        <div class="pick-status">
          ${pickResult}
        </div>
      </div>
    `;
  },

  /**
   * Attach event listeners to game cards
   * @param {HTMLElement} container - Container with game cards
   * @param {Function} onPickChange - Callback when pick changes
   */
  attachEventListeners(container, onPickChange) {
    // Team selection
    const teams = container.querySelectorAll('.game-team[role="button"]');
    teams.forEach(team => {
      team.addEventListener('click', () => {
        const gameId = parseInt(team.dataset.gameId);
        const teamSelection = team.dataset.team;

        if (onPickChange) {
          onPickChange(gameId, teamSelection);
        }

        // Update UI
        this.updateCardSelection(team.closest('.game-card'), teamSelection);
      });

      // Keyboard support
      team.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          team.click();
        }
      });
    });

    // Tie button
    const tieBtns = container.querySelectorAll('.tie-btn');
    tieBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = parseInt(btn.dataset.gameId);
        const teamSelection = 'tie';

        if (onPickChange) {
          onPickChange(gameId, teamSelection);
        }

        // Update UI
        this.updateCardSelection(btn.closest('.game-card'), teamSelection);
      });
    });
  },

  /**
   * Update card selection UI
   */
  updateCardSelection(card, selection) {
    // Remove all selected classes
    card.querySelectorAll('.game-team').forEach(team => {
      team.classList.remove('selected');
    });

    // Remove tie selection
    const tieBtn = card.querySelector('.tie-btn');
    if (tieBtn) {
      tieBtn.textContent = 'Tie';
    }

    // Add selected class to chosen team
    if (selection === 'away' || selection === 'home') {
      const selectedTeam = card.querySelector(`.game-team[data-team="${selection}"]`);
      if (selectedTeam) {
        selectedTeam.classList.add('selected');
      }
    } else if (selection === 'tie' && tieBtn) {
      tieBtn.textContent = '✓ Tie';
    }

    // Update pick status
    const pickStatus = card.querySelector('.pick-status');
    if (pickStatus) {
      pickStatus.innerHTML = '<span class="pick-result pending">Pick made</span>';
    }
  }
};

// Make globally available
window.GameCard = GameCard;

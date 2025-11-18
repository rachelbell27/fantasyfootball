/**
 * ComparisonView Component
 *
 * Displays a detailed comparison of picks between the logged-in user
 * and other league members for a specific week.
 */

const ComparisonView = {
  state: {
    data: null,
    expandedUsers: new Set(),
    sortBy: 'agreement', // agreement, record, rank, disagreement
    filter: 'all' // all, beat, lost-to, high-agreement, low-agreement, top5
  },

  /**
   * Render the comparison view
   * @param {HTMLElement} container - Container to render into
   * @param {Object} data - Comparison data from API
   */
  async render(container, data) {
    if (!container) {
      console.error('[ComparisonView] Container is null');
      return;
    }

    if (!data) {
      console.error('[ComparisonView] Data is null');
      container.innerHTML = `
        <div class="comparison-error card">
          <p>No comparison data available</p>
        </div>
      `;
      return;
    }

    this.state.data = data;

    container.innerHTML = `
      <div class="comparison-view">
        ${this.renderHeader()}
        ${this.renderOverview()}
        ${this.renderFilters()}
        ${this.renderUserComparisons()}
      </div>
    `;

    this.attachEventListeners(container);
  },

  /**
   * Render header section
   */
  renderHeader() {
    const { week, year } = this.state.data;
    return `
      <div class="comparison-header">
        <h1>Week ${week} Pick Comparison</h1>
        <p class="comparison-subtitle">
          ${year} Season • See how your picks stack up against the league
        </p>
      </div>
    `;
  },

  /**
   * Render overview stats section
   */
  renderOverview() {
    const { yourPicks, insights } = this.state.data;
    const { correct, total } = yourPicks.record;
    const percentage = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;

    const mostAgreed = insights.mostAgreedWith;
    const mostContra = insights.mostContrarian;
    const boldest = insights.boldestCall;

    return `
      <div class="comparison-overview card">
        <h2>Your Week ${this.state.data.week} Performance</h2>
        <div class="overview-stats">
          <div class="overview-stat">
            <div class="stat-value">${correct}/${total}</div>
            <div class="stat-label">Correct</div>
          </div>
          <div class="overview-stat">
            <div class="stat-value">${percentage}%</div>
            <div class="stat-label">Success Rate</div>
          </div>
          <div class="overview-stat">
            <div class="stat-value">#${yourPicks.rank}</div>
            <div class="stat-label">Rank</div>
          </div>
          <div class="overview-stat">
            <div class="stat-value">${yourPicks.totalUsers}</div>
            <div class="stat-label">Total Users</div>
          </div>
        </div>

        ${mostAgreed || mostContra || boldest ? `
          <div class="overview-insights">
            <h3>Key Insights</h3>
            ${mostAgreed ? `
              <div class="insight-item">
                <span class="insight-icon">🤝</span>
                <span class="insight-text">
                  Most agreed with: <strong>${mostAgreed.name}</strong>
                  (${mostAgreed.games}/${this.state.data.comparisons.find(c => c.userId === mostAgreed.userId)?.comparableGames || mostAgreed.games} games, ${mostAgreed.rate}%)
                </span>
              </div>
            ` : ''}
            ${mostContra ? `
              <div class="insight-item">
                <span class="insight-icon">⚡</span>
                <span class="insight-text">
                  Most contrarian: <strong>${mostContra.name}</strong>
                  (${mostContra.games} disagreements, ${mostContra.rate}% agreement)
                </span>
              </div>
            ` : ''}
            ${boldest ? `
              <div class="insight-item">
                <span class="insight-icon">🎯</span>
                <span class="insight-text">
                  Boldest call: <strong>${boldest.yourPick}</strong> in ${boldest.game}
                  (only ${boldest.consensusPercent}% picked this, you won!)
                </span>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Render filter and sort controls
   */
  renderFilters() {
    return `
      <div class="comparison-filters">
        <div class="filter-group">
          <label for="comparison-filter">Filter:</label>
          <select id="comparison-filter" class="form-input">
            <option value="all">All Users</option>
            <option value="beat">Users You Beat</option>
            <option value="lost-to">Users Who Beat You</option>
            <option value="high-agreement">High Agreement (&gt;70%)</option>
            <option value="low-agreement">Low Agreement (&lt;30%)</option>
            <option value="top5">Top 5 Users</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="comparison-sort">Sort by:</label>
          <select id="comparison-sort" class="form-input">
            <option value="agreement">Agreement Rate</option>
            <option value="record">Their Record</option>
            <option value="rank">Leaderboard Position</option>
            <option value="disagreement">Disagreement Rate</option>
          </select>
        </div>
      </div>
    `;
  },

  /**
   * Render user comparison cards
   */
  renderUserComparisons() {
    let comparisons = [...this.state.data.comparisons];
    const yourRecord = this.state.data.yourPicks.record;

    // Apply filter
    switch (this.state.filter) {
      case 'beat':
        comparisons = comparisons.filter(c =>
          yourRecord.correct > c.record.correct
        );
        break;
      case 'lost-to':
        comparisons = comparisons.filter(c =>
          yourRecord.correct < c.record.correct
        );
        break;
      case 'high-agreement':
        comparisons = comparisons.filter(c => c.agreementRate > 70);
        break;
      case 'low-agreement':
        comparisons = comparisons.filter(c => c.agreementRate < 30);
        break;
      case 'top5':
        comparisons = comparisons.filter(c => c.rank <= 5);
        break;
    }

    // Apply sort
    switch (this.state.sortBy) {
      case 'agreement':
        comparisons.sort((a, b) => b.agreementRate - a.agreementRate);
        break;
      case 'record':
        comparisons.sort((a, b) => {
          const aRate = (a.record.correct / a.record.total) * 100;
          const bRate = (b.record.correct / b.record.total) * 100;
          return bRate - aRate;
        });
        break;
      case 'rank':
        comparisons.sort((a, b) => a.rank - b.rank);
        break;
      case 'disagreement':
        comparisons.sort((a, b) => a.agreementRate - b.agreementRate);
        break;
    }

    if (comparisons.length === 0) {
      return `
        <div class="comparison-empty card">
          <p>No users match the current filter.</p>
        </div>
      `;
    }

    return `
      <div class="user-comparisons">
        ${comparisons.map(comp => this.renderUserCard(comp)).join('')}
      </div>
    `;
  },

  /**
   * Render individual user comparison card
   */
  renderUserCard(comparison) {
    const {
      userId,
      displayName,
      primaryColor,
      record,
      rank,
      agreementRate,
      agreedGames,
      comparableGames,
      jointSuccessRate,
      youCorrectWhenDisagreed,
      themCorrectWhenDisagreed
    } = comparison;

    const successRate = record.total > 0
      ? ((record.correct / record.total) * 100).toFixed(1)
      : 0;

    const isExpanded = this.state.expandedUsers.has(userId);
    const yourRecord = this.state.data.yourPicks.record;
    const pointDifference = yourRecord.correct - record.correct;

    // Get agreement badge
    const badge = this.getAgreementBadge(agreementRate);

    // Generate agreement dots
    const agreementDots = this.generateAgreementDots(comparison);

    return `
      <div class="user-comparison-card card"
           data-user-id="${userId}"
           style="--user-color: ${primaryColor || '#8AB4F8'}">
        <div class="comparison-card-header">
          <div class="user-info">
            <div class="user-avatar" style="${Colors.getAvatarStyle(primaryColor || '#8AB4F8')}">
              ${displayName.charAt(0).toUpperCase()}
            </div>
            <div class="user-details">
              <h3 class="user-name">${displayName}</h3>
              <div class="user-agreement">
                ${agreementDots}
                <span class="agreement-rate ${badge.class}">
                  ${agreedGames}/${comparableGames} Agreement (${agreementRate}%)
                </span>
                <span class="agreement-badge">${badge.emoji} ${badge.label}</span>
              </div>
            </div>
          </div>
          <button class="btn-icon expand-btn" data-user-id="${userId}" title="View Details">
            <span class="expand-icon">${isExpanded ? '▲' : '▼'}</span>
          </button>
        </div>

        <div class="comparison-card-stats">
          <div class="stat-item">
            <span class="stat-label">Their Record</span>
            <span class="stat-value">${record.correct}/${record.total} (${successRate}%)</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rank</span>
            <span class="stat-value">#${rank}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Head-to-Head</span>
            <span class="stat-value ${pointDifference > 0 ? 'winning' : pointDifference < 0 ? 'losing' : 'tied'}">
              ${pointDifference > 0
                ? `You lead by ${pointDifference}`
                : pointDifference < 0
                  ? `They lead by ${Math.abs(pointDifference)}`
                  : 'Tied'}
            </span>
          </div>
        </div>

        ${isExpanded ? `
          <div class="comparison-card-details">
            <div class="quick-stats">
              <h4>Quick Stats</h4>
              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-box-value">${jointSuccessRate}%</div>
                  <div class="stat-box-label">Both right when agreed</div>
                </div>
                ${comparableGames - agreedGames > 0 ? `
                  <div class="stat-box">
                    <div class="stat-box-value">
                      You: ${youCorrectWhenDisagreed} / Them: ${themCorrectWhenDisagreed}
                    </div>
                    <div class="stat-box-label">When you disagreed</div>
                  </div>
                ` : ''}
              </div>
            </div>

            ${this.renderGameByGame(comparison)}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Get agreement badge info based on rate
   */
  getAgreementBadge(rate) {
    if (rate >= 90) {
      return { emoji: '🤝', label: 'Pick Twins', class: 'badge-twins' };
    } else if (rate >= 70) {
      return { emoji: '🤝', label: 'Aligned', class: 'badge-aligned' };
    } else if (rate >= 50) {
      return { emoji: '〰️', label: 'Mixed', class: 'badge-mixed' };
    } else if (rate >= 30) {
      return { emoji: '⚡', label: 'Contrarian', class: 'badge-contrarian' };
    } else {
      return { emoji: '⚡', label: 'Opposite Energy', class: 'badge-opposite' };
    }
  },

  /**
   * Generate agreement dots visualization
   */
  generateAgreementDots(comparison) {
    const { picks } = comparison;
    const yourPicks = this.state.data.yourPicks.picks;
    const games = this.state.data.games;

    const dots = games.map(game => {
      const yourPick = yourPicks.find(p => p.gameId === game.id);
      const theirPick = picks.find(p => p.gameId === game.id);

      if (!yourPick || !theirPick) {
        return `<span class="agreement-dot empty" title="No comparable pick">○</span>`;
      }

      const agreed = yourPick.predictedWinner === theirPick.predictedWinner;
      const tooltip = `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}: ${agreed ? 'Agreed' : 'Disagreed'}`;

      return `<span class="agreement-dot ${agreed ? 'filled' : 'empty'}"
                    title="${tooltip}">${agreed ? '●' : '○'}</span>`;
    });

    return `<div class="agreement-dots" role="img"
                 aria-label="${comparison.agreedGames} out of ${comparison.comparableGames} games agreed">
              ${dots.join('')}
            </div>`;
  },

  /**
   * Render game-by-game breakdown
   */
  renderGameByGame(comparison) {
    const yourPicks = this.state.data.yourPicks.picks;
    const games = this.state.data.games;

    const gameRows = games.map(game => {
      const yourPick = yourPicks.find(p => p.gameId === game.id);
      const theirPick = comparison.picks.find(p => p.gameId === game.id);

      if (!yourPick && !theirPick) return '';

      const matchup = `${game.awayTeamAbbr} @ ${game.homeTeamAbbr}`;
      const score = game.gameStatus === 'final'
        ? `(Final: ${game.awayScore}-${game.homeScore})`
        : game.gameStatus === 'in_progress'
          ? '(In Progress)'
          : '(Scheduled)';

      const yourPickText = yourPick
        ? this.getPickText(yourPick.predictedWinner, game)
        : 'No pick';
      const theirPickText = theirPick
        ? this.getPickText(theirPick.predictedWinner, game)
        : 'No pick';

      const yourIcon = yourPick?.isCorrect === true ? '✓' : yourPick?.isCorrect === false ? '✗' : '';
      const theirIcon = theirPick?.isCorrect === true ? '✓' : theirPick?.isCorrect === false ? '✗' : '';

      const agreed = yourPick && theirPick &&
                     yourPick.predictedWinner === theirPick.predictedWinner;
      const youWonDisagreement = !agreed && yourPick?.isCorrect === true && theirPick?.isCorrect === false;
      const theyWonDisagreement = !agreed && theirPick?.isCorrect === true && yourPick?.isCorrect === false;

      let statusIcon = '';
      let statusClass = '';
      if (agreed) {
        statusIcon = '🤝';
        statusClass = 'agreed';
      } else if (youWonDisagreement) {
        statusIcon = '🎯';
        statusClass = 'you-won';
      } else if (theyWonDisagreement) {
        statusIcon = '❌';
        statusClass = 'they-won';
      } else if (yourPick && theirPick) {
        statusIcon = '⚡';
        statusClass = 'disagreed';
      }

      return `
        <div class="game-comparison-row ${statusClass}">
          <div class="game-info">
            <div class="game-matchup-text">${matchup}</div>
            <div class="game-score-text">${score}</div>
          </div>
          <div class="pick-comparison">
            <div class="your-pick">
              <span class="pick-label">You:</span>
              <span class="pick-value">${yourPickText} ${yourIcon}</span>
            </div>
            <div class="status-icon">${statusIcon}</div>
            <div class="their-pick">
              <span class="pick-label">${comparison.displayName.split(' ')[0]}:</span>
              <span class="pick-value">${theirPickText} ${theirIcon}</span>
            </div>
          </div>
        </div>
      `;
    }).filter(row => row !== '').join('');

    return `
      <div class="game-by-game">
        <h4>Game-by-Game Breakdown</h4>
        <div class="game-breakdown-legend">
          <span class="legend-item"><span class="legend-icon">🤝</span> Both agreed</span>
          <span class="legend-item"><span class="legend-icon">⚡</span> Disagreed</span>
          <span class="legend-item"><span class="legend-icon">🎯</span> You were right</span>
          <span class="legend-item"><span class="legend-icon">❌</span> They were right</span>
        </div>
        <div class="game-breakdown-list">
          ${gameRows}
        </div>
      </div>
    `;
  },

  /**
   * Get readable pick text
   */
  getPickText(predictedWinner, game) {
    if (predictedWinner === 'home') {
      return game.homeTeam;
    } else if (predictedWinner === 'away') {
      return game.awayTeam;
    } else if (predictedWinner === 'tie') {
      return 'Tie';
    }
    return 'Unknown';
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Filter change
    const filterSelect = container.querySelector('#comparison-filter');
    if (filterSelect) {
      filterSelect.value = this.state.filter;
      filterSelect.addEventListener('change', (e) => {
        this.state.filter = e.target.value;
        this.update(container);
      });
    }

    // Sort change
    const sortSelect = container.querySelector('#comparison-sort');
    if (sortSelect) {
      sortSelect.value = this.state.sortBy;
      sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.update(container);
      });
    }

    // Expand/collapse cards
    const expandButtons = container.querySelectorAll('.expand-btn');
    expandButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const userId = parseInt(btn.dataset.userId);

        if (this.state.expandedUsers.has(userId)) {
          this.state.expandedUsers.delete(userId);
        } else {
          this.state.expandedUsers.add(userId);
        }

        this.update(container);
      });
    });
  },

  /**
   * Update the view
   */
  update(container) {
    const comparisonsContainer = container.querySelector('.user-comparisons');
    if (comparisonsContainer) {
      comparisonsContainer.outerHTML = this.renderUserComparisons();

      // Re-attach expand button listeners
      const expandButtons = container.querySelectorAll('.expand-btn');
      expandButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const userId = parseInt(btn.dataset.userId);

          if (this.state.expandedUsers.has(userId)) {
            this.state.expandedUsers.delete(userId);
          } else {
            this.state.expandedUsers.add(userId);
          }

          this.update(container);
        });
      });
    }
  }
};

// Make globally available
window.ComparisonView = ComparisonView;

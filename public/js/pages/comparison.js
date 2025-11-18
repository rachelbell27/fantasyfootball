/**
 * Comparison Page
 *
 * Shows weekly picks comparison between logged-in user and all league members
 */

const ComparisonPage = {
  state: {
    week: null,
    year: null,
    leagueId: null,
    data: null,
    loading: false
  },

  /**
   * Initialize the comparison page
   */
  async init() {
    // Get parameters from URL hash
    // Format: #stats?week=5&year=2024&leagueId=1
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');

    this.state.week = parseInt(params.get('week')) || null;
    this.state.year = parseInt(params.get('year')) || new Date().getFullYear();
    this.state.leagueId = parseInt(params.get('leagueId')) || 1; // Default to league 1

    // If no week specified, get current week
    if (!this.state.week) {
      try {
        const currentWeek = await API.games.getCurrentWeek();
        this.state.week = currentWeek.data.weekNumber;
        this.state.year = currentWeek.data.year;
      } catch (error) {
        console.error('Error getting current week:', error);
        UI.showToast('Error loading current week', 'error');
        this.state.week = 1;
      }
    }
  },

  /**
   * Render the comparison page
   */
  async render(container) {
    if (!container) {
      console.error('Container not found');
      return;
    }

    // Show loading state
    container.innerHTML = `
      <div class="comparison-page">
        <div class="comparison-loading">
          <div class="loading-spinner"></div>
          <p>Loading comparison data...</p>
        </div>
      </div>
    `;

    try {
      // Fetch comparison data
      console.log('[Comparison] Fetching comparison data for week', this.state.week, this.state.year);
      const response = await API.picks.compareWeek(
        this.state.week,
        this.state.year,
        this.state.leagueId
      );
      console.log('[Comparison] API response:', response);

      this.state.data = response.data;

      // Render week selector and comparison view
      container.innerHTML = `
        <div class="comparison-page">
          <div class="comparison-controls">
            ${this.renderWeekSelector()}
          </div>
          <div id="comparison-view-container"></div>
        </div>
      `;

      // Render the comparison view component
      const viewContainer = container.querySelector('#comparison-view-container');
      console.log('[Comparison] View container:', viewContainer);
      console.log('[Comparison] Data to render:', this.state.data);
      await ComparisonView.render(viewContainer, this.state.data);

      // Attach event listeners
      this.attachEventListeners(container);

    } catch (error) {
      console.error('[Comparison] Error loading comparison data:', error);
      container.innerHTML = `
        <div class="comparison-page">
          <div class="comparison-error card">
            <h2>Error Loading Comparison</h2>
            <p>${error.message || 'Failed to load comparison data'}</p>
            <button class="btn btn-primary" onclick="window.location.hash = '#home'">
              Go Back
            </button>
          </div>
        </div>
      `;
    }
  },

  /**
   * Render week selector
   */
  renderWeekSelector() {
    // Generate week options (weeks 1-18 for regular season)
    const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

    return `
      <div class="week-selector card">
        <div class="selector-group">
          <label for="comparison-week">Week:</label>
          <select id="comparison-week" class="form-input">
            ${weeks.map(w => `
              <option value="${w}" ${w === this.state.week ? 'selected' : ''}>
                Week ${w}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="selector-group">
          <label for="comparison-year">Year:</label>
          <select id="comparison-year" class="form-input">
            ${this.renderYearOptions()}
          </select>
        </div>
        <button id="refresh-comparison" class="btn btn-secondary">
          Refresh
        </button>
      </div>
    `;
  },

  /**
   * Render year options
   */
  renderYearOptions() {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    return years.map(year => `
      <option value="${year}" ${year === this.state.year ? 'selected' : ''}>
        ${year}
      </option>
    `).join('');
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Week selector change
    const weekSelect = container.querySelector('#comparison-week');
    if (weekSelect) {
      weekSelect.addEventListener('change', () => {
        this.updateUrl();
      });
    }

    // Year selector change
    const yearSelect = container.querySelector('#comparison-year');
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        this.updateUrl();
      });
    }

    // Refresh button
    const refreshBtn = container.querySelector('#refresh-comparison');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.loadComparison(container);
      });
    }
  },

  /**
   * Update URL and reload
   */
  updateUrl() {
    const weekSelect = document.querySelector('#comparison-week');
    const yearSelect = document.querySelector('#comparison-year');

    if (weekSelect && yearSelect) {
      const week = weekSelect.value;
      const year = yearSelect.value;
      const leagueId = this.state.leagueId;

      window.location.hash = `#stats?week=${week}&year=${year}&leagueId=${leagueId}`;
    }
  },

  /**
   * Load comparison data
   */
  async loadComparison(container) {
    const weekSelect = container.querySelector('#comparison-week');
    const yearSelect = container.querySelector('#comparison-year');

    if (weekSelect && yearSelect) {
      this.state.week = parseInt(weekSelect.value);
      this.state.year = parseInt(yearSelect.value);

      // Re-render with new data
      await this.render(container);
    }
  }
};

// Make globally available
window.ComparisonPage = ComparisonPage;

/**
 * Comparison Page
 *
 * Shows weekly picks comparison between logged-in user and all league members
 */

const ComparisonPage = {
  state: {
    week: null,
    year: null,
    weekType: null,
    leagueId: null,
    data: null,
    loading: false,
    availableWeeks: []
  },

  /**
   * Initialize the comparison page
   */
  async init() {
    // Get parameters from URL hash
    // Format: #stats?week=5&year=2024&leagueId=1&weekType=regular
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');

    this.state.week = parseInt(params.get('week')) || null;
    this.state.year = parseInt(params.get('year')) || new Date().getFullYear();
    this.state.weekType = params.get('weekType') || null;
    this.state.leagueId = parseInt(params.get('leagueId')) || 1; // Default to league 1

    // Fetch available weeks
    try {
      const weeksResponse = await API.games.getWeeks();
      this.state.availableWeeks = weeksResponse.data;
    } catch (error) {
      console.error('Error fetching available weeks:', error);
    }

    // If no week specified, get current week
    if (!this.state.week || !this.state.weekType) {
      try {
        const currentWeek = await API.games.getCurrentWeek();
        this.state.week = currentWeek.data.weekNumber;
        this.state.year = currentWeek.data.year;
        this.state.weekType = currentWeek.data.weekType;
      } catch (error) {
        console.error('Error getting current week:', error);
        UI.showToast('Error loading current week', 'error');
        this.state.week = 1;
        this.state.year = new Date().getFullYear();
        this.state.weekType = 'regular';
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
      console.log('[Comparison] Fetching comparison data for week', this.state.week, this.state.year, this.state.weekType);
      const response = await API.picks.compareWeek(
        this.state.week,
        this.state.year,
        this.state.leagueId,
        this.state.weekType
      );
      console.log('[Comparison] API response:', response);

      this.state.data = response.data;

      // Render week selector and comparison view
      container.innerHTML = `
        <div class="comparison-page">
          <div class="comparison-header">
            <h1>${this.getWeekTitle()}</h1>
          </div>
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
   * Get title for current week
   */
  getWeekTitle() {
    if (this.state.weekType === 'regular') {
      return `Week ${this.state.week} Comparison`;
    } else {
      return `${this.getWeekDisplayName(this.state.weekType)} Comparison`;
    }
  },

  /**
   * Render week selector
   */
  renderWeekSelector() {
    // Use available weeks from API
    const options = this.state.availableWeeks.map((week, index) => {
      const isSelected = week.weekNumber === this.state.week &&
                         week.weekType === this.state.weekType &&
                         week.year === this.state.year;

      let displayLabel;
      if (week.weekType === 'regular') {
        displayLabel = `Week ${week.weekNumber} (Regular Season) (${week.year})`;
      } else {
        displayLabel = `${this.getWeekDisplayName(week.weekType)} (${week.year})`;
      }

      return `<option value="${index}"
                      data-week-number="${week.weekNumber}"
                      data-year="${week.year}"
                      data-week-type="${week.weekType}"
                      ${isSelected ? 'selected' : ''}>
                ${displayLabel}
              </option>`;
    }).join('');

    return `
      <div class="week-selector card">
        <div class="selector-group">
          <label for="comparison-week">Week:</label>
          <select id="comparison-week" class="form-input">
            ${options}
          </select>
        </div>
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
        const selectedOption = weekSelect.options[weekSelect.selectedIndex];
        this.state.week = parseInt(selectedOption.dataset.weekNumber);
        this.state.year = parseInt(selectedOption.dataset.year);
        this.state.weekType = selectedOption.dataset.weekType;
        this.updateUrl();
      });
    }

    // Refresh button (if exists)
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
    const leagueId = this.state.leagueId;
    const week = this.state.week;
    const year = this.state.year;
    const weekType = this.state.weekType;

    window.location.hash = `#stats?week=${week}&year=${year}&weekType=${weekType}&leagueId=${leagueId}`;
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

/**
 * Admin Page
 *
 * Admin panel for managing users, games, and leagues
 */

const AdminPage = {
  state: {
    activeTab: 'users',
    users: [],
    leagues: []
  },

  /**
   * Render the admin page
   */
  async render(container) {
    if (!container) {
      console.error('Container not found');
      return;
    }

    // Check if user is admin
    if (!Auth.isAdmin()) {
      container.innerHTML = `
        <div class="admin-page">
          <div class="error-message card">
            <h2>Access Denied</h2>
            <p>You do not have permission to access this page.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-page">
        ${this.renderHeader()}
        ${this.renderTabs()}
        <div id="admin-content"></div>
      </div>
    `;

    this.attachEventListeners(container);
    await this.loadTabContent(container);
  },

  /**
   * Render header
   */
  renderHeader() {
    return `
      <div class="admin-header">
        <h1>Admin Panel</h1>
        <p class="admin-subtitle">Manage users, games, and leagues</p>
      </div>
    `;
  },

  /**
   * Render tabs
   */
  renderTabs() {
    const tabs = [
      { id: 'users', label: 'Users' },
      { id: 'games', label: 'Games' },
      { id: 'leagues', label: 'Leagues' }
    ];

    return `
      <div class="admin-tabs card">
        ${tabs.map(tab => `
          <button class="admin-tab ${this.state.activeTab === tab.id ? 'active' : ''}"
                  data-tab="${tab.id}">
            ${tab.label}
          </button>
        `).join('')}
      </div>
    `;
  },

  /**
   * Load tab content
   */
  async loadTabContent(container) {
    const contentContainer = container.querySelector('#admin-content');
    if (!contentContainer) return;

    try {
      UI.showLoading();

      switch (this.state.activeTab) {
        case 'users':
          await this.loadUsersTab(contentContainer);
          break;
        case 'games':
          await this.loadGamesTab(contentContainer);
          break;
        case 'leagues':
          await this.loadLeaguesTab(contentContainer);
          break;
      }

      UI.hideLoading();
    } catch (error) {
      console.error('Error loading tab content:', error);
      contentContainer.innerHTML = `
        <div class="error-message card">
          <p>${error.message || 'Failed to load content'}</p>
        </div>
      `;
      UI.hideLoading();
    }
  },

  /**
   * Load users tab
   */
  async loadUsersTab(container) {
    const response = await API.users.list();
    this.state.users = response.data;

    container.innerHTML = `
      <div class="admin-section card">
        <div class="section-header">
          <h2>Users</h2>
          <button class="btn btn-primary" id="add-user-btn">
            Add User
          </button>
        </div>
        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.users.map(user => `
                <tr>
                  <td>${user.username}</td>
                  <td>${user.displayName}</td>
                  <td>${user.isAdmin ? 'Admin' : 'User'}</td>
                  <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button class="btn btn-text btn-sm" disabled>
                      Edit
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * Load games tab
   */
  async loadGamesTab(container) {
    // Get current week
    let currentWeek = 11;
    let currentYear = new Date().getFullYear();

    try {
      const weekResponse = await API.games.getCurrentWeek();
      currentWeek = weekResponse.data.weekNumber;
      currentYear = weekResponse.data.year;
    } catch (error) {
      console.log('Could not get current week, using default');
    }

    container.innerHTML = `
      <div class="admin-section card">
        <div class="section-header">
          <h2>Games Management</h2>
        </div>

        <div class="sync-controls">
          <div class="form-group">
            <label class="form-label">Week to Sync:</label>
            <div style="display: flex; gap: var(--spacing-md); align-items: center;">
              <select id="sync-week" class="form-input" style="max-width: 150px;">
                ${Array.from({length: 18}, (_, i) => i + 1).map(week => `
                  <option value="${week}" ${week === currentWeek ? 'selected' : ''}>
                    Week ${week}
                  </option>
                `).join('')}
              </select>

              <select id="sync-year" class="form-input" style="max-width: 150px;">
                ${[2024, 2025].map(year => `
                  <option value="${year}" ${year === currentYear ? 'selected' : ''}>
                    ${year}
                  </option>
                `).join('')}
              </select>

              <button class="btn btn-primary" id="sync-games-btn">
                Sync from ESPN
              </button>
            </div>
            <small class="form-hint">Select a week and year, then click Sync to fetch games from ESPN</small>
          </div>

          <div id="sync-result" class="sync-result" style="margin-top: var(--spacing-md);"></div>
        </div>
      </div>
    `;

    // Sync button
    const syncBtn = container.querySelector('#sync-games-btn');
    const weekSelect = container.querySelector('#sync-week');
    const yearSelect = container.querySelector('#sync-year');
    const resultDiv = container.querySelector('#sync-result');

    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        const week = parseInt(weekSelect.value);
        const year = parseInt(yearSelect.value);

        try {
          syncBtn.disabled = true;
          syncBtn.textContent = 'Syncing...';
          resultDiv.innerHTML = '<p class="info-message">Fetching games from ESPN...</p>';

          const response = await API.admin.games.sync(week, year);

          resultDiv.innerHTML = `
            <div class="success-message">
              <p><strong>✓ Sync Complete!</strong></p>
              <p>Week ${response.data.week}, ${response.data.year}</p>
              <p>${response.data.gamesAdded} games added, ${response.data.gamesUpdated} games updated</p>
              <p>Total: ${response.data.totalGames} games</p>
            </div>
          `;

          UI.showToast('Games synced successfully!', 'success');
        } catch (error) {
          resultDiv.innerHTML = `
            <div class="error-message">
              <p><strong>✗ Sync Failed</strong></p>
              <p>${error.message || 'Failed to sync games'}</p>
            </div>
          `;
          UI.showToast(error.message || 'Failed to sync games', 'error');
        } finally {
          syncBtn.disabled = false;
          syncBtn.textContent = 'Sync from ESPN';
        }
      });
    }
  },

  /**
   * Load leagues tab
   */
  async loadLeaguesTab(container) {
    try {
      const response = await API.admin.leagues.list();
      this.state.leagues = response.data;

      container.innerHTML = `
        <div class="admin-section card">
          <div class="section-header">
            <h2>Leagues</h2>
            <button class="btn btn-primary" id="add-league-btn">
              Add League
            </button>
          </div>
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Season</th>
                  <th>Mode</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.state.leagues.map(league => `
                  <tr>
                    <td>${league.name}</td>
                    <td>${league.seasonYear}</td>
                    <td>${league.mode}</td>
                    <td>${league.memberCount || 0}</td>
                    <td>${new Date(league.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button class="btn btn-text btn-sm" disabled>
                        Manage
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="admin-section card">
          <div class="section-header">
            <h2>Leagues</h2>
          </div>
          <p>League management coming soon...</p>
        </div>
      `;
    }
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Tab buttons
    const tabButtons = container.querySelectorAll('.admin-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        this.state.activeTab = btn.dataset.tab;

        // Update active tab
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Load content
        await this.loadTabContent(container);
      });
    });
  }
};

// Make globally available
window.AdminPage = AdminPage;

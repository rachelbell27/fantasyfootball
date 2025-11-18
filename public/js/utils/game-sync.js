/**
 * Game Sync Utility
 *
 * Automatically syncs game data from the server at regular intervals
 * when games are in progress
 */

const GameSync = {
  syncInterval: null,
  syncFrequency: 2 * 60 * 1000, // 2 minutes in milliseconds
  isActive: false,
  currentWeek: null,
  currentYear: null,

  /**
   * Start automatic syncing
   */
  async start() {
    if (this.isActive) {
      console.log('[GameSync] Game sync already active');
      return;
    }

    try {
      console.log('[GameSync] Starting game sync...');

      // Get current week
      const weekResponse = await API.games.getCurrentWeek();
      this.currentWeek = weekResponse.data.weekNumber;
      this.currentYear = weekResponse.data.year;
      console.log(`[GameSync] Current week: Week ${this.currentWeek}, ${this.currentYear}`);

      // Check if there are active games
      const hasActiveGames = await this.checkForActiveGames();
      console.log(`[GameSync] Has active games: ${hasActiveGames}`);

      if (hasActiveGames) {
        console.log(`[GameSync] ✓ Starting automatic game sync for Week ${this.currentWeek}, ${this.currentYear}`);
        this.isActive = true;

        // Do an immediate sync
        await this.syncGames();

        // Set up interval for regular syncing
        this.syncInterval = setInterval(() => {
          this.syncGames();
        }, this.syncFrequency);

        console.log(`[GameSync] Sync interval set to ${this.syncFrequency / 1000} seconds`);
      } else {
        console.log('[GameSync] ℹ No active games found, sync not started');
      }
    } catch (error) {
      console.error('[GameSync] ✗ Error starting game sync:', error);
    }
  },

  /**
   * Stop automatic syncing
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isActive = false;
    console.log('[GameSync] ⏹ Game sync stopped');
  },

  /**
   * Check if there are currently active games
   */
  async checkForActiveGames() {
    try {
      const response = await API.games.getGames(this.currentWeek, this.currentYear);
      const games = response.data || [];
      console.log(`[GameSync] Checking ${games.length} games for activity`);

      const now = new Date();

      // Check if any games are:
      // 1. Currently in progress
      // 2. Starting within the next 4 hours
      const activeGames = games.filter(game => {
        const gameTime = new Date(game.gameTime);
        const fourHoursFromNow = new Date(now.getTime() + (4 * 60 * 60 * 1000));
        const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));

        const isInProgress = game.gameStatus &&
          game.gameStatus !== 'final' &&
          game.gameStatus !== 'status_final' &&
          game.gameStatus !== 'pre';

        const isUpcoming = gameTime > now && gameTime < fourHoursFromNow;
        const isRecent = gameTime > twelveHoursAgo;

        return isInProgress || (isUpcoming && isRecent);
      });

      console.log(`[GameSync] Found ${activeGames.length} active games`);
      return activeGames.length > 0;
    } catch (error) {
      console.error('[GameSync] Error checking for active games:', error);
      return false;
    }
  },

  /**
   * Sync games from the server
   */
  async syncGames() {
    try {
      console.log(`[GameSync] 🔄 Syncing games for Week ${this.currentWeek}...`);

      // Call the admin sync endpoint
      const response = await API.admin.games.sync(this.currentWeek, this.currentYear);
      console.log('[GameSync] Sync response:', response);

      if (response.data) {
        const { gamesUpdated, gamesAdded, totalGames } = response.data;
        console.log(`[GameSync] ✓ Sync complete: ${gamesAdded} added, ${gamesUpdated} updated, ${totalGames} total games`);

        if (gamesUpdated > 0 || gamesAdded > 0) {
          // Show toast notification
          if (window.UI && typeof window.UI.showToast === 'function') {
            UI.showToast(`Games updated: ${gamesUpdated} updated, ${gamesAdded} added`, 'success');
          }

          // Dispatch event so pages can refresh if needed
          window.dispatchEvent(new CustomEvent('games-updated', {
            detail: { gamesAdded, gamesUpdated, totalGames }
          }));
        } else {
          console.log('[GameSync] No changes detected');
        }
      }

      // Check if we should stop syncing (all games finished)
      const hasActiveGames = await this.checkForActiveGames();
      if (!hasActiveGames) {
        console.log('[GameSync] ℹ All games finished, stopping sync');
        this.stop();
      }
    } catch (error) {
      // Don't stop syncing on errors, just log them
      console.error('[GameSync] ✗ Error syncing games:', error);

      // If it's an auth error, stop syncing
      if (error.message && (error.message.includes('401') || error.message.includes('unauthorized'))) {
        console.log('[GameSync] Auth error, stopping sync');
        this.stop();
      }
    }
  },

  /**
   * Manually trigger a sync
   */
  async manualSync() {
    try {
      const weekResponse = await API.games.getCurrentWeek();
      this.currentWeek = weekResponse.data.weekNumber;
      this.currentYear = weekResponse.data.year;

      await this.syncGames();

      // Restart auto-sync if there are active games
      if (!this.isActive) {
        await this.start();
      }

      return true;
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  }
};

// Make globally available
window.GameSync = GameSync;

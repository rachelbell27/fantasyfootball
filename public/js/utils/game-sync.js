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
      console.log('Game sync already active');
      return;
    }

    try {
      // Get current week
      const weekResponse = await API.games.getCurrentWeek();
      this.currentWeek = weekResponse.data.weekNumber;
      this.currentYear = weekResponse.data.year;

      // Check if there are active games
      const hasActiveGames = await this.checkForActiveGames();

      if (hasActiveGames) {
        console.log(`Starting game sync for Week ${this.currentWeek}, ${this.currentYear}`);
        this.isActive = true;

        // Do an immediate sync
        await this.syncGames();

        // Set up interval for regular syncing
        this.syncInterval = setInterval(() => {
          this.syncGames();
        }, this.syncFrequency);
      } else {
        console.log('No active games, sync not started');
      }
    } catch (error) {
      console.error('Error starting game sync:', error);
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
    console.log('Game sync stopped');
  },

  /**
   * Check if there are currently active games
   */
  async checkForActiveGames() {
    try {
      const response = await API.games.getGames(this.currentWeek, this.currentYear);
      const games = response.data || [];

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

      return activeGames.length > 0;
    } catch (error) {
      console.error('Error checking for active games:', error);
      return false;
    }
  },

  /**
   * Sync games from the server
   */
  async syncGames() {
    try {
      console.log(`Syncing games for Week ${this.currentWeek}...`);

      // Call the admin sync endpoint
      const response = await API.admin.games.sync();

      if (response.data) {
        const { gamesUpdated, gamesAdded } = response.data;

        if (gamesUpdated > 0 || gamesAdded > 0) {
          console.log(`Game sync complete: ${gamesAdded} added, ${gamesUpdated} updated`);

          // Dispatch event so pages can refresh if needed
          window.dispatchEvent(new CustomEvent('games-updated', {
            detail: { gamesAdded, gamesUpdated }
          }));
        }
      }

      // Check if we should stop syncing (all games finished)
      const hasActiveGames = await this.checkForActiveGames();
      if (!hasActiveGames) {
        console.log('All games finished, stopping sync');
        this.stop();
      }
    } catch (error) {
      // Don't stop syncing on errors, just log them
      console.error('Error syncing games:', error);

      // If it's an auth error, stop syncing
      if (error.message && error.message.includes('401')) {
        console.log('Auth error, stopping sync');
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

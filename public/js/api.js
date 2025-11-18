// API Module - Handles all API requests

const API = {
  baseURL: '/api',

  // Get auth token from storage
  getAuthToken() {
    return Storage.get('authToken');
  },

  // Make authenticated request
  async request(endpoint, options = {}) {
    const token = this.getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        console.error('API Response Error:', data);
        throw new Error(data.message || data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Authentication
  auth: {
    async login(username, password) {
      return API.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },

    async logout() {
      return API.request('/auth/logout', {
        method: 'POST',
      });
    },

    async validate() {
      return API.request('/auth/validate', {
        method: 'GET',
      });
    },

    async changePassword(currentPassword, newPassword) {
      return API.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
  },

  // Users
  users: {
    async getProfile() {
      return API.request('/users/profile');
    },

    async updateProfile(data) {
      return API.request('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async list(leagueId = null) {
      const query = leagueId ? `?leagueId=${leagueId}` : '';
      return API.request(`/users${query}`);
    },
  },

  // Games
  games: {
    async getCurrentWeek() {
      return API.request('/games/current-week');
    },

    async getGames(week, year) {
      return API.request(`/games?week=${week}&year=${year}`);
    },

    async getWeeks() {
      return API.request('/games/weeks');
    },
  },

  // Picks
  picks: {
    async get(week, year, leagueId) {
      return API.request(`/picks?week=${week}&year=${year}&leagueId=${leagueId}`);
    },

    async getAll(week, year, leagueId) {
      return API.request(`/picks/all?week=${week}&year=${year}&leagueId=${leagueId}`);
    },

    async submit(picks) {
      return API.request('/picks', {
        method: 'POST',
        body: JSON.stringify({ picks }),
      });
    },

    async getAllForGame(gameId) {
      return API.request(`/picks/all?gameId=${gameId}`);
    },

    async getUserPicks(userId, week, leagueId) {
      return API.request(`/picks/user/${userId}?week=${week}&leagueId=${leagueId}`);
    },

    async compareWeek(week, year, leagueId) {
      return API.request(`/picks/compare-week?week=${week}&year=${year}&leagueId=${leagueId}`);
    },
  },

  // Leaderboard
  leaderboard: {
    async getSeason(leagueId) {
      return API.request(`/leaderboard/season?leagueId=${leagueId}`);
    },

    async getWeek(week, leagueId) {
      return API.request(`/leaderboard/week?week=${week}&leagueId=${leagueId}`);
    },
  },

  // Stats
  stats: {
    async getUser(userId, leagueId) {
      return API.request(`/stats/user/${userId}?leagueId=${leagueId}`);
    },

    async getLeague(leagueId) {
      return API.request(`/stats/league/${leagueId}`);
    },
  },

  // Admin
  admin: {
    users: {
      async create(userData) {
        return API.request('/admin/users', {
          method: 'POST',
          body: JSON.stringify(userData),
        });
      },

      async update(userId, userData) {
        return API.request(`/admin/users/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(userData),
        });
      },

      async delete(userId) {
        return API.request(`/admin/users/${userId}`, {
          method: 'DELETE',
        });
      },

      async resetPassword(userId, newPassword) {
        return API.request(`/admin/users/${userId}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ newPassword }),
        });
      },
    },

    games: {
      async sync(week = null, year = null) {
        const body = {};
        if (week) body.week = week;
        if (year) body.year = year;

        return API.request('/admin/games/sync', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      },

      async update(gameId, gameData) {
        return API.request(`/admin/games/${gameId}`, {
          method: 'PUT',
          body: JSON.stringify(gameData),
        });
      },

      async toggleOverride(gameId, override) {
        return API.request(`/admin/games/${gameId}/override`, {
          method: 'PUT',
          body: JSON.stringify({ override }),
        });
      },
    },

    leagues: {
      async create(leagueData) {
        return API.request('/admin/leagues', {
          method: 'POST',
          body: JSON.stringify(leagueData),
        });
      },

      async list() {
        return API.request('/admin/leagues');
      },

      async addMember(leagueId, userId) {
        return API.request(`/admin/leagues/${leagueId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        });
      },

      async removeMember(leagueId, userId) {
        return API.request(`/admin/leagues/${leagueId}/members/${userId}`, {
          method: 'DELETE',
        });
      },
    },

    async exportPicks(leagueId) {
      const token = API.getAuthToken();
      window.location.href = `/api/admin/export/picks?leagueId=${leagueId}&token=${token}`;
    },
  },
};
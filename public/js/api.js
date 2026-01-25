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

    async getGames(week, year, weekType = null) {
      let url = `/games?week=${week}&year=${year}`;
      if (weekType) {
        url += `&weekType=${weekType}`;
      }
      return API.request(url);
    },

    async getWeeks() {
      return API.request('/games/weeks');
    },
  },

  // Picks
  picks: {
    async get(week, year, leagueId, weekType = null) {
      let url = `/picks?week=${week}&year=${year}&leagueId=${leagueId}`;
      if (weekType) {
        url += `&weekType=${weekType}`;
      }
      return API.request(url);
    },

    async getAll(week, year, leagueId, weekType = null) {
      let url = `/picks/all?week=${week}&year=${year}&leagueId=${leagueId}`;
      if (weekType) {
        url += `&weekType=${weekType}`;
      }
      return API.request(url);
    },

    async submit(picks) {
      return API.request('/picks/submit', {
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

    async compareWeek(week, year, leagueId, weekType = null) {
      let url = `/picks/compare-week?week=${week}&year=${year}&leagueId=${leagueId}`;
      if (weekType) url += `&weekType=${weekType}`;
      return API.request(url);
    },
  },

  // Leaderboard
  leaderboard: {
    async getSeason(leagueId) {
      return API.request(`/leaderboard/season?leagueId=${leagueId}`);
    },

    async getWeek(week, leagueId, year = null, weekType = null) {
      let url = `/leaderboard/week?week=${week}&leagueId=${leagueId}`;
      if (year) url += `&year=${year}`;
      if (weekType) url += `&weekType=${weekType}`;
      return API.request(url);
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
      async sync(week = null, year = null, weekType = null) {
        const body = {};
        if (week) body.week = week;
        if (year) body.year = year;
        if (weekType) body.weekType = weekType;

        return API.request('/admin/games/sync', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      },

      async syncWeekly() {
        return API.request('/admin/sync/weekly', {
          method: 'POST',
        });
      },

      async syncLive() {
        return API.request('/admin/sync/live', {
          method: 'POST',
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
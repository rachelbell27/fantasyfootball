// Authentication Module

const Auth = {
  // Current user data
  currentUser: null,

  // Initialize auth state
  async init() {
    const token = Storage.get('authToken');
    if (!token) {
      return false;
    }

    try {
      const response = await API.auth.validate();
      const user = response.data?.user || response.user;
      this.currentUser = user;
      Storage.set('currentUser', user);

      // Apply user's custom colors (using camelCase property names)
      if (user.primaryColor && user.secondaryColor) {
        Colors.applyUserColors(user.primaryColor, user.secondaryColor);
      }

      return true;
    } catch (error) {
      console.error('Auth validation failed:', error);
      this.logout();
      return false;
    }
  },

  // Login
  async login(username, password) {
    try {
      const response = await API.auth.login(username, password);

      // Extract data from response (API returns { data: { token, user } })
      const { token, user } = response.data || response;

      // Store token and user data
      Storage.set('authToken', token);
      Storage.set('currentUser', user);
      this.currentUser = user;

      // Apply user's custom colors
      if (user.primaryColor && user.secondaryColor) {
        Colors.applyUserColors(user.primaryColor, user.secondaryColor);
      }

      return response;
    } catch (error) {
      throw error;
    }
  },

  // Logout
  async logout() {
    try {
      await API.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      Storage.remove('authToken');
      Storage.remove('currentUser');
      this.currentUser = null;
      
      // Reset colors to default
      Colors.resetColors();
      
      // Redirect to login
      window.location.href = '/';
    }
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser && !!Storage.get('authToken');
  },

  // Check if user is admin
  isAdmin() {
    return this.currentUser?.is_admin || false;
  },

  // Get current user
  getCurrentUser() {
    return this.currentUser || Storage.get('currentUser');
  },

  // Check if user must change password
  mustChangePassword() {
    return this.currentUser?.must_change_password || false;
  },

  // Update current user data
  updateCurrentUser(userData) {
    this.currentUser = { ...this.currentUser, ...userData };
    Storage.set('currentUser', this.currentUser);

    // Update colors if changed (using camelCase property names)
    if (userData.primaryColor && userData.secondaryColor) {
      Colors.applyUserColors(userData.primaryColor, userData.secondaryColor);
    }
  },

  // Require authentication (redirect if not authenticated)
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/?redirect=' + encodeURIComponent(window.location.pathname);
      return false;
    }
    return true;
  },

  // Require admin (redirect if not admin)
  requireAdmin() {
    if (!this.requireAuth()) {
      return false;
    }
    
    if (!this.isAdmin()) {
      UI.showToast('Admin access required', 'error');
      window.location.href = '/';
      return false;
    }
    
    return true;
  },
};
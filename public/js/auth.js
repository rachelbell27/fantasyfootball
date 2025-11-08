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
      this.currentUser = response.user;
      Storage.set('currentUser', response.user);
      
      // Apply user's custom colors
      if (response.user.primary_color && response.user.secondary_color) {
        Colors.applyUserColors(response.user.primary_color, response.user.secondary_color);
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
      
      // Store token and user data
      Storage.set('authToken', response.token);
      Storage.set('currentUser', response.user);
      this.currentUser = response.user;
      
      // Apply user's custom colors
      if (response.user.primary_color && response.user.secondary_color) {
        Colors.applyUserColors(response.user.primary_color, response.user.secondary_color);
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
    
    // Update colors if changed
    if (userData.primary_color && userData.secondary_color) {
      Colors.applyUserColors(userData.primary_color, userData.secondary_color);
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
// Authentication Module

const Auth = {
  // Current user data
  currentUser: null,

  // Initialize auth state
  async init() {
    const token = Storage.get('authToken');
    if (!token) {
      console.log('[Auth] No token found');
      return false;
    }

    try {
      console.log('[Auth] Validating token...');
      const response = await API.auth.validate();
      const user = response.data?.user || response.user;
      console.log('[Auth] User validated:', user);
      this.currentUser = user;
      Storage.set('currentUser', user);

      // Apply user's custom colors (using camelCase property names)
      if (user.primaryColor && user.secondaryColor) {
        Colors.applyUserColors(user.primaryColor, user.secondaryColor);
      }

      return true;
    } catch (error) {
      console.error('[Auth] Validation failed:', error);
      this.logout();
      return false;
    }
  },

  // Login
  async login(username, password) {
    try {
      console.log('[Auth] Logging in...');
      const response = await API.auth.login(username, password);

      // Extract data from response (API returns { data: { token, user } })
      const { token, user } = response.data || response;
      console.log('[Auth] Login successful:', user);

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
      console.error('[Auth] Login failed:', error);
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
    // Backend returns isAdmin (camelCase), not is_admin (snake_case)
    const isAdmin = this.currentUser?.isAdmin || false;
    console.log('[Auth] isAdmin check:', { currentUser: this.currentUser, isAdmin });
    return isAdmin;
  },

  // Get current user
  getCurrentUser() {
    return this.currentUser || Storage.get('currentUser');
  },

  // Check if user must change password
  mustChangePassword() {
    // Backend returns mustChangePassword (camelCase), not must_change_password (snake_case)
    return this.currentUser?.mustChangePassword || false;
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
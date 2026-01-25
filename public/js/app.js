// Main Application Entry Point

const App = {
  currentPage: null,
  
  // Initialize the application
  async init() {
    console.log('[App] 🏈 NFL Pick\'ems Tracker initializing...');

    // Show loading spinner
    UI.showLoading();

    try {
      // Check authentication
      const isAuthenticated = await Auth.init();

      if (!isAuthenticated) {
        // Show login page
        this.showLoginPage();
      } else {

        // Check if user must change password
        if (Auth.mustChangePassword()) {
          this.showChangePasswordModal();
        }

        // Initialize navigation
        Navbar.init();

        // Start automatic game syncing
        GameSync.start().catch(err => {
        });

        // Route to appropriate page
        this.route();

      }
    } catch (error) {
      UI.showToast('Failed to initialize app', 'error');
    } finally {
      UI.hideLoading();
    }

    // Setup route change listener
    window.addEventListener('popstate', () => this.route());
  },
  
  // Simple routing
  route() {
    const path = window.location.pathname;
    const hash = window.location.hash.slice(1); // Remove #

    // Determine which page to show
    if (path === '/' && !hash) {
      this.showPage('home');
    } else if (hash === 'picks' || path === '/picks' || hash === 'history' || path === '/history') {
      this.showPage('picks');
    } else if (hash === 'profile' || path === '/profile') {
      this.showPage('profile');
    } else if (hash === 'compare-picks' || path === '/compare-picks') {
      this.showPage('compare-picks');
    } else if (hash === 'admin' || path === '/admin') {
      if (Auth.isAdmin()) {
        this.showPage('admin');
      } else {
        this.navigate('home');
      }
    } else {
      this.showPage('home');
    }
  },
  
  // Show a specific page
  async showPage(pageName) {
    if (this.currentPage === pageName) return;
    
    UI.showLoading();
    
    try {
      const mainContent = document.getElementById('main-content');
      mainContent.innerHTML = '';
      
      // Load page
      switch (pageName) {
        case 'home':
          await HomePage.render(mainContent);
          break;
        case 'picks':
          await PicksUnifiedPage.render(mainContent);
          break;
        case 'profile':
          await ProfilePage.render(mainContent);
          break;
        case 'compare-picks':
          await ComparePicksPage.render(mainContent);
          break;
        case 'admin':
          await AdminPage.render(mainContent);
          break;
        default:
          await HomePage.render(mainContent);
      }
      
      this.currentPage = pageName;
      Navbar.setActive(pageName);
      
    } catch (error) {
      console.error('Page render error:', error);
      UI.showToast('Failed to load page', 'error');
    } finally {
      UI.hideLoading();
    }
  },
  
  // Navigate to a page
  navigate(pageName) {
    window.location.hash = pageName === 'home' ? '' : pageName;
    this.route();
  },
  
  // Show login page
  showLoginPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <div class="login-header">
            <h1 class="login-title">🏈 NFL Pick'ems</h1>
            <p class="login-subtitle">Sign in to make your picks</p>
          </div>
          
          <form id="login-form" class="login-form">
            <div class="form-group">
              <label class="form-label" for="username">Username</label>
              <input 
                type="text" 
                id="username" 
                class="form-input" 
                placeholder="Enter your username"
                required
                autocomplete="username"
              >
            </div>
            
            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <input 
                type="password" 
                id="password" 
                class="form-input" 
                placeholder="Enter your password"
                required
                autocomplete="current-password"
              >
            </div>
            
            <div id="login-error" class="form-error hidden"></div>
            
            <button type="submit" class="btn btn-primary">
              Sign In
            </button>
          </form>
        </div>
      </div>
    `;
    
    // Setup login form handler
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleLogin();
    });
  },
  
  // Handle login submission
  async handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    if (!username || !password) {
      errorEl.textContent = 'Please enter both username and password';
      errorEl.classList.remove('hidden');
      return;
    }

    UI.showLoading();

    try {
      console.log('[App] Attempting login...');
      await Auth.login(username, password);
      console.log('[App] Login successful, reloading app...');

      // Reload app after successful login
      window.location.href = '/';

    } catch (error) {
      console.error('[App] Login error:', error);
      errorEl.textContent = error.message || 'Invalid username or password';
      errorEl.classList.remove('hidden');
      UI.hideLoading();
    }
  },
  
  // Show change password modal
  showChangePasswordModal() {
    const modal = Modal.create({
      title: 'Change Your Password',
      content: `
        <p class="mb-md">You must change your password before continuing.</p>
        <form id="change-password-form">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input type="password" id="current-password" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" id="new-password" class="form-input" required minlength="8">
          </div>
          
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input type="password" id="confirm-password" class="form-input" required>
          </div>
          
          <div id="password-error" class="form-error hidden"></div>
        </form>
      `,
      buttons: [
        {
          text: 'Update Password',
          className: 'btn-primary',
          onClick: async () => {
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const errorEl = document.getElementById('password-error');
            
            errorEl.classList.add('hidden');
            
            if (newPassword !== confirmPassword) {
              errorEl.textContent = 'Passwords do not match';
              errorEl.classList.remove('hidden');
              return;
            }
            
            if (newPassword.length < 8) {
              errorEl.textContent = 'Password must be at least 8 characters';
              errorEl.classList.remove('hidden');
              return;
            }
            
            try {
              await API.auth.changePassword(currentPassword, newPassword);
              Auth.updateCurrentUser({ must_change_password: false });
              Modal.close();
              UI.showToast('Password changed successfully', 'success');
              this.route();
            } catch (error) {
              errorEl.textContent = error.message || 'Failed to change password';
              errorEl.classList.remove('hidden');
            }
          }
        }
      ],
      closeable: false, // Cannot close without changing password
    });
  },
};

// UI Helper functions
const UI = {
  showLoading() {
    document.getElementById('loading-spinner').classList.remove('hidden');
  },
  
  hideLoading() {
    document.getElementById('loading-spinner').classList.add('hidden');
  },
  
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
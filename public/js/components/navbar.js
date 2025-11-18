/**
 * Navbar Component
 *
 * Top navigation bar (desktop) and bottom navigation (mobile)
 */

const Navbar = {
  state: {
    activePage: 'home',
    mobileMenuOpen: false
  },

  /**
   * Initialize the navbar
   */
  init() {
    const navContainer = document.getElementById('navigation');
    if (!navContainer) return;

    const user = Auth.currentUser;
    const isAdmin = Auth.isAdmin();

    navContainer.innerHTML = `
      <!-- Navbar -->
      <nav class="navbar">
        <div class="navbar-content">
          <div class="navbar-logo">
            NFL Pick'ems
          </div>

          <!-- Desktop Links -->
          <div class="navbar-links desktop-only">
            <a href="#" class="navbar-link" data-page="home">Home</a>
            <a href="#picks" class="navbar-link" data-page="picks">Picks</a>
            <a href="#history" class="navbar-link" data-page="history">History</a>
            <a href="#compare-picks" class="navbar-link" data-page="compare-picks">Compare</a>
            <a href="#stats" class="navbar-link" data-page="stats">Stats</a>
            ${isAdmin ? '<a href="#admin" class="navbar-link" data-page="admin">Admin</a>' : ''}
          </div>

          <div class="navbar-actions">
            <!-- Mobile Hamburger -->
            <button class="hamburger-btn mobile-only" id="hamburger-btn" aria-label="Toggle menu">
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
            </button>

            <!-- Desktop Actions -->
            <div class="desktop-only" style="display: flex; align-items: center; gap: 1rem;">
              <a href="#profile" class="navbar-link">
                <div class="user-avatar-small" style="background-color: ${user.primaryColor || user.primary_color || '#8AB4F8'}; color: ${Colors.getContrastColor(user.primaryColor || user.primary_color || '#8AB4F8')};">
                  ${(user.displayName || user.display_name).charAt(0).toUpperCase()}
                </div>
              </a>
              <button class="btn btn-text" id="logout-btn">Logout</button>
            </div>
          </div>
        </div>

        <!-- Mobile Menu -->
        <div class="mobile-menu" id="mobile-menu">
          <div class="mobile-menu-header">
            <div class="user-info">
              <div class="user-avatar-small" style="background-color: ${user.primaryColor || user.primary_color || '#8AB4F8'}; color: ${Colors.getContrastColor(user.primaryColor || user.primary_color || '#8AB4F8')};">
                ${(user.displayName || user.display_name).charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="user-name">${user.displayName || user.display_name}</div>
                <div class="user-username">@${user.username}</div>
              </div>
            </div>
          </div>
          <div class="mobile-menu-links">
            <a href="#" class="mobile-menu-link" data-page="home">Home</a>
            <a href="#picks" class="mobile-menu-link" data-page="picks">Picks</a>
            <a href="#history" class="mobile-menu-link" data-page="history">History</a>
            <a href="#compare-picks" class="mobile-menu-link" data-page="compare-picks">Compare</a>
            <a href="#stats" class="mobile-menu-link" data-page="stats">Stats</a>
            <a href="#profile" class="mobile-menu-link" data-page="profile">Profile</a>
            ${isAdmin ? '<a href="#admin" class="mobile-menu-link" data-page="admin">Admin</a>' : ''}
          </div>
          <div class="mobile-menu-footer">
            <button class="btn btn-secondary" id="mobile-logout-btn" style="width: 100%;">Logout</button>
          </div>
        </div>
      </nav>
    `;

    // Attach event listeners
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.href = '/';
      });
    }

    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.href = '/';
      });
    }

    // Hamburger menu toggle
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (hamburgerBtn && mobileMenu) {
      hamburgerBtn.addEventListener('click', () => {
        this.toggleMobileMenu();
      });

      // Close menu when clicking on a link
      document.querySelectorAll('.mobile-menu-link').forEach(link => {
        link.addEventListener('click', () => {
          this.closeMobileMenu();
        });
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (this.state.mobileMenuOpen &&
            !mobileMenu.contains(e.target) &&
            !hamburgerBtn.contains(e.target)) {
          this.closeMobileMenu();
        }
      });
    }

    // Set active page
    this.setActive(this.state.activePage);
  },

  toggleMobileMenu() {
    this.state.mobileMenuOpen = !this.state.mobileMenuOpen;
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburgerBtn = document.getElementById('hamburger-btn');

    if (this.state.mobileMenuOpen) {
      mobileMenu.classList.add('open');
      hamburgerBtn.classList.add('open');
    } else {
      mobileMenu.classList.remove('open');
      hamburgerBtn.classList.remove('open');
    }
  },

  closeMobileMenu() {
    this.state.mobileMenuOpen = false;
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (hamburgerBtn) hamburgerBtn.classList.remove('open');
  },

  /**
   * Set active page indicator
   */
  setActive(pageName) {
    this.state.activePage = pageName;

    // Update navbar links
    document.querySelectorAll('.navbar-link').forEach(link => {
      if (link.dataset.page === pageName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update mobile menu links
    document.querySelectorAll('.mobile-menu-link').forEach(link => {
      if (link.dataset.page === pageName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
};

// Make globally available
window.Navbar = Navbar;

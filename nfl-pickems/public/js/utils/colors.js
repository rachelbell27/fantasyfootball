// Colors Utility

const Colors = {
  // Apply user's custom colors to CSS variables
  applyUserColors(primaryColor, secondaryColor) {
    if (!primaryColor || !secondaryColor) return;

    const root = document.documentElement;
    root.style.setProperty('--primary', primaryColor);
    root.style.setProperty('--secondary', secondaryColor);
    
    // Generate hover colors (lighter variants)
    const primaryHover = this.lightenColor(primaryColor, 15);
    const secondaryHover = this.lightenColor(secondaryColor, 15);
    
    root.style.setProperty('--primary-hover', primaryHover);
    root.style.setProperty('--secondary-hover', secondaryHover);
    
    // Generate light variant for backgrounds
    const primaryLight = this.hexToRgba(primaryColor, 0.15);
    root.style.setProperty('--primary-light', primaryLight);
  },

  // Reset to default colors
  resetColors() {
    const root = document.documentElement;
    root.style.setProperty('--primary', '#8AB4F8');
    root.style.setProperty('--secondary', '#5E97F6');
    root.style.setProperty('--primary-hover', '#A8C7FA');
    root.style.setProperty('--secondary-hover', '#7AA7F7');
    root.style.setProperty('--primary-light', 'rgba(138, 180, 248, 0.15)');
  },

  // Convert hex to RGBA
  hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  // Lighten a hex color by a percentage
  lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  },

  // Get contrasting text color (black or white) for a background color
  getContrastColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#202124' : '#E8EAED';
  },

  // Validate hex color format
  isValidHex(hex) {
    return /^#[0-9A-F]{6}$/i.test(hex);
  },

  // Generate avatar color from user's primary color with opacity
  getAvatarStyle(primaryColor) {
    return {
      backgroundColor: primaryColor,
      color: this.getContrastColor(primaryColor),
    };
  },

  // Generate row tint style for leaderboard
  getRowTintStyle(primaryColor) {
    return {
      backgroundColor: this.hexToRgba(primaryColor, 0.15),
      borderLeft: `4px solid ${primaryColor}`,
    };
  },
};
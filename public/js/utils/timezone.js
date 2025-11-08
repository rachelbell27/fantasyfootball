// Timezone Utility

const Timezone = {
  // US Timezone options
  timezones: [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  ],

  // Format date/time in user's timezone
  format(dateString, timezone, options = {}) {
    const date = new Date(dateString);
    const defaultOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...options,
    };

    try {
      return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
    } catch (error) {
      console.error('Timezone format error:', error);
      return date.toLocaleString();
    }
  },

  // Format just the time
  formatTime(dateString, timezone) {
    return this.format(dateString, timezone, {
      year: undefined,
      month: undefined,
      day: undefined,
      hour: 'numeric',
      minute: '2-digit',
    });
  },

  // Format just the date
  formatDate(dateString, timezone) {
    return this.format(dateString, timezone, {
      hour: undefined,
      minute: undefined,
    });
  },

  // Format for game card display (e.g., "Sun, Oct 20 • 1:00 PM ET")
  formatGameTime(dateString, timezone) {
    const date = new Date(dateString);
    const options = {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };

    try {
      const formatted = new Intl.DateTimeFormat('en-US', options).format(date);
      const tzAbbr = this.getTimezoneAbbr(timezone);
      return `${formatted} ${tzAbbr}`;
    } catch (error) {
      console.error('Timezone format error:', error);
      return date.toLocaleString();
    }
  },

  // Get timezone abbreviation
  getTimezoneAbbr(timezone) {
    const abbrs = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Phoenix': 'MST',
      'America/Los_Angeles': 'PT',
      'America/Anchorage': 'AKT',
      'Pacific/Honolulu': 'HST',
    };
    return abbrs[timezone] || '';
  },

  // Check if game has started
  hasGameStarted(gameTime) {
    return new Date(gameTime) <= new Date();
  },

  // Get current timezone from user profile or default
  getCurrentTimezone() {
    const user = Storage.get('currentUser');
    return user?.timezone || 'America/New_York';
  },
};
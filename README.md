# 🏈 NFL Pick'ems Tracker

A mobile-optimized web application for tracking NFL weekly game predictions with live leaderboards and custom user themes.

## Features

- 📱 Mobile-first responsive design
- 🎨 Google Material Design dark theme
- 🎯 Weekly NFL game predictions
- 🏆 Live leaderboards with custom user colors
- 📊 Historical pick tracking and statistics
- 👥 Multi-user support with authentication
- ⚙️ Admin panel for user and game management
- 🔄 Automatic ESPN API sync
- 🎭 Support for tie predictions
- 🌎 US timezone support

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Netlify Functions (serverless)
- **Database**: Netlify DB (Neon Postgres)
- **Hosting**: Netlify
- **API**: ESPN NFL Scoreboard API

## Prerequisites

- Node.js 20.12.2 or later
- Netlify account
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd nfl-pickems
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Netlify DB

```bash
npx netlify db init
```

Follow the prompts to create your database.

### 4. Setup Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Admin credentials
ADMIN_USERNAME=admin
ADMIN_DISPLAY_NAME=Administrator
ADMIN_PASSWORD=ChangeMe123!
ADMIN_TIMEZONE=America/New_York
ADMIN_PRIMARY_COLOR=#8AB4F8
ADMIN_SECONDARY_COLOR=#5E97F6

# Generate a secret key
SESSION_SECRET=your-random-secret-key-here

# Season
CURRENT_SEASON=2025
```

### 5. Run Database Migrations

```bash
# Apply schema
psql $DATABASE_URL < db/schema.sql

# Seed initial data
node db/seed.js
```

### 6. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:8888`

## Project Structure

```
nfl-pickems/
├── public/                 # Frontend files
│   ├── index.html
│   ├── styles/
│   │   ├── material-theme.css
│   │   ├── main.css
│   │   └── responsive.css
│   └── js/
│       ├── app.js          # Main app entry
│       ├── api.js          # API client
│       ├── auth.js         # Authentication
│       ├── components/     # Reusable components
│       ├── pages/          # Page modules
│       └── utils/          # Utility functions
├── netlify/
│   └── functions/          # Serverless functions
│       ├── auth/
│       ├── admin/
│       ├── games/
│       ├── picks/
│       ├── leaderboard/
│       └── sync-games.js   # Scheduled function
├── db/
│   ├── schema.sql          # Database schema
│   └── seed.js             # Seed script
├── netlify.toml            # Netlify configuration
├── package.json
└── README.md
```

## Database Schema

The application uses PostgreSQL with the following main tables:

- `users` - User accounts with custom colors
- `leagues` - Multiple league support
- `games` - NFL games from ESPN API
- `picks` - User predictions
- `sessions` - Authentication sessions
- `admin_logs` - Admin activity tracking

See `db/schema.sql` for complete schema.

## Deployment

### Deploy to Netlify

1. Push code to GitHub
2. Connect repository to Netlify
3. Netlify will automatically:
   - Detect `netlify.toml` configuration
   - Set up Netlify DB
   - Deploy the application

4. Set environment variables in Netlify dashboard:
   - Go to Site Settings → Environment Variables
   - Add all variables from `.env`

5. Claim your database:
   - Go to Extensions → Neon database
   - Click "Claim database"

### Initial Setup After Deployment

1. Run database migrations in Netlify CLI:
```bash
netlify deploy --prod
```

2. Run seed script to create admin user:
```bash
netlify functions:invoke seed-database
```

3. Login with admin credentials
4. Navigate to Admin panel
5. Run manual ESPN sync to populate games
6. Create additional users

## Admin Features

As an admin, you can:

- ✅ Create and manage users
- ✅ Set custom colors for each user
- ✅ Reset user passwords
- ✅ Manually sync games from ESPN
- ✅ Edit game details (time, scores, etc.)
- ✅ Lock games from syncing
- ✅ Manage multiple leagues
- ✅ Export picks to CSV

## User Features

Regular users can:

- 📅 View current week's games
- 🎯 Make picks for upcoming games
- ⚖️ Predict tie games (optional)
- 📊 View live leaderboard
- 📈 See historical picks and results
- 🏆 Track season statistics
- ⚙️ Customize timezone
- 🔐 Change password

## Game Sync

Games automatically sync from ESPN API:

- **During game days**: Every minute when games are active
- **Other times**: Manual sync only (admin)
- **Override protection**: Locked games won't sync

## Timezone Support

Users can select from US timezones:
- Eastern Time (ET)
- Central Time (CT)
- Mountain Time (MT)
- Arizona Time (MST)
- Pacific Time (PT)
- Alaska Time (AKT)
- Hawaii Time (HST)

All game times display in the user's selected timezone.

## Scoring Rules

- ✅ Correct pick: 1 point
- ❌ Incorrect pick: 0 points
- ⚖️ Tie predicted correctly: 1 point
- ⚖️ Tie predicted incorrectly: 0 points
- 🚫 No pick made: 0 points

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- iOS Safari
- Chrome Mobile

## Development

### Running Locally

```bash
netlify dev
```

### Testing Functions

```bash
# Test a specific function
netlify functions:invoke function-name --payload '{"key":"value"}'
```

### Viewing Logs

```bash
netlify functions:log
```

## Troubleshooting

### Database Connection Issues

```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Sync Not Working

- Check scheduled function is enabled in Netlify dashboard
- Verify ESPN API is accessible
- Check function logs for errors

### User Colors Not Applying

- Verify colors are valid hex codes (#RRGGBB)
- Check browser console for errors
- Clear browser cache

## Future Features (Roadmap)

- [ ] Confidence pool mode
- [ ] Multiple leagues per user
- [ ] Head-to-head comparisons
- [ ] Weekly prizes/badges
- [ ] Push notifications
- [ ] Mobile PWA
- [ ] Survivor pool mode
- [ ] Advanced analytics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the documentation
- Review existing issues
- Create a new issue with details

---

Built with ❤️ for NFL fans
# Automatic Game Sync System

## Overview

The system now includes automatic game synchronization with playoff support. It monitors games in real-time during game days and regularly updates schedules throughout the week.

## Features

### 1. Playoff Support
The system now supports all playoff rounds:
- **Wildcard Weekend** (Week 1 of playoffs)
- **Divisional Weekend** (Week 2 of playoffs)
- **Conference Championships** (Week 3 of playoffs)
- **Super Bowl** (Week 4 of playoffs)

### 2. Automatic Real-Time Updates
- Runs every 5 minutes during active game windows
- Updates scores and game status for in-progress games
- Monitors games from 1 hour before kickoff to 6 hours after
- Automatically updates pick results when games finish

### 3. Weekly Schedule Sync
- Runs daily at 3 AM ET (8 AM UTC)
- Fetches upcoming games for the current and next 2 weeks
- Automatically transitions from regular season to playoffs
- Respects manual overrides (games with `sync_override = true`)

## Scheduled Functions

### scheduled-game-sync.js
- **Frequency**: Every 5 minutes (`*/5 * * * *`)
- **Purpose**: Real-time game score updates
- **Active Window**: Only updates games within 6-hour window
- **Updates**:
  - Home/away scores
  - Game status (scheduled → in_progress → final)
  - Winner determination
  - Pick results

### scheduled-weekly-sync.js
- **Frequency**: Daily at 3 AM ET (`0 8 * * *` UTC)
- **Purpose**: Schedule updates and new game additions
- **Scope**: Current week + next 2 weeks
- **Updates**:
  - New game additions
  - Game time changes
  - Score updates
  - Playoff game additions

## Manual Sync API

### 1. Sync Specific Week (Original)
```bash
POST /api/admin/games/sync
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "week": 1,
  "year": 2025,
  "weekType": "wildcard"
}
```

### 2. Run Weekly Sync On-Demand
Trigger the full weekly sync manually (syncs current + next 2 weeks):
```bash
POST /api/admin/sync/weekly
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "message": "Weekly sync completed successfully",
  "triggeredBy": "manual"
}
```

### 3. Run Live Game Sync On-Demand
Trigger the live game sync manually (updates active games):
```bash
POST /api/admin/sync/live
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "message": "Live game sync completed successfully",
  "triggeredBy": "manual"
}
```

### Week Types
- `"regular"` - Regular season weeks 1-18
- `"wildcard"` - Wildcard playoff round
- `"divisional"` - Divisional playoff round
- `"conference"` - Conference championship games
- `"superbowl"` - Super Bowl

### Examples

Sync regular season week 10:
```json
{
  "week": 10,
  "year": 2025,
  "weekType": "regular"
}
```

Sync wildcard round:
```json
{
  "week": 1,
  "year": 2025,
  "weekType": "wildcard"
}
```

Sync Super Bowl:
```json
{
  "week": 4,
  "year": 2025,
  "weekType": "superbowl"
}
```

## ESPN API Details

### Regular Season
- **Endpoint**: `seasontype=2`
- **Weeks**: 1-18
- **Games per week**: ~16 games

### Playoffs
- **Endpoint**: `seasontype=3`
- **Week 1 (Wildcard)**: 4-6 games
- **Week 2 (Divisional)**: 4 games
- **Week 3 (Conference)**: 2 games
- **Week 4 (Super Bowl)**: 1 game

## Database Schema

The `games` table includes:
- `week_type` - Type of week (regular, wildcard, divisional, conference, superbowl)
- `sync_override` - When true, prevents automatic updates
- `last_synced_at` - Timestamp of last successful sync

## Setup Requirements

### Netlify Configuration
1. **Pro Plan or Higher**: Scheduled functions require Netlify Pro or higher
2. **Environment Variables**: Ensure `DATABASE_URL` is configured
3. **Deploy**: Push changes to trigger deployment

### Local Development
```bash
# Install dependencies
npm install

# Test ESPN API
node test-espn-sync.js

# Run locally (scheduled functions won't trigger)
npm run dev
```

### Deployment
```bash
# Deploy to Netlify
git add .
git commit -m "Add automatic sync with playoff support"
git push origin main
```

## Monitoring

### Check Sync Status
View Netlify function logs:
1. Go to Netlify Dashboard
2. Select your site
3. Navigate to Functions
4. View logs for `scheduled-game-sync` and `scheduled-weekly-sync`

### Manual Trigger
You can manually trigger syncs via the admin panel or API:
- Navigate to Admin → Sync Games
- Select week type and number
- Click "Sync Now"

## Troubleshooting

### Scheduled Functions Not Running
- Verify you're on Netlify Pro or higher plan
- Check function logs for errors
- Ensure `@netlify/functions` package is installed

### Games Not Updating
- Check if `sync_override` is set to true
- Verify ESPN API is accessible
- Check function timeout settings

### Playoff Games Not Appearing
- Manually sync playoff weeks using the admin API
- Verify `week_type` is set correctly
- Check ESPN API response for the playoff week

## Season Transition

The system automatically handles the transition from regular season to playoffs:

1. **Week 18 Completion**: When all Week 18 games are final
2. **Automatic Detection**: Weekly sync detects season end
3. **Playoff Addition**: Begins syncing wildcard round games
4. **Sequential Progress**: Advances through playoff rounds automatically

## Best Practices

1. **Pre-Season Setup**: Manually sync Week 1 games before season starts
2. **Playoff Preparation**: Sync wildcard round when playoff teams are determined
3. **Monitor Logs**: Check function logs during critical games
4. **Manual Override**: Use `sync_override` for exhibition games or corrections

## Future Enhancements

Potential improvements:
- Adaptive sync frequency (more frequent during close games)
- Webhook notifications for game updates
- Manual override UI in admin panel
- Sync history and audit log
- Rate limiting and API error handling

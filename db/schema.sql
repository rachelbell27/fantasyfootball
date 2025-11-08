-- NFL Pick'ems Database Schema

-- Users table with custom colors
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    primary_color VARCHAR(7) DEFAULT '#8AB4F8',
    secondary_color VARCHAR(7) DEFAULT '#5E97F6',
    is_admin BOOLEAN DEFAULT FALSE,
    must_change_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leagues for multi-league support
CREATE TABLE IF NOT EXISTS leagues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    season_year INTEGER NOT NULL,
    mode VARCHAR(20) DEFAULT 'standard', -- 'standard' or 'confidence'
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- League membership
CREATE TABLE IF NOT EXISTS league_members (
    id SERIAL PRIMARY KEY,
    league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, user_id)
);

-- Games table with sync override
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    espn_game_id VARCHAR(50) UNIQUE NOT NULL,
    season_year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    week_type VARCHAR(20) NOT NULL, -- 'regular', 'wildcard', 'divisional', 'conference', 'superbowl'
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    home_team_abbr VARCHAR(10),
    away_team_abbr VARCHAR(10),
    home_team_logo VARCHAR(255),
    away_team_logo VARCHAR(255),
    game_time TIMESTAMP NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    game_status VARCHAR(20) NOT NULL, -- 'scheduled', 'in_progress', 'final', 'postponed'
    winner VARCHAR(50), -- 'home', 'away', 'tie', null
    sync_override BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Picks table (standard pick'ems)
CREATE TABLE IF NOT EXISTS picks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
    predicted_winner VARCHAR(50) NOT NULL, -- 'home', 'away', 'tie'
    is_correct BOOLEAN,
    picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, game_id, league_id)
);

-- Confidence picks (for future confidence pool mode)
CREATE TABLE IF NOT EXISTS confidence_picks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    league_id INTEGER REFERENCES leagues(id) ON DELETE CASCADE,
    predicted_winner VARCHAR(50) NOT NULL,
    confidence_value INTEGER NOT NULL, -- 1-16 (or number of games that week)
    points_earned INTEGER DEFAULT 0,
    is_correct BOOLEAN,
    picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, game_id, league_id)
);

-- Sessions for authentication
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin activity log
CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_week ON games(season_year, week_number);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(game_status);
CREATE INDEX IF NOT EXISTS idx_picks_user_league ON picks(user_id, league_id);
CREATE INDEX IF NOT EXISTS idx_picks_game ON picks(game_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_league_members ON league_members(league_id, user_id);
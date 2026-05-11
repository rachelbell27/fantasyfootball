export const STAT_FIELDS = [
  { key: 'games_played',       label: 'Games Played' },
  { key: 'pass_completions',   label: 'Completions' },
  { key: 'pass_attempts',      label: 'Pass Attempts' },
  { key: 'pass_yards',         label: 'Pass Yards' },
  { key: 'pass_touchdowns',    label: 'Passing TDs' },
  { key: 'pass_interceptions', label: 'Interceptions Thrown' },
  { key: 'passer_rating',      label: 'Passer Rating' },
  { key: 'rush_attempts',      label: 'Rush Attempts' },
  { key: 'rush_yards',         label: 'Rush Yards' },
  { key: 'rush_touchdowns',    label: 'Rushing TDs' },
  { key: 'receptions',         label: 'Receptions' },
  { key: 'targets',            label: 'Targets' },
  { key: 'rec_yards',          label: 'Rec Yards' },
  { key: 'rec_touchdowns',     label: 'Receiving TDs' },
  { key: 'total_tackles',      label: 'Total Tackles' },
  { key: 'solo_tackles',       label: 'Solo Tackles' },
  { key: 'sacks',              label: 'Sacks' },
  { key: 'def_interceptions',  label: 'INTs (DEF)' },
  { key: 'forced_fumbles',     label: 'Forced Fumbles' },
  { key: 'passes_defended',    label: 'Passes Defended' },
  { key: 'fg_made',            label: 'FG Made' },
  { key: 'fg_attempted',       label: 'FG Attempted' },
  { key: 'xp_made',            label: 'XP Made' },
  { key: 'xp_attempted',       label: 'XP Attempted' },
];

export const VALID_STAT_KEYS = STAT_FIELDS.map(f => f.key);

export function statLabel(key) {
  return STAT_FIELDS.find(f => f.key === key)?.label ?? key;
}

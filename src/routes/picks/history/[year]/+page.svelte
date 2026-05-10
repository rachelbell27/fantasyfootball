<script>
  let { data } = $props();

  const weekLabel = (w) =>
    w.week_type === 'regular'
      ? `Week ${w.week_number}`
      : { wildcard: 'Wild Card', divisional: 'Divisional', conference: 'Conference Championship', superbowl: 'Super Bowl' }[w.week_type] ?? w.week_type;

  function resultClass(game) {
    if (game.is_correct === true)  return 'correct';
    if (game.is_correct === false) return 'incorrect';
    return 'pending';
  }

  const weekStats = (week) => ({
    wins:   week.games.filter(g => g.is_correct === true).length,
    losses: week.games.filter(g => g.is_correct === false).length,
  });
</script>

<svelte:head><title>{data.year} Picks · down bad ↓</title></svelte:head>

<div class="db-page">
  <h1 class="db-h1" style="margin-bottom:24px">{data.year} Season</h1>

  {#if data.weeks.length === 0}
    <div class="db-card" style="padding:48px;text-align:center">
      <p style="font-size:40px;margin:0 0 12px">👻</p>
      <p style="font-weight:700;margin:0">No picks for {data.year}.</p>
    </div>
  {:else}
    {#each data.weeks as week}
      {@const stats = weekStats(week)}
      <div style="margin-bottom:24px">
        <div class="db-card-h" style="margin-bottom:10px">
          {weekLabel(week)}
          <span class="db-pill" style="background:color-mix(in srgb,var(--good) 15%,var(--bg-2));color:var(--good)">{stats.wins}W</span>
          <span class="db-pill" style="background:color-mix(in srgb,var(--bad) 12%,var(--bg-2));color:var(--bad);margin-left:4px">{stats.losses}L</span>
        </div>

        {#each week.games as game}
          <div class="pick-row db-card" style="padding:14px 16px;margin-bottom:8px">
            <div class="matchup">
              <span class="team {game.predicted_winner === 'away' ? resultClass(game) : ''}" style="text-align:right">
                {game.away_team_abbr}
              </span>
              <span class="vs">@</span>
              <span class="team {game.predicted_winner === 'home' ? resultClass(game) : ''}">
                {game.home_team_abbr}
              </span>
            </div>
            <div class="result-badge {resultClass(game)}">
              {#if game.is_correct === true}✓ Correct
              {:else if game.is_correct === false}✗ Wrong
              {:else}Pending{/if}
            </div>
            {#if game.game_status === 'final' || game.game_status === 'status_final'}
              <div class="score">{game.away_score}–{game.home_score}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>

<style>
  .pick-row { display: flex; align-items: center; gap: 12px; }
  .matchup { display: flex; align-items: center; gap: 8px; flex: 1; }
  .team {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -.02em;
    flex: 1;
  }
  .team.correct   { color: var(--good); }
  .team.incorrect { color: var(--bad);  }
  .team.pending   { color: var(--ink-soft); }
  .vs { font-size: 12px; font-weight: 700; color: var(--ink-soft); flex-shrink: 0; }
  .result-badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    padding: 3px 8px;
    border-radius: 5px;
    background: var(--bg-2);
    color: var(--ink-soft);
  }
  .result-badge.correct   { background: color-mix(in srgb,var(--good) 15%,var(--bg-2)); color: var(--good); }
  .result-badge.incorrect { background: color-mix(in srgb,var(--bad)  12%,var(--bg-2)); color: var(--bad);  }
  .score {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-soft);
    white-space: nowrap;
  }
</style>

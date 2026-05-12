<script>
  let { data } = $props();

  const WEEK_LABELS = { regular: n => `Week ${n}`, wildcard: () => 'Wild Card', divisional: () => 'Divisional', conference: () => 'Conference Championship', superbowl: () => 'Super Bowl' };
  const weekLabel = $derived((WEEK_LABELS[data.week.type] ?? (() => data.week.type))(data.week.number));

  let tab = $state('season'); // 'season' | 'week'

  const seasonBoard = $derived(
    [...data.leaderboard].sort((a, b) => a.season_rank - b.season_rank)
  );
  const weekBoard = $derived(
    [...data.leaderboard].sort((a, b) => a.week_rank - b.week_rank)
  );
  const board = $derived(tab === 'season' ? seasonBoard : weekBoard);

  const seasonLeader = $derived(seasonBoard[0]);
  const weekLeader   = $derived(weekBoard[0]);

  function rankClass(r) { return r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : ''; }
  function pct(n) { return n == null ? '—' : `${n}%`; }
  function initials(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }
</script>

<svelte:head><title>Leaderboard · down bad ↓</title></svelte:head>

<div class="db-page">

  <!-- ── Hero ──────────────────────────────────────────────────────────── -->
  <div class="hero-grid">
    <div class="db-card hero-card">
      <div class="hero-trophy">🏆</div>
      <div class="hero-body">
        <p class="eyebrow">Season leader · {data.week.year}</p>
        <h1 class="db-h1 db-italic hero-name">{seasonLeader?.display_name ?? '—'}</h1>
        <p class="db-sub hero-record">
          {seasonLeader?.season_wins ?? 0}–{seasonLeader?.season_losses ?? 0}
          {#if seasonLeader?.season_win_pct != null}
            <span class="pct-pill">{seasonLeader.season_win_pct}%</span>
          {/if}
        </p>
        <div class="hero-btns">
          <a href="/picks" class="db-btn primary">Make picks →</a>
          <a href="/compare" class="db-btn">Compare</a>
          <a href="/games" class="db-btn">Games</a>
        </div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="db-card stat-card">
        <p class="eyebrow">This week</p>
        <p class="stat-big">{weekLabel}</p>
        <p class="db-sub">{data.week.year} season</p>
      </div>
      <div class="db-card stat-card">
        <p class="eyebrow">Week leader</p>
        <p class="stat-big" style="font-size:18px">{weekLeader?.display_name ?? '—'}</p>
        <p class="db-sub">{weekLeader?.week_wins ?? 0}–{weekLeader?.week_losses ?? 0} this week</p>
      </div>
      <div class="db-card stat-card">
        <p class="eyebrow">Games</p>
        <div class="games-strip">
          <span class="gs-item"><span class="gs-dot final"></span>{data.games.final_count} final</span>
          {#if data.games.live_count > 0}
            <span class="gs-item live"><span class="gs-dot live-dot"></span>{data.games.live_count} live</span>
          {/if}
          <span class="gs-item"><span class="gs-dot upcoming"></span>{data.games.upcoming_count} upcoming</span>
        </div>
        <p class="db-sub">{data.games.total} total · <a href="/games" class="link-quiet">view all</a></p>
      </div>
      <div class="db-card stat-card">
        <p class="eyebrow">Players</p>
        <p class="stat-big">{data.leaderboard.length}</p>
        <p class="db-sub">in the league</p>
      </div>
    </div>
  </div>

  <!-- ── Leaderboard ───────────────────────────────────────────────────── -->
  <div class="db-card board-card">
    <div class="board-header">
      <h2 class="board-title">Leaderboard</h2>
      <div class="tabs">
        <button class="tab" class:active={tab === 'season'} onclick={() => tab = 'season'}>Season</button>
        <button class="tab" class:active={tab === 'week'}   onclick={() => tab = 'week'}>This Week</button>
      </div>
    </div>

    {#if data.leaderboard.length === 0}
      <div class="empty-board">
        <p style="font-size:36px;margin:0 0 8px">👻</p>
        <p style="margin:0;font-weight:600">No picks yet.</p>
      </div>
    {:else if tab === 'season'}
      <div class="board-table">
        <div class="board-thead">
          <span class="col-rank">Rank</span>
          <span class="col-player">Player</span>
          <span class="col-num">W</span>
          <span class="col-num">L</span>
          <span class="col-num">Win%</span>
          <span class="col-num">Best Wk</span>
          <span class="col-num pending-col">Pending</span>
        </div>
        {#each board as row}
          <div class="board-row">
            <span class="col-rank rank-val {rankClass(row.season_rank)}">
              {row.season_rank}
            </span>
            <span class="col-player">
              <span class="avatar" style="background:{row.primary_color ?? 'var(--accent)'}">
                {initials(row.display_name)}
              </span>
              <span class="player-name">{row.display_name}</span>
            </span>
            <span class="col-num fw">{row.season_wins}</span>
            <span class="col-num muted">{row.season_losses}</span>
            <span class="col-num">{pct(row.season_win_pct)}</span>
            <span class="col-num">{row.best_week > 0 ? row.best_week : '—'}</span>
            <span class="col-num pending-col {row.season_pending > 0 ? 'pending-val' : 'muted'}">
              {row.season_pending > 0 ? `+${row.season_pending}` : '—'}
            </span>
          </div>
        {/each}
      </div>

    {:else}
      <div class="board-table">
        <div class="board-thead">
          <span class="col-rank">Rank</span>
          <span class="col-player">Player</span>
          <span class="col-num">Wk W</span>
          <span class="col-num">Wk L</span>
          <span class="col-num pending-col">Pending</span>
          <span class="col-record">Season</span>
          <span class="col-num">Win%</span>
        </div>
        {#each board as row}
          <div class="board-row">
            <span class="col-rank rank-val {rankClass(row.week_rank)}">
              {row.week_rank}
            </span>
            <span class="col-player">
              <span class="avatar" style="background:{row.primary_color ?? 'var(--accent)'}">
                {initials(row.display_name)}
              </span>
              <span class="player-name">{row.display_name}</span>
            </span>
            <span class="col-num fw">{row.week_wins}</span>
            <span class="col-num muted">{row.week_losses}</span>
            <span class="col-num pending-col {row.week_pending > 0 ? 'pending-val' : 'muted'}">
              {row.week_pending > 0 ? `+${row.week_pending}` : '—'}
            </span>
            <span class="col-record muted">{row.season_wins}–{row.season_losses}</span>
            <span class="col-num">{pct(row.season_win_pct)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

</div>

<style>
  /* ── Layout ── */
  .hero-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  @media (max-width: 700px) { .hero-grid { grid-template-columns: 1fr; } }

  /* ── Hero card ── */
  .hero-card {
    display: flex;
    gap: 18px;
    align-items: center;
    padding: 24px;
  }
  .hero-trophy { font-size: 64px; line-height: 1; flex-shrink: 0; }
  .hero-body { flex: 1; min-width: 0; }
  .hero-name { margin: 4px 0 6px; }
  .hero-record { display: flex; align-items: center; gap: 8px; }
  .pct-pill {
    font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 20px;
    background: color-mix(in srgb, var(--accent) 15%, var(--bg-2));
    color: var(--accent);
  }
  .hero-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .eyebrow {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .09em; color: var(--ink-soft); margin: 0 0 4px;
  }

  /* ── Stat grid ── */
  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .stat-card { padding: 16px 18px; }
  .stat-big { font-size: 22px; font-weight: 800; margin: 2px 0 4px; color: var(--ink); }

  /* ── Games strip ── */
  .games-strip { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0 4px; }
  .gs-item { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }
  .gs-item.live { color: var(--good, #22c55e); }
  .gs-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .gs-dot.final    { background: var(--ink-soft); }
  .gs-dot.live-dot { background: var(--good, #22c55e); animation: blink 1.2s ease-in-out infinite; }
  .gs-dot.upcoming { background: var(--line); border: 1.5px solid var(--ink-soft); }
  @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:.3 } }
  .link-quiet { color: var(--ink-soft); text-decoration: underline; }

  /* ── Board card ── */
  .board-card { padding: 0; overflow: hidden; }
  .board-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 0;
  }
  .board-title { font-size: 16px; font-weight: 800; margin: 0; }

  .tabs { display: flex; gap: 2px; background: var(--bg-2); border-radius: 8px; padding: 3px; }
  .tab {
    background: none; border: none; cursor: pointer; padding: 5px 14px;
    font-size: 12px; font-weight: 700; border-radius: 6px; color: var(--ink-soft);
    transition: background .15s, color .15s;
  }
  .tab.active { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }

  /* ── Table ── */
  .board-table { margin-top: 12px; }
  .board-thead, .board-row {
    display: grid;
    grid-template-columns: 48px 1fr 52px 52px 56px 68px 68px;
    align-items: center;
    gap: 0;
    padding: 0 20px;
  }
  .board-thead {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: var(--ink-soft);
    padding-bottom: 8px; border-bottom: 1px solid var(--line);
  }
  .board-row {
    padding-top: 10px; padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
    transition: background .1s;
  }
  .board-row:last-child { border-bottom: none; }
  .board-row:hover { background: var(--bg-2); }

  .col-rank { text-align: center; }
  .col-player { display: flex; align-items: center; gap: 10px; }
  .col-num { text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; }
  .col-record { text-align: right; font-size: 12px; font-family: var(--font-mono); color: var(--ink-soft); }
  .pending-col { color: var(--ink-soft); }

  .rank-val {
    font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums;
    text-align: center; color: var(--ink-soft);
  }
  .rank-val.gold   { color: #f59e0b; }
  .rank-val.silver { color: #94a3b8; }
  .rank-val.bronze { color: #b45309; }

  .avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0;
  }
  .player-name { font-size: 14px; font-weight: 700; }

  .fw    { font-weight: 800; color: var(--ink); }
  .muted { color: var(--ink-soft); }
  .pending-val { color: var(--accent); font-weight: 700; }

  .empty-board { text-align: center; padding: 48px 24px; }

  @media (max-width: 600px) {
    .board-thead, .board-row {
      grid-template-columns: 36px 1fr 40px 40px 44px;
    }
    /* hide best-week and pending cols on mobile */
    .board-thead :nth-child(6),
    .board-thead :nth-child(7),
    .board-row   :nth-child(6),
    .board-row   :nth-child(7) { display: none; }
  }
</style>

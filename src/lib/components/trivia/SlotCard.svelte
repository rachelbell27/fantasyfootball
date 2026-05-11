<script>
  let { slot, hintType = 'blank', found, revealed, playerName } = $props();

  const hd = $derived(slot.hintData ?? {});

  function fmt(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString();
  }
</script>

<div
  class="slot-card"
  class:found
  class:revealed={revealed && !found}
  class:blank={hintType === 'blank' && !found && !revealed}
>
  {#if found}
    <div class="slot-name found-name">{playerName}</div>

  {:else if revealed}
    <div class="slot-name revealed-name">{playerName ?? '?'}</div>

  {:else if hintType === 'team_logo'}
    {#if hd.display_all_teams && hd.teams?.length}
      <div class="logo-row">
        {#each hd.teams as team}
          <img
            src={team.logo_url}
            alt={team.display_name}
            class="team-logo"
            onerror={e => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('hidden'); }}
          />
          <span class="logo-fallback hidden">🛡</span>
        {/each}
      </div>
    {:else if hd.logo_url}
      <div class="logo-single">
        <img
          src={hd.logo_url}
          alt={hd.team_name ?? 'Team'}
          class="team-logo-lg"
          onerror={e => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('hidden'); }}
        />
        <span class="logo-fallback hidden" aria-hidden="true">🛡</span>
      </div>
    {:else}
      <span class="logo-fallback-lg" aria-hidden="true">🛡</span>
    {/if}

  {:else if hintType === 'team_name'}
    {#if hd.display_all_teams && hd.teams?.length}
      <div class="team-name-list">
        {#each hd.teams as team}
          <span class="team-badge" style={team.color ? `background:${team.color}` : ''}>
            {team.abbreviation ?? team.display_name}
          </span>
        {/each}
      </div>
    {:else if hd.team_name}
      <div class="team-name-single">
        <span class="team-badge lg" style={hd.team_color ? `background:${hd.team_color}` : ''}>
          {hd.team_name}
        </span>
      </div>
    {:else}
      <div class="hint-empty">—</div>
    {/if}

  {:else if hintType === 'player_name'}
    <div class="player-name-hint">{hd.player_name ?? '?'}</div>

  {:else if hintType === 'player_headshot'}
    <div class="headshot-wrap">
      {#if hd.headshot_url}
        <img
          src={hd.headshot_url}
          alt="Player"
          class="headshot"
          onerror={e => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('hidden'); }}
        />
        <div class="headshot headshot-fallback hidden" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="15" r="7" fill="currentColor" opacity="0.3"/>
            <path d="M4 36c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          </svg>
        </div>
      {:else}
        <div class="headshot headshot-fallback" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="15" r="7" fill="currentColor" opacity="0.3"/>
            <path d="M4 36c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          </svg>
        </div>
      {/if}
    </div>

  {:else if hintType === 'stat_line'}
    {#if hd.stat_label != null && hd.stat_value != null}
      <div class="stat-line">
        <span class="stat-label">{hd.stat_label}</span>
        <span class="stat-value">{fmt(hd.stat_value)}</span>
      </div>
    {:else}
      <div class="hint-empty">—</div>
    {/if}

  {:else}
    <!-- blank: pulsing border only, no content -->
  {/if}
</div>

<style>
  .slot-card {
    background: var(--card);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    padding: 14px 12px;
    min-width: 140px;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
  }

  .slot-card.blank {
    animation: pulse-border 2.5s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%, 100% { border-color: var(--line); }
    50%       { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
  }

  .slot-card.found {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--card));
    animation: pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .slot-card.revealed {
    border-color: var(--line);
    background: var(--bg-2);
    opacity: 0.75;
  }

  @keyframes pop-in {
    from { transform: scale(0.85); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }

  /* ── Found / revealed names ── */
  .slot-name { font-weight: 700; font-size: 14px; line-height: 1.2; text-align: center; }
  .found-name { color: var(--accent); }
  .revealed-name { color: var(--ink-soft); font-size: 13px; }

  /* ── Team logo ── */
  .logo-single {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 56px;
  }

  .team-logo-lg {
    max-width: 64px;
    max-height: 56px;
    object-fit: contain;
  }

  .logo-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: center;
  }

  .team-logo {
    max-width: 36px;
    max-height: 36px;
    object-fit: contain;
  }

  .logo-fallback { font-size: 28px; }
  .logo-fallback-lg { font-size: 40px; }
  .hidden { display: none; }

  /* ── Team name ── */
  .team-name-single {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .team-name-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  }

  .team-badge {
    font-size: 11px;
    font-weight: 800;
    padding: 3px 7px;
    border-radius: 5px;
    background: var(--ink);
    color: #fff;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .team-badge.lg {
    font-size: 13px;
    padding: 5px 10px;
  }

  /* ── Player name hint ── */
  .player-name-hint {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink-soft);
    font-style: italic;
    text-align: center;
    line-height: 1.3;
  }

  /* ── Player headshot ── */
  .headshot-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .headshot {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    overflow: hidden;
  }

  .headshot-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-soft);
    border: 1.5px solid var(--line);
  }

  .headshot-fallback svg {
    width: 40px;
    height: 40px;
  }

  /* ── Stat line ── */
  .stat-line {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }

  .stat-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-soft);
  }

  .stat-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  /* ── Fallback ── */
  .hint-empty {
    font-size: 20px;
    color: var(--ink-soft);
    opacity: 0.4;
  }
</style>

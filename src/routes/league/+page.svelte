<script>
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  const sportIcons = { Football: '🏈', Hockey: '🏒', Basketball: '🏀', Baseball: '⚾', Soccer: '⚽', Other: '🏆' };
  const sports = ['Football', 'Hockey', 'Basketball', 'Baseball', 'Soccer', 'Other'];
  const statuses = ['Active', 'Finished'];

  const canEdit = $derived(!!(data.profile?.is_admin || data.profile?.is_commissioner));
  const today = new Date().toISOString().slice(0, 10);

  const isArchived = (l) => l.status === 'Finished' || !!(l.expiration_date && l.expiration_date < today);

  const activeLeagues = $derived(data.leagues.filter(l => !isArchived(l)));
  const archivedLeagues = $derived(data.leagues.filter(l => isArchived(l)));

  let editMode = $state(false);
  let editingId = $state(null);
  let showForm = $state(false);
  let saving = $state(false);
  let formError = $state('');

  const emptyForm = () => ({ sport: 'Football', platform: '', commissioner_name: '', league_name: '', url: 'https://', sort_order: 0, expiration_date: '', winner: '', status: 'Active' });
  let form = $state(emptyForm());

  function startEdit(league) {
    editingId = league.id;
    showForm = true;
    formError = '';
    form = {
      sport: league.sport,
      platform: league.platform,
      commissioner_name: league.commissioner_name,
      league_name: league.league_name,
      url: league.url,
      sort_order: league.sort_order ?? 0,
      expiration_date: league.expiration_date ?? '',
      winner: league.winner ?? '',
      status: league.status ?? 'Active',
    };
  }

  function startAdd() {
    editingId = null;
    showForm = true;
    formError = '';
    form = emptyForm();
  }

  function cancelForm() {
    showForm = false;
    editingId = null;
    formError = '';
  }

  async function saveLeague() {
    saving = true;
    formError = '';
    try {
      const url = editingId != null ? `/api/fantasy-leagues/${editingId}` : '/api/fantasy-leagues';
      const method = editingId != null ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sort_order: Number(form.sort_order) || 0 })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        formError = err.message || 'Failed to save. Please try again.';
        return;
      }
      cancelForm();
      await invalidateAll();
    } finally {
      saving = false;
    }
  }

  async function deleteLeague(id) {
    if (!confirm('Delete this league listing?')) return;
    await fetch(`/api/fantasy-leagues/${id}`, { method: 'DELETE' });
    await invalidateAll();
  }
</script>

<svelte:head><title>The League · down bad ↓</title></svelte:head>

<div class="db-page">
  <div style="max-width:720px;margin:0 auto">

    <div style="margin-bottom:24px">
      <div class="db-card-h">The League 🏆</div>
      <p class="db-sub" style="margin-top:8px;font-size:14px;line-height:1.6">
        Down Bad for Ghost is a group of friends who take their fantasy sports entirely too seriously.
        Find links to all active leagues below.
      </p>
    </div>

    {#if canEdit}
      <div style="display:flex;gap:8px;margin-bottom:20px;align-items:center">
        <button
          class="db-btn {editMode ? 'primary' : ''}"
          onclick={() => { editMode = !editMode; if (!editMode) cancelForm(); }}
          style="font-size:13px"
        >
          {editMode ? '✓ Done editing' : '✏ Edit leagues'}
        </button>
        {#if editMode}
          <button class="db-btn primary" onclick={startAdd} style="font-size:13px">+ Add league</button>
        {/if}
      </div>
    {/if}

    {#if showForm}
      <div class="db-card form-card" style="margin-bottom:20px">
        <div style="font-weight:800;font-size:15px;margin-bottom:16px">
          {editingId != null ? 'Edit League' : 'Add League'}
        </div>

        {#if formError}
          <div style="color:var(--bad);font-size:13px;margin-bottom:12px">{formError}</div>
        {/if}

        <div class="form-grid-2" style="margin-bottom:12px">
          <div>
            <label class="db-label" for="f-sport">Sport</label>
            <select id="f-sport" class="db-input" bind:value={form.sport}>
              {#each sports as s}<option>{s}</option>{/each}
            </select>
          </div>
          <div>
            <label class="db-label" for="f-status">Status</label>
            <select id="f-status" class="db-input" bind:value={form.status}>
              {#each statuses as s}<option>{s}</option>{/each}
            </select>
          </div>
          <div>
            <label class="db-label" for="f-platform">Platform</label>
            <input id="f-platform" class="db-input" type="text" placeholder="ESPN, Yahoo, Sleeper…" bind:value={form.platform} />
          </div>
          <div>
            <label class="db-label" for="f-commissioner">Commissioner</label>
            <input id="f-commissioner" class="db-input" type="text" bind:value={form.commissioner_name} />
          </div>
          <div>
            <label class="db-label" for="f-name">League name</label>
            <input id="f-name" class="db-input" type="text" bind:value={form.league_name} />
          </div>
          <div>
            <label class="db-label" for="f-winner">Champion</label>
            <input id="f-winner" class="db-input" type="text" placeholder="(when season ends)" bind:value={form.winner} />
          </div>
        </div>

        <div style="margin-bottom:12px">
          <label class="db-label" for="f-url">League URL</label>
          <input id="f-url" class="db-input" type="url" bind:value={form.url} style="width:100%;box-sizing:border-box" />
        </div>

        <div class="form-grid-2" style="margin-bottom:20px">
          <div>
            <label class="db-label" for="f-sort">Sort order</label>
            <input id="f-sort" class="db-input" type="number" bind:value={form.sort_order} min="0" />
          </div>
          <div>
            <label class="db-label" for="f-expires">Expiration date</label>
            <input id="f-expires" class="db-input" type="date" bind:value={form.expiration_date} />
          </div>
        </div>

        <div style="display:flex;gap:8px">
          <button class="db-btn primary" onclick={saveLeague} disabled={saving}>
            {saving ? 'Saving…' : 'Save →'}
          </button>
          <button class="db-btn" onclick={cancelForm}>Cancel</button>
        </div>
      </div>
    {/if}

    <!-- Active leagues -->
    {#if activeLeagues.length === 0 && archivedLeagues.length === 0}
      <div class="db-card" style="padding:40px;text-align:center;color:var(--fg-3)">
        No leagues yet.
      </div>
    {:else}
      {#if activeLeagues.length > 0}
        <div class="leagues-grid" style="margin-bottom:36px">
          {#each activeLeagues as league (league.id)}
            <div class="league-card db-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <span style="font-size:20px">{sportIcons[league.sport] ?? '🏆'}</span>
                  <span class="sport-badge">{league.sport}</span>
                  <span class="platform-badge">{league.platform}</span>
                </div>
              </div>

              <div style="font-weight:900;font-size:19px;line-height:1.2;margin-bottom:8px">{league.league_name}</div>

              <div class="commissioner-pill">
                <span class="crown-icon">🎩</span>
                <span>{league.commissioner_name}</span>
              </div>

              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px">
                <a href={league.url} target="_blank" rel="noopener noreferrer"
                   class="db-btn primary" style="font-size:12px;text-decoration:none;display:inline-flex;align-items:center">
                  Visit league →
                </a>
                {#if editMode}
                  <button class="db-btn" style="font-size:12px" onclick={() => startEdit(league)}>Edit</button>
                  <button class="db-btn" style="font-size:12px;color:var(--bad)" onclick={() => deleteLeague(league.id)}>Delete</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Archived / Previous leagues -->
      {#if archivedLeagues.length > 0 || (editMode && archivedLeagues.length === 0)}
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--fg-3);margin-bottom:14px">
            Previous Leagues
          </div>
          <div class="leagues-grid">
            {#each archivedLeagues as league (league.id)}
              <div class="league-card db-card archived-card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <span style="font-size:18px">{sportIcons[league.sport] ?? '🏆'}</span>
                    <span class="sport-badge">{league.sport}</span>
                    <span class="platform-badge">{league.platform}</span>
                  </div>
                  <span class="finished-badge">Finished</span>
                </div>

                <div style="font-weight:800;font-size:16px;line-height:1.2;margin-bottom:6px;color:var(--fg-2)">{league.league_name}</div>

                <div class="commissioner-pill commissioner-pill--sm">
                  <span class="crown-icon">🎩</span>
                  <span>{league.commissioner_name}</span>
                </div>

                {#if league.winner}
                  <div class="winner-banner">
                    <span class="trophy">🥇</span>
                    <div>
                      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;opacity:.7">Champion</div>
                      <div style="font-weight:900;font-size:15px;line-height:1.1">{league.winner}</div>
                    </div>
                  </div>
                {/if}

                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px">
                  <a href={league.url} target="_blank" rel="noopener noreferrer"
                     class="db-btn" style="font-size:12px;text-decoration:none;display:inline-flex;align-items:center">
                    View archive →
                  </a>
                  {#if editMode}
                    <button class="db-btn" style="font-size:12px" onclick={() => startEdit(league)}>Edit</button>
                    <button class="db-btn" style="font-size:12px;color:var(--bad)" onclick={() => deleteLeague(league.id)}>Delete</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}

  </div>
</div>

<style>
  .leagues-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 16px;
  }
  .league-card {
    padding: 20px;
  }
  .archived-card {
    opacity: 0.75;
    transition: opacity 0.2s;
  }
  .archived-card:hover {
    opacity: 1;
  }
  .form-card {
    padding: 22px;
    border: 2px solid var(--accent);
  }
  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 500px) {
    .form-grid-2 { grid-template-columns: 1fr; }
  }
  .sport-badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 15%, var(--bg-2));
    padding: 2px 8px;
    border-radius: 999px;
  }
  .platform-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-2);
    background: var(--bg-3);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .commissioner-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 700;
    color: var(--fg-1);
    background: var(--bg-3);
    padding: 4px 10px 4px 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }
  .commissioner-pill--sm {
    font-size: 11px;
    padding: 3px 8px 3px 5px;
  }
  .crown-icon {
    font-size: 13px;
    line-height: 1;
  }
  .finished-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-3);
    background: var(--bg-3);
    padding: 2px 7px;
    border-radius: 999px;
  }
  .winner-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding: 10px 14px;
    background: color-mix(in srgb, #f5a623 12%, var(--bg-2));
    border: 1px solid color-mix(in srgb, #f5a623 35%, transparent);
    border-radius: 10px;
    color: #f5a623;
  }
  .trophy {
    font-size: 24px;
    line-height: 1;
    flex-shrink: 0;
  }
</style>

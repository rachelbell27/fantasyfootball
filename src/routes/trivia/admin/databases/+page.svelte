<script>
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  // Add database form
  let showAddForm = $state(false);
  let addName = $state('');
  let addSlug = $state('');
  let addDescription = $state('');
  let addLeagueId = $state('');
  let addError = $state('');
  let addSaving = $state(false);

  // Import panel state
  let importDbId = $state(null);
  let importSeason = $state(new Date().getFullYear());
  let importStatus = $state('');
  let importLoading = $state(false);

  // CSV import
  let csvFile = $state(null);
  let csvError = $state('');
  let csvLoading = $state(false);

  // Stats import
  let statsDbId = $state(null);
  let statsSeason = $state(new Date().getFullYear());
  let statsStatus = $state('');
  let statsLoading = $state(false);
  let statsProgress = $state({ done: 0, total: 0 });

  function slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  $effect(() => {
    if (addName && !addSlug) addSlug = slugify(addName);
  });

  async function addDatabase() {
    addError = '';
    if (!addName.trim() || !addSlug.trim()) {
      addError = 'Name and slug are required.';
      return;
    }
    addSaving = true;
    try {
      const res = await fetch('/api/trivia/admin/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim(),
          slug: addSlug.trim(),
          description: addDescription.trim(),
          api_league_id: addLeagueId ? Number(addLeagueId) : null
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      addName = ''; addSlug = ''; addDescription = ''; addLeagueId = '';
      showAddForm = false;
      await invalidateAll();
    } catch (err) {
      addError = err.message;
    } finally {
      addSaving = false;
    }
  }

  async function deleteDatabase(db) {
    if (!confirm(`Delete "${db.name}" and all its players? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/trivia/admin/databases?id=${db.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await invalidateAll();
    } catch (err) {
      alert(err.message);
    }
  }

  async function importFromEspn(db) {
    importDbId = db.id;
    importStatus = 'Importing… (may take 10–20 seconds)';
    importLoading = true;
    try {
      const res = await fetch('/api/trivia/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseId: db.id, importType: 'espn', season: importSeason })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? `Error ${res.status}`);
      importStatus = `Done — ${result.teams ?? 0} teams, ${result.inserted} new players, ${result.updated} updated, ${result.rosterRows ?? 0} roster entries.`;
      await invalidateAll();
    } catch (err) {
      importStatus = `Error: ${err.message}`;
    } finally {
      importLoading = false;
    }
  }

  async function importStats(db) {
    statsDbId = db.id;
    statsStatus = 'Starting stats import…';
    statsLoading = true;
    statsProgress = { done: 0, total: 0 };

    let offset = 0;
    const limit = 40;
    let totalUpdated = 0;

    try {
      while (true) {
        const res = await fetch('/api/trivia/admin/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: db.id,
            importType: 'espn-stats',
            season: statsSeason,
            offset,
            limit
          })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message ?? `Error ${res.status}`);

        totalUpdated += result.updated;
        statsProgress = { done: result.nextOffset, total: result.total };
        statsStatus = `Importing… ${result.nextOffset}/${result.total} players`;

        if (!result.hasMore) break;
        offset = result.nextOffset;
      }
      statsStatus = `Done — stats imported for ${totalUpdated} players.`;
    } catch (err) {
      statsStatus = `Error: ${err.message}`;
    } finally {
      statsLoading = false;
    }
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

    const getCol = (row, name) => {
      const idx = headers.indexOf(name);
      if (idx === -1) return null;
      const raw = row[idx] ?? '';
      return raw.replace(/^"|"$/g, '').trim() || null;
    };

    return lines.slice(1).map(line => {
      // Simple CSV split (handles no-quote fields; doesn't handle embedded commas in quotes)
      const row = line.split(',');
      const aliasesRaw = getCol(row, 'aliases');
      const aliases = aliasesRaw ? aliasesRaw.split('|').map(a => a.trim()).filter(Boolean) : [];
      const teamsRaw = getCol(row, 'teams');
      const teams = teamsRaw ? teamsRaw.split('|').map(t => t.trim()).filter(Boolean) : [];
      const seasonsRaw = getCol(row, 'seasons');
      const seasons = seasonsRaw ? seasonsRaw.split('|').map(s => s.trim()).filter(Boolean) : [];
      const apiPlayerId = getCol(row, 'api_player_id');

      return {
        full_name: getCol(row, 'full_name') ?? '',
        aliases,
        api_player_id: apiPlayerId ? Number(apiPlayerId) : null,
        metadata: {
          position: getCol(row, 'position'),
          teams,
          seasons
        }
      };
    }).filter(p => p.full_name);
  }

  async function handleCSVImport(db) {
    if (!csvFile) { csvError = 'Select a file first.'; return; }
    csvError = '';
    csvLoading = true;
    try {
      const text = await csvFile.text();
      const players = parseCSV(text);
      if (players.length === 0) throw new Error('No valid players found in CSV.');

      const res = await fetch('/api/trivia/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseId: db.id, players })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? `Error ${res.status}`);
      csvError = `Done. Inserted: ${result.inserted}, Updated: ${result.updated}`;
      csvFile = null;
      await invalidateAll();
    } catch (err) {
      csvError = `Error: ${err.message}`;
    } finally {
      csvLoading = false;
    }
  }
</script>

<svelte:head><title>Databases Admin · down bad ↓</title></svelte:head>

<div class="db-page">
  <div class="page-header">
    <div>
      <a href="/trivia/admin" class="db-sub back-link">← Admin</a>
      <h1 class="db-h1">Player Databases</h1>
    </div>
    <button class="db-btn primary" onclick={() => { showAddForm = !showAddForm; }}>
      {showAddForm ? 'Cancel' : '+ Add database'}
    </button>
  </div>

  <!-- Add database form -->
  {#if showAddForm}
    <div class="db-card add-form">
      <h3 class="form-title">New database</h3>
      {#if addError}
        <div class="form-error">{addError}</div>
      {/if}
      <div class="form-grid">
        <label class="db-label" for="add-name">Name</label>
        <input id="add-name" class="db-input" type="text" bind:value={addName} placeholder="NFL" />

        <label class="db-label" for="add-slug">Slug</label>
        <input id="add-slug" class="db-input" type="text" bind:value={addSlug} placeholder="nfl" />

        <label class="db-label" for="add-desc">Description</label>
        <input id="add-desc" class="db-input" type="text" bind:value={addDescription} placeholder="Optional" />

        <label class="db-label" for="add-league">API League ID (optional)</label>
        <input id="add-league" class="db-input" type="number" bind:value={addLeagueId} placeholder="1" />
      </div>
      <div class="form-actions">
        <button class="db-btn" onclick={() => { showAddForm = false; addError = ''; }}>Cancel</button>
        <button class="db-btn primary" onclick={addDatabase} disabled={addSaving}>
          {addSaving ? 'Saving…' : 'Add database'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Databases list -->
  {#each data.databases as db}
    <div class="db-card database-card">
      <div class="db-header-row">
        <div class="db-info">
          <h2 class="db-name">{db.name}</h2>
          <span class="db-slug db-sub">{db.slug}</span>
          {#if db.api_league_id}
            <span class="db-pill">League ID: {db.api_league_id}</span>
          {/if}
          <span class="player-count db-sub">{db.team_count ?? 0} teams · {db.player_count} player{db.player_count !== 1 ? 's' : ''}</span>
        </div>
        <button class="db-btn danger" onclick={() => deleteDatabase(db)}>Delete</button>
      </div>

      {#if db.description}
        <p class="db-desc db-sub">{db.description}</p>
      {/if}

      <div class="import-section">
        <h4 class="import-heading">Import players</h4>

        <!-- CSV import -->
        <div class="import-block">
          <p class="import-label db-sub">CSV import</p>
          <p class="import-hint db-sub" style="font-size:11px">
            Columns: full_name, aliases (pipe-sep), position, teams (pipe-sep), seasons (pipe-sep), api_player_id
          </p>
          <div class="import-row">
            <input
              class="db-input file-input"
              type="file"
              accept=".csv"
              onchange={e => { csvFile = e.target.files[0]; }}
            />
            <button
              class="db-btn"
              onclick={() => handleCSVImport(db)}
              disabled={csvLoading || !csvFile}
            >
              {csvLoading ? 'Importing…' : 'Import CSV'}
            </button>
          </div>
          {#if csvError}
            <p class="import-status" class:error={csvError.startsWith('Error')}>{csvError}</p>
          {/if}
        </div>

        <!-- ESPN roster import -->
        <div class="import-block">
          <p class="import-label db-sub">ESPN import (free, no key needed)</p>
          <p class="import-hint db-sub" style="font-size:11px">
            Imports teams + rosters for one season. NFL uses ESPN's core API (season-accurate).
            College football uses current rosters. One season at a time.
          </p>
          <div class="import-row">
            <input
              class="db-input season-input"
              type="number"
              bind:value={importSeason}
              min="2000"
              max="2099"
              placeholder="Season year"
            />
            <button
              class="db-btn primary"
              onclick={() => { importDbId = db.id; importFromEspn(db); }}
              disabled={importLoading && importDbId === db.id}
            >
              {importLoading && importDbId === db.id ? 'Importing…' : 'Import from ESPN →'}
            </button>
          </div>
          {#if importStatus && importDbId === db.id}
            <p class="import-status" class:error={importStatus.startsWith('Error')}>{importStatus}</p>
          {/if}
        </div>

        <!-- ESPN stats import -->
        <div class="import-block">
          <p class="import-label db-sub">ESPN stats import</p>
          <p class="import-hint db-sub" style="font-size:11px">
            Fetches season stats (passing, rushing, receiving, etc.) for each rostered player.
            Run after roster import. Takes ~1–2 min for NFL.
          </p>
          <div class="import-row">
            <input
              class="db-input season-input"
              type="number"
              bind:value={statsSeason}
              min="2000"
              max="2099"
              placeholder="Season year"
            />
            <button
              class="db-btn"
              onclick={() => importStats(db)}
              disabled={statsLoading && statsDbId === db.id}
            >
              {statsLoading && statsDbId === db.id ? 'Importing…' : 'Import Stats →'}
            </button>
          </div>
          {#if statsStatus && statsDbId === db.id}
            {#if statsLoading && statsProgress.total > 0}
              <div class="stats-progress">
                <div class="stats-bar" style="width: {Math.round(statsProgress.done / statsProgress.total * 100)}%"></div>
              </div>
            {/if}
            <p class="import-status" class:error={statsStatus.startsWith('Error')}>{statsStatus}</p>
          {/if}
        </div>
      </div>
    </div>
  {/each}

  {#if data.databases.length === 0}
    <div class="db-card empty-state">
      <p class="db-sub">No databases yet. Add one above.</p>
    </div>
  {/if}
</div>

<style>
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .back-link {
    display: block;
    margin-bottom: 4px;
    text-decoration: none;
    color: var(--ink-soft);
  }

  .add-form {
    padding: 24px;
    margin-bottom: 20px;
  }

  .form-title {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 14px;
  }

  .form-error {
    background: color-mix(in srgb, var(--bad) 12%, var(--card));
    border: 1px solid var(--bad);
    color: var(--bad);
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 12px;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .database-card {
    padding: 20px;
    margin-bottom: 16px;
  }

  .db-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 8px;
  }

  .db-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .db-name {
    font-size: 18px;
    font-weight: 800;
    margin: 0;
  }

  .db-slug {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .player-count {
    font-size: 12px;
  }

  .db-desc {
    margin: 0 0 16px;
    font-size: 13px;
  }

  .import-section {
    border-top: 1px solid var(--line);
    padding-top: 16px;
    margin-top: 8px;
  }

  .import-heading {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-soft);
    margin: 0 0 12px;
  }

  .import-block {
    margin-bottom: 16px;
  }

  .import-label {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .import-hint {
    margin-bottom: 8px;
    font-family: var(--font-mono);
  }

  .import-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .file-input {
    flex: 1;
    min-width: 200px;
    padding: 8px 12px;
    font-size: 13px;
  }

  .season-input {
    width: 120px;
    flex-shrink: 0;
  }

  .import-status {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--good);
  }

  .import-status.error {
    color: var(--bad);
  }

  .stats-progress {
    margin-top: 8px;
    height: 4px;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
  }

  .stats-bar {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .empty-state {
    text-align: center;
    padding: 48px;
  }

  :global(.db-btn.danger) {
    border-color: var(--bad);
    color: var(--bad);
  }

  :global(.db-btn.danger:hover) {
    background: color-mix(in srgb, var(--bad) 12%, var(--card));
  }
</style>

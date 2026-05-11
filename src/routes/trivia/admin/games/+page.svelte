<script>
  import { invalidateAll } from '$app/navigation';
  import { STAT_FIELDS } from '$lib/trivia-stats.js';

  let { data } = $props();

  // ── Form state ──────────────────────────────────────────────────────────────
  let showForm = $state(false);
  let editingGame = $state(null);

  let formTitle = $state('');
  let formPrompt = $state('');
  let formSlug = $state('');
  let formTimeLimit = $state(180);
  let formDatabaseIds = $state([]);
  let formPublished = $state(false);
  // New config fields
  let formHintType = $state('blank');
  let formHintStatField = $state('');
  let formSearchDisplayFields = $state([]);

  let saving = $state(false);
  let formError = $state('');

  const HINT_OPTIONS = [
    { value: 'blank',           label: 'Blank' },
    { value: 'team_logo',       label: 'Team Logo' },
    { value: 'team_name',       label: 'Team Name' },
    { value: 'player_name',     label: 'Player Name' },
    { value: 'player_headshot', label: 'Player Headshot' },
    { value: 'stat_line',       label: 'Stat Line' },
  ];

  const SEARCH_DISPLAY_OPTIONS = [
    { value: 'position', label: 'Show Position' },
    { value: 'college',  label: 'Show College' },
    { value: 'teams',    label: 'Show NFL Team(s)' },
  ];

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  }

  $effect(() => {
    if (!editingGame && formTitle && !formSlug) formSlug = slugify(formTitle);
  });

  function openCreate() {
    editingGame = null;
    formTitle = ''; formPrompt = ''; formSlug = '';
    formTimeLimit = 180; formDatabaseIds = []; formPublished = false;
    formHintType = 'blank'; formHintStatField = ''; formSearchDisplayFields = [];
    formError = '';
    showForm = true;
  }

  function openEdit(game) {
    editingGame = game;
    formTitle = game.title; formPrompt = game.prompt; formSlug = game.slug;
    formTimeLimit = game.time_limit_seconds; formDatabaseIds = game.database_ids ?? [];
    formPublished = game.published;
    formHintType = game.hint_type ?? 'blank';
    formHintStatField = game.hint_stat_field ?? '';
    formSearchDisplayFields = game.search_display_fields ?? [];
    formError = '';
    showForm = true;
  }

  function closeForm() { showForm = false; editingGame = null; }

  function toggleDatabase(dbId) {
    formDatabaseIds = formDatabaseIds.includes(dbId)
      ? formDatabaseIds.filter(id => id !== dbId)
      : [...formDatabaseIds, dbId];
  }

  function toggleSearchField(val) {
    formSearchDisplayFields = formSearchDisplayFields.includes(val)
      ? formSearchDisplayFields.filter(f => f !== val)
      : [...formSearchDisplayFields, val];
  }

  async function saveGame() {
    formError = '';
    if (!formTitle.trim() || !formPrompt.trim() || !formSlug.trim()) {
      formError = 'Title, prompt, and slug are required.';
      return;
    }
    saving = true;
    try {
      const payload = {
        title: formTitle.trim(),
        prompt: formPrompt.trim(),
        slug: formSlug.trim(),
        time_limit_seconds: Number(formTimeLimit),
        database_ids: formDatabaseIds,
        hint_fields: [],
        published: formPublished,
        hint_type: formHintType,
        search_display_fields: formSearchDisplayFields,
        hint_stat_field: formHintType === 'stat_line' ? (formHintStatField || null) : null,
      };

      const res = editingGame
        ? await fetch(`/api/trivia/admin/games?id=${editingGame.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch('/api/trivia/admin/games', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Server error ${res.status}`);
      }
      await invalidateAll();
      closeForm();
    } catch (err) {
      formError = err.message;
    } finally {
      saving = false;
    }
  }

  async function deleteGame(game) {
    if (!confirm(`Delete "${game.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/trivia/admin/games?id=${game.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await invalidateAll();
    } catch (err) { alert(err.message); }
  }

  async function togglePublish(game) {
    try {
      const res = await fetch(`/api/trivia/admin/games?id=${game.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !game.published }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await invalidateAll();
    } catch (err) { alert(err.message); }
  }

  // ── Answer builder ─────────────────────────────────────────────────────────
  let answerGameId = $state(null);
  let answerGame = $state(null);   // full game object (has hint_type etc.)
  let gameAnswers = $state([]);
  let answerError = $state('');

  // SQL fill
  let showSqlFill = $state(false);
  let sqlQuery = $state('');
  let sqlRunning = $state(false);
  let sqlResult = $state(null);
  let sqlError = $state('');

  // Player search
  let searchQuery = $state('');
  let searchResults = $state([]);
  let searchLoading = $state(false);
  let searchTimer = null;

  $effect(() => {
    if (!answerGameId) return;
    if (searchQuery.length < 3) { searchResults = []; return; }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      searchLoading = true;
      try {
        const dbParam = answerGame?.database_ids?.length
          ? `&dbs=${answerGame.database_ids.join(',')}`
          : '';
        const res = await fetch(`/api/trivia/admin/players?q=${encodeURIComponent(searchQuery)}${dbParam}`);
        if (res.ok) searchResults = await res.json();
      } catch (e) { console.error(e); } finally { searchLoading = false; }
    }, 300);
    return () => clearTimeout(searchTimer);
  });

  async function openAnswerBuilder(game) {
    answerGameId = game.id;
    answerGame = game;
    searchQuery = ''; searchResults = []; answerError = '';
    try {
      const res = await fetch(`/api/trivia/admin/game-answers?gameId=${game.id}`);
      if (res.ok) gameAnswers = await res.json();
    } catch (e) { gameAnswers = []; }
  }

  function closeAnswerBuilder() {
    answerGameId = null; answerGame = null; gameAnswers = [];
    sqlQuery = ''; sqlResult = null; sqlError = ''; showSqlFill = false;
  }

  async function addAnswerToGame(player) {
    if (gameAnswers.find(a => a.player_id === player.id)) return;
    answerError = '';
    try {
      const hintType = answerGame?.hint_type ?? 'blank';
      const hintData = {};

      if (hintType === 'team_logo' || hintType === 'team_name') {
        const teams = player.teams ?? [];
        if (teams.length >= 1) hintData.display_team_id = teams[0].id;
      }

      const res = await fetch('/api/trivia/admin/game-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: answerGameId, playerId: player.id, hintData, sortOrder: gameAnswers.length }),
      });
      if (!res.ok) throw new Error('Failed to add');
      const added = await res.json();
      gameAnswers = [...gameAnswers, {
        ...added,
        full_name: player.full_name,
        player_teams: player.teams ?? [],
        stat_preview: null,
        headshot_url: player.headshot_url,
      }];
    } catch (err) { answerError = err.message; }
  }

  async function removeAnswerFromGame(answerId) {
    try {
      const res = await fetch(`/api/trivia/admin/game-answers?id=${answerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      gameAnswers = gameAnswers.filter(a => a.id !== answerId);
    } catch (err) { answerError = err.message; }
  }

  async function setAnswerTeam(answer, teamId, allTeams = false) {
    try {
      const hintData = allTeams
        ? { ...answer.hint_data, display_all_teams: true, display_team_id: undefined }
        : { ...answer.hint_data, display_team_id: teamId, display_all_teams: undefined };
      const res = await fetch(`/api/trivia/admin/game-answers?id=${answer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hintData }),
      });
      if (!res.ok) throw new Error('Failed to update team');
      const updated = await res.json();
      gameAnswers = gameAnswers.map(a => a.id === answer.id
        ? { ...a, hint_data: updated.hint_data }
        : a
      );
    } catch (err) { answerError = err.message; }
  }

  async function moveAnswer(index, dir) {
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= gameAnswers.length) return;
    const next = [...gameAnswers];
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    next.forEach((a, i) => { next[i] = { ...a, sort_order: i }; });
    gameAnswers = next;
    await Promise.all([
      fetch(`/api/trivia/admin/game-answers?id=${next[index].id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: next[index].sort_order }),
      }),
      fetch(`/api/trivia/admin/game-answers?id=${next[swapIdx].id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: next[swapIdx].sort_order }),
      }),
    ]);
  }

  async function runSqlFill() {
    sqlError = ''; sqlResult = null; sqlRunning = true;
    try {
      const res = await fetch('/api/trivia/admin/sql-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: answerGameId, sql: sqlQuery }),
      });
      const data = await res.json();
      if (!res.ok) { sqlError = data.message ?? `Error ${res.status}`; return; }
      sqlResult = data;
      if (data.added.length > 0) gameAnswers = [...gameAnswers, ...data.added];
    } catch (e) { sqlError = e.message; } finally { sqlRunning = false; }
  }
</script>

<svelte:head><title>Games Admin · down bad ↓</title></svelte:head>

<div class="db-page">
  <div class="page-header">
    <div>
      <a href="/trivia/admin" class="db-sub back-link">← Admin</a>
      <h1 class="db-h1">Trivia Games</h1>
    </div>
    <button class="db-btn primary" onclick={openCreate}>+ New game</button>
  </div>

  <!-- Games table -->
  {#if data.games.length === 0}
    <div class="db-card empty-state">
      <p class="db-sub">No games yet. Create one to get started.</p>
    </div>
  {:else}
    <div class="games-table db-card">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Hint</th>
            <th class="center">Answers</th>
            <th class="center">Published</th>
            <th class="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.games as game}
            <tr>
              <td>
                <div class="game-title-cell">{game.title}</div>
                <div class="game-prompt-cell db-sub">{game.prompt.slice(0, 60)}{game.prompt.length > 60 ? '…' : ''}</div>
              </td>
              <td class="mono">{game.slug}</td>
              <td><span class="hint-chip">{game.hint_type ?? 'blank'}</span></td>
              <td class="center">{game.answer_count}</td>
              <td class="center">
                <button
                  class="publish-toggle"
                  class:published={game.published}
                  onclick={() => togglePublish(game)}
                >{game.published ? 'Live' : 'Draft'}</button>
              </td>
              <td class="right actions-cell">
                <button class="db-btn sm" onclick={() => openAnswerBuilder(game)}>Answers</button>
                <button class="db-btn sm" onclick={() => openEdit(game)}>Edit</button>
                <button class="db-btn sm danger" onclick={() => deleteGame(game)}>Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Create/Edit form -->
  {#if showForm}
    <div class="modal-overlay" onclick={closeForm}>
      <div class="modal-panel db-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">{editingGame ? 'Edit game' : 'New game'}</h2>
          <button class="close-btn" onclick={closeForm} aria-label="Close">✕</button>
        </div>

        {#if formError}<div class="form-error">{formError}</div>{/if}

        <div class="form-grid">
          <label class="db-label" for="form-title">Title</label>
          <input id="form-title" class="db-input" type="text" bind:value={formTitle} placeholder="e.g. 2023 Super Bowl Roster" />

          <label class="db-label" for="form-prompt">Prompt</label>
          <textarea id="form-prompt" class="db-input form-textarea" bind:value={formPrompt} placeholder="e.g. Name every player who appeared in Super Bowl LVIII."></textarea>

          <label class="db-label" for="form-slug">Slug</label>
          <input id="form-slug" class="db-input" type="text" bind:value={formSlug} placeholder="super-bowl-lviii-roster" />

          <div class="form-row">
            <div class="form-field">
              <label class="db-label" for="form-time">Time limit (seconds)</label>
              <input id="form-time" class="db-input" type="number" bind:value={formTimeLimit} min="30" max="600" />
            </div>
            <div class="form-field check-field">
              <label class="db-label">
                <input type="checkbox" bind:checked={formPublished} /> Published
              </label>
            </div>
          </div>

          <label class="db-label">Databases</label>
          <div class="db-checkboxes">
            {#each data.databases as db}
              <label class="check-label">
                <input type="checkbox" checked={formDatabaseIds.includes(db.id)} onchange={() => toggleDatabase(db.id)} />
                {db.name}
              </label>
            {/each}
          </div>

          <!-- Search Autocomplete Settings -->
          <div class="config-section">
            <p class="config-heading">Search autocomplete settings</p>
            <div class="db-checkboxes">
              {#each SEARCH_DISPLAY_OPTIONS as opt}
                <label class="check-label">
                  <input
                    type="checkbox"
                    checked={formSearchDisplayFields.includes(opt.value)}
                    onchange={() => toggleSearchField(opt.value)}
                  />
                  {opt.label}
                </label>
              {/each}
            </div>
          </div>

          <!-- Slot Hint Configuration -->
          <div class="config-section">
            <p class="config-heading">Slot hint type</p>
            <div class="hint-radios">
              {#each HINT_OPTIONS as opt}
                <label class="radio-label">
                  <input type="radio" name="hint-type" value={opt.value} bind:group={formHintType} />
                  {opt.label}
                </label>
              {/each}
            </div>
            {#if formHintType === 'stat_line'}
              <div class="stat-field-row">
                <label class="db-label" for="stat-field">Stat column</label>
                <select id="stat-field" class="db-input" bind:value={formHintStatField}>
                  <option value="">— choose —</option>
                  {#each STAT_FIELDS as sf}
                    <option value={sf.key}>{sf.label}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>
        </div>

        <div class="form-actions">
          <button class="db-btn" onclick={closeForm}>Cancel</button>
          <button class="db-btn primary" onclick={saveGame} disabled={saving}>
            {saving ? 'Saving…' : editingGame ? 'Save changes' : 'Create game'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Answer builder -->
  {#if answerGameId !== null}
    {@const hintType = answerGame?.hint_type ?? 'blank'}
    {@const showTeamSelector = hintType === 'team_logo' || hintType === 'team_name'}
    {@const showStatPreview = hintType === 'stat_line'}
    <div class="modal-overlay" onclick={closeAnswerBuilder}>
      <div class="modal-panel modal-wide db-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">Answers — {answerGame?.title}</h2>
          <button class="close-btn" onclick={closeAnswerBuilder} aria-label="Close">✕</button>
        </div>

        <div class="hint-type-badge">
          Hint type: <strong>{hintType}</strong>
          {#if answerGame?.hint_stat_field}<span class="db-sub"> · {answerGame.hint_stat_field}</span>{/if}
        </div>

        {#if answerError}<div class="form-error">{answerError}</div>{/if}

        <div class="answer-builder">
          <!-- Left: search -->
          <div class="answer-search-col">
            <label class="db-label" for="answer-search">Search players</label>
            <input
              id="answer-search"
              class="db-input"
              type="text"
              bind:value={searchQuery}
              placeholder="Type 3+ chars…"
            />

            {#if searchLoading}
              <p class="db-sub">Searching…</p>
            {:else if searchResults.length > 0}
              <div class="search-results">
                {#each searchResults as player}
                  <div class="search-result-row">
                    <div class="result-info">
                      <span class="result-name">{player.full_name}</span>
                      <span class="result-db db-sub">{player.database_name}</span>
                    </div>
                    <button
                      class="db-btn sm"
                      onclick={() => addAnswerToGame(player)}
                      disabled={gameAnswers.some(a => a.player_id === player.id)}
                    >{gameAnswers.some(a => a.player_id === player.id) ? 'Added' : 'Add'}</button>
                  </div>
                {/each}
              </div>
            {:else if searchQuery.length >= 3}
              <p class="db-sub">No results.</p>
            {/if}
          </div>

          <!-- Right: answer list -->
          <div class="answer-list-col">
            <p class="db-label">Current answers ({gameAnswers.length})</p>
            {#if gameAnswers.length === 0}
              <p class="db-sub">No answers yet.</p>
            {:else}
              <div class="answer-list">
                {#each gameAnswers as answer, i}
                  <div class="answer-item-wrap">
                    <div class="answer-item">
                      <div class="sort-btns">
                        <button class="sort-btn" onclick={() => moveAnswer(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                        <button class="sort-btn" onclick={() => moveAnswer(i, 1)} disabled={i === gameAnswers.length - 1} aria-label="Move down">↓</button>
                      </div>
                      <span class="answer-num">{i + 1}.</span>
                      <span class="answer-name">{answer.full_name ?? '?'}</span>
                      {#if showStatPreview && answer.stat_preview != null}
                        <span class="stat-preview db-sub">{Number(answer.stat_preview).toLocaleString()}</span>
                      {/if}
                      <button class="db-btn sm danger" onclick={() => removeAnswerFromGame(answer.id)} aria-label="Remove">✕</button>
                    </div>

                    <!-- Team selector for team_logo / team_name — only when player has multiple distinct teams -->
                    {#if showTeamSelector && (answer.player_teams?.length ?? 0) > 1}
                      <div class="team-selector">
                        {#each answer.player_teams as team}
                          <label class="team-radio-label">
                            <input
                              type="radio"
                              name="team-{answer.id}"
                              value={team.id}
                              checked={answer.hint_data?.display_team_id === team.id}
                              onchange={() => setAnswerTeam(answer, team.id)}
                            />
                            {#if team.logo_url}
                              <img src={team.logo_url} alt={team.display_name} class="team-thumb" />
                            {/if}
                            <span>{team.display_name}</span>
                          </label>
                        {/each}
                        <label class="team-radio-label">
                          <input
                            type="radio"
                            name="team-{answer.id}"
                            value="all"
                            checked={answer.hint_data?.display_all_teams === true}
                            onchange={() => setAnswerTeam(answer, null, true)}
                          />
                          <span>Show all</span>
                        </label>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- SQL fill -->
        <div class="sql-fill-section">
          <button class="sql-toggle" onclick={() => { showSqlFill = !showSqlFill; sqlResult = null; sqlError = ''; }}>
            {showSqlFill ? '▾' : '▸'} Fill from SQL SELECT
          </button>
          {#if showSqlFill}
            <div class="sql-fill-body">
              <p class="db-sub sql-hint">Write a SELECT that returns an <code>id</code> column from <code>trivia_players</code>. Only SELECT is allowed — no writes.</p>
              <textarea
                class="db-input sql-input"
                bind:value={sqlQuery}
                placeholder="SELECT id FROM trivia_players WHERE college = 'Alabama'"
                rows="4"
              ></textarea>
              {#if sqlError}<div class="form-error">{sqlError}</div>{/if}
              {#if sqlResult}
                <p class="sql-result">
                  Added {sqlResult.added.length}
                  {#if sqlResult.skipped > 0} · {sqlResult.skipped} already in game{/if}
                  {#if sqlResult.notFound > 0} · {sqlResult.notFound} not found in databases{/if}
                </p>
              {/if}
              <button class="db-btn primary sm" onclick={runSqlFill} disabled={sqlRunning || !sqlQuery.trim()}>
                {sqlRunning ? 'Running…' : 'Run query'}
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
  }
  .back-link { display: block; margin-bottom: 4px; text-decoration: none; color: var(--ink-soft); }

  .games-table { padding: 0; overflow: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--line); }
  th {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--ink-soft); background: var(--bg-2);
  }
  tr:last-child td { border-bottom: none; }
  .center { text-align: center; }
  .right { text-align: right; }
  .mono { font-family: var(--font-mono); font-size: 12px; }

  .game-title-cell { font-weight: 700; font-size: 14px; }
  .game-prompt-cell { font-size: 12px; margin-top: 2px; }

  .hint-chip {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; background: var(--bg-2); color: var(--ink-soft);
    padding: 2px 7px; border-radius: 4px;
  }

  .publish-toggle {
    font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
    border: 1.5px solid var(--line); background: var(--bg-2); color: var(--ink-soft); cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .publish-toggle.published {
    border-color: var(--good); color: var(--good);
    background: color-mix(in srgb, var(--good) 10%, var(--bg-2));
  }

  .actions-cell { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
  .empty-state { text-align: center; padding: 48px; }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 16px; z-index: 100; overflow-y: auto;
  }
  .modal-panel { width: 100%; max-width: 580px; border-radius: 16px; padding: 28px; }
  .modal-wide { max-width: 860px; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .modal-title { font-size: 18px; font-weight: 800; margin: 0; }
  .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--ink-soft); padding: 4px 8px; border-radius: 6px; }
  .close-btn:hover { color: var(--ink); background: var(--bg-2); }

  .form-error {
    background: color-mix(in srgb, var(--bad) 12%, var(--card));
    border: 1px solid var(--bad); color: var(--bad);
    padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
  }
  .form-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .form-textarea { min-height: 80px; resize: vertical; }
  .form-row { display: flex; gap: 12px; align-items: flex-end; }
  .form-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .check-field { flex: 0; white-space: nowrap; padding-bottom: 10px; }
  .db-checkboxes { display: flex; gap: 12px; flex-wrap: wrap; }
  .check-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .form-actions { display: flex; gap: 10px; justify-content: flex-end; }

  /* Config sections */
  .config-section {
    border: 1px solid var(--line); border-radius: 10px;
    padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
  }
  .config-heading {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--ink-soft); margin: 0;
  }
  .hint-radios { display: flex; flex-wrap: wrap; gap: 8px; }
  .radio-label { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .stat-field-row { display: flex; flex-direction: column; gap: 4px; }

  /* Answer builder */
  .hint-type-badge {
    font-size: 12px; background: var(--bg-2); padding: 6px 10px;
    border-radius: 7px; margin-bottom: 16px; color: var(--ink-soft);
  }
  .answer-builder { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 600px) { .answer-builder { grid-template-columns: 1fr; } }
  .answer-search-col, .answer-list-col { display: flex; flex-direction: column; gap: 10px; }

  .search-results {
    display: flex; flex-direction: column; gap: 4px;
    max-height: 320px; overflow-y: auto;
    border: 1px solid var(--line); border-radius: 8px; padding: 4px;
  }
  .search-result-row {
    display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px;
  }
  .search-result-row:hover { background: var(--bg-2); }
  .result-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .result-name { font-size: 13px; font-weight: 600; }
  .result-db { font-size: 11px; }

  .answer-list {
    display: flex; flex-direction: column; gap: 2px;
    max-height: 420px; overflow-y: auto;
    border: 1px solid var(--line); border-radius: 8px; padding: 4px;
  }
  .answer-item-wrap { border-radius: 6px; }
  .answer-item-wrap:hover { background: var(--bg-2); }
  .answer-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; }
  .answer-num { font-size: 11px; color: var(--ink-soft); width: 20px; flex-shrink: 0; }
  .answer-name { flex: 1; font-size: 13px; font-weight: 600; }
  .stat-preview { font-size: 12px; font-weight: 700; color: var(--accent); flex-shrink: 0; }

  /* Sort buttons */
  .sort-btns { display: flex; flex-direction: column; gap: 0; flex-shrink: 0; }
  .sort-btn {
    background: none; border: none; cursor: pointer; padding: 0 3px; line-height: 1.2;
    font-size: 11px; color: var(--ink-soft);
  }
  .sort-btn:hover:not(:disabled) { color: var(--ink); }
  .sort-btn:disabled { opacity: 0.2; cursor: default; }

  /* Team selector */
  .team-selector {
    padding: 6px 8px 8px 44px;
    display: flex; flex-direction: column; gap: 4px;
    border-top: 1px solid var(--line);
    margin-top: 0;
  }
  .team-radio-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .team-thumb { width: 20px; height: 20px; object-fit: contain; }

  /* SQL fill */
  .sql-fill-section {
    margin-top: 20px; border-top: 1px solid var(--line); padding-top: 14px;
  }
  .sql-toggle {
    background: none; border: none; cursor: pointer; padding: 4px 0;
    font-size: 13px; font-weight: 600; color: var(--ink-soft);
  }
  .sql-toggle:hover { color: var(--ink); }
  .sql-fill-body { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .sql-input { font-family: var(--font-mono, monospace); font-size: 12px; resize: vertical; }
  .sql-hint { font-size: 11px; margin: 0; }
  .sql-hint code { font-family: var(--font-mono, monospace); background: var(--bg-2); padding: 1px 4px; border-radius: 3px; }
  .sql-result { font-size: 12px; font-weight: 700; color: var(--good); margin: 0; }

  /* Global overrides */
  :global(.db-btn.sm) { padding: 4px 10px; font-size: 12px; height: auto; }
  :global(.db-btn.danger) { border-color: var(--bad); color: var(--bad); }
  :global(.db-btn.danger:hover) { background: color-mix(in srgb, var(--bad) 12%, var(--card)); }
</style>

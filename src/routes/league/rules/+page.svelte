<script>
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  const canEdit = $derived(!!(data.profile?.is_admin || data.profile?.is_commissioner));

  let editMode = $state(false);
  let editingId = $state(null);
  let editState = $state({});
  let saving = $state(false);
  let saveError = $state('');

  function startEdit(section) {
    editingId = section.id;
    saveError = '';
    editState[section.id] = {
      section_title: section.section_title,
      entries: section.entries.map(e => ({ ...e }))
    };
  }

  function cancelEdit() {
    editingId = null;
    saveError = '';
  }

  async function saveSection(id) {
    saving = true;
    saveError = '';
    try {
      const res = await fetch(`/api/rulebook/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editState[id])
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        saveError = err.message || 'Failed to save.';
        return;
      }
      editingId = null;
      await invalidateAll();
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head><title>Rules · The League · down bad ↓</title></svelte:head>

<div class="db-page">
  <div style="max-width:720px;margin:0 auto">

    <!-- Rulebook header -->
    <div class="rb-header">
      <div class="rb-eyebrow">Official League Rulebook — v1.3</div>
      <div class="rb-title">Down Bad for <em>Ghost</em></div>
      <div class="rb-subtitle">AKA "DOWN BAD" · FANTASY FOOTBALL LEAGUE</div>
      <div class="rb-meta">
        <div class="rb-meta-item"><span class="rb-meta-label">Format</span><span class="rb-meta-value">Redraft</span></div>
        <div class="rb-meta-item"><span class="rb-meta-label">Draft Style</span><span class="rb-meta-value">Snake Draft</span></div>
        <div class="rb-meta-item"><span class="rb-meta-label">Draft Window</span><span class="rb-meta-value">August / September</span></div>
        <div class="rb-meta-item"><span class="rb-meta-label">Entry Fee</span><span class="rb-meta-value">Free</span></div>
        <div class="rb-meta-item"><span class="rb-meta-label">Platform</span><span class="rb-meta-value">Sleeper</span></div>
      </div>
    </div>

    {#if canEdit}
      <div style="margin-bottom:24px">
        <button
          class="db-btn {editMode ? 'primary' : ''}"
          onclick={() => { editMode = !editMode; if (!editMode) { editingId = null; saveError = ''; } }}
          style="font-size:13px"
        >
          {editMode ? '✓ Done editing' : '✏ Edit rules'}
        </button>
      </div>
    {/if}

    {#if data.sections.length === 0}
      <div class="db-card" style="padding:40px;text-align:center;color:var(--fg-3)">
        Rules could not be loaded.
      </div>
    {/if}

    {#each data.sections as section (section.id)}
      <div class="rb-section">
        <div class="rb-section-header">
          <span class="rb-section-num">§ {section.section_num}</span>
          {#if editMode && editingId === section.id}
            <input
              class="db-input rb-title-input"
              bind:value={editState[section.id].section_title}
            />
          {:else}
            <h2 class="rb-section-title">{section.section_title}</h2>
          {/if}
          {#if editMode && editingId !== section.id}
            <button
              class="db-btn"
              style="font-size:12px;margin-left:auto;flex-shrink:0"
              onclick={() => startEdit(section)}
            >Edit</button>
          {/if}
        </div>

        {#if editMode && editingId === section.id}
          <div class="edit-panel">
            {#each editState[section.id].entries as entry}
              <div class="edit-entry">
                {#if entry.type === 'rule'}
                  <div class="edit-entry-row">
                    <span class="edit-key-badge">{entry.rule_key}</span>
                    <input class="db-input" bind:value={entry.title} placeholder="Rule title" style="flex:1;font-size:13px" />
                  </div>
                  <textarea class="db-input edit-body" bind:value={entry.body} rows="3"></textarea>
                {:else}
                  <div class="edit-entry-row">
                    <span class="edit-callout-badge" class:warning={entry.variant === 'warning'}>
                      {entry.variant === 'warning' ? '⚠' : entry.variant === 'highlight' ? '★' : '💬'}
                    </span>
                    <input class="db-input" bind:value={entry.label} placeholder="Label" style="flex:1;font-size:13px" />
                  </div>
                  <textarea class="db-input edit-body" bind:value={entry.body} rows="3"></textarea>
                {/if}
              </div>
            {/each}

            {#if saveError}
              <div style="color:var(--bad);font-size:13px">{saveError}</div>
            {/if}

            <div style="display:flex;gap:8px;margin-top:4px">
              <button class="db-btn primary" onclick={() => saveSection(section.id)} disabled={saving}>
                {saving ? 'Saving…' : 'Save →'}
              </button>
              <button class="db-btn" onclick={cancelEdit}>Cancel</button>
            </div>
          </div>
        {:else}
          {#each (section.entries ?? []) as entry}
            {#if entry.type === 'rule'}
              <div class="rb-rule">
                <span class="rb-rule-id">{entry.rule_key}</span>
                <div class="rb-rule-content">
                  <div class="rb-rule-title">{entry.title}</div>
                  <div class="rb-rule-body">{entry.body}</div>
                </div>
              </div>
            {:else if entry.type === 'callout'}
              <div class="rb-callout" class:warning={entry.variant === 'warning'}>
                <div class="rb-callout-label">{entry.label}</div>
                <p>{entry.body}</p>
              </div>
            {:else if entry.type === 'highlight'}
              <div class="rb-highlight">
                <div class="rb-highlight-label">{entry.label}</div>
                <p>{entry.body}</p>
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    {/each}

    <div class="rb-footer">
      <span>DOWN BAD FOR GHOST · RULEBOOK V1.3</span>
      <em>Good luck. You'll need it.</em>
    </div>

  </div>
</div>

<style>
  /* Header */
  .rb-header {
    margin-bottom: 40px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
  }
  .rb-eyebrow {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--accent);
    margin-bottom: 14px;
  }
  .rb-title {
    font-size: clamp(36px, 8vw, 64px);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--fg-1);
    margin-bottom: 8px;
  }
  .rb-title em {
    font-style: italic;
    color: var(--accent);
  }
  .rb-subtitle {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-3);
    margin-bottom: 24px;
  }
  .rb-meta {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  .rb-meta-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .rb-meta-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--fg-3);
  }
  .rb-meta-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-1);
  }

  /* Sections */
  .rb-section {
    margin-bottom: 48px;
  }
  .rb-section-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .rb-section-num {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--accent);
    flex-shrink: 0;
  }
  .rb-section-title {
    font-size: 20px;
    font-weight: 800;
    color: var(--fg-1);
    letter-spacing: -0.01em;
  }
  .rb-title-input {
    font-size: 16px;
    font-weight: 700;
    flex: 1;
  }

  /* Rules */
  .rb-rule {
    display: flex;
    gap: 20px;
    padding: 16px 0;
    border-bottom: 1px solid var(--bg-3);
  }
  .rb-rule:last-child { border-bottom: none; }
  .rb-rule-id {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--fg-3);
    min-width: 36px;
    padding-top: 2px;
    flex-shrink: 0;
  }
  .rb-rule-content { flex: 1; }
  .rb-rule-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 5px;
    letter-spacing: 0.02em;
  }
  .rb-rule-body {
    font-size: 13px;
    color: var(--fg-2);
    line-height: 1.65;
  }

  /* Callouts */
  .rb-callout {
    background: color-mix(in srgb, var(--accent) 6%, var(--bg-2));
    border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
    border-left: 3px solid var(--accent);
    padding: 16px 20px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .rb-callout.warning {
    background: color-mix(in srgb, var(--bad) 6%, var(--bg-2));
    border: 1px solid color-mix(in srgb, var(--bad) 20%, transparent);
    border-left: 3px solid var(--bad);
  }
  .rb-callout-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--accent);
    margin-bottom: 6px;
  }
  .rb-callout.warning .rb-callout-label { color: var(--bad); }
  .rb-callout p {
    font-size: 13px;
    color: var(--fg-2);
    line-height: 1.6;
  }

  /* Highlight */
  .rb-highlight {
    background: var(--accent);
    padding: 18px 22px;
    margin: 24px 0;
    border-radius: 4px;
  }
  .rb-highlight-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(0,0,0,0.45);
    margin-bottom: 6px;
  }
  .rb-highlight p {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.55;
    color: #0a0a0a;
  }

  /* Edit panel */
  .edit-panel {
    background: var(--bg-2);
    border: 2px solid var(--accent);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .edit-entry {
    background: var(--bg-3);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .edit-entry-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .edit-key-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--fg-3);
    background: var(--bg-2);
    padding: 2px 7px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .edit-callout-badge {
    font-size: 13px;
    flex-shrink: 0;
    width: 28px;
    text-align: center;
  }
  .edit-callout-badge.warning { color: var(--bad); }
  .edit-body {
    width: 100%;
    font-size: 13px;
    resize: vertical;
    line-height: 1.5;
  }

  /* Footer */
  .rb-footer {
    margin-top: 60px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--fg-3);
    letter-spacing: 0.08em;
  }
</style>

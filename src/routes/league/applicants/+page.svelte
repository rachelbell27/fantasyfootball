<script>
  import { slide, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  let { data } = $props();

  const TABS = [
    { key: 'pending',   label: 'Not Reviewed' },
    { key: 'in_review', label: 'In Review' },
    { key: 'approved',  label: 'Approved' },
    { key: 'rejected',  label: 'Rejected' },
  ];

  let activeTab    = $state('pending');
  let statusCounts = $state({ ...data.statusCounts });
  let tabCache     = $state({ pending: data.applicants });
  let loading      = $state(false);
  let loadError    = $state('');

  // Per-card state
  let savingNotes  = $state({});  // { [id]: true }
  let savedNotes   = $state({});  // { [id]: true } — fading confirmation
  let actionBusy   = $state({});  // { [id]: true }

  // Create account modal
  let inviteModal  = $state(null); // { id, name, email } | null
  let inviting     = $state(false);
  let inviteError  = $state('');
  let inviteDone   = $state({}); // { [id]: true }

  const applicants = $derived(tabCache[activeTab] ?? []);

  function count(key) {
    return statusCounts[key] ?? 0;
  }

  async function switchTab(key) {
    if (key === activeTab) return;
    activeTab = key;
    loadError = '';
    if (tabCache[key]) return; // already cached
    loading = true;
    try {
      const res = await fetch(`/api/league/applicants?status=${key}`);
      if (!res.ok) throw new Error(await res.text());
      tabCache = { ...tabCache, [key]: await res.json() };
    } catch (e) {
      loadError = 'Failed to load applicants. Try again.';
    } finally {
      loading = false;
    }
  }

  async function saveNotes(id, notes) {
    savingNotes = { ...savingNotes, [id]: true };
    try {
      const res = await fetch('/api/league/applicants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, admin_notes: notes }),
      });
      if (res.ok) {
        savedNotes = { ...savedNotes, [id]: true };
        setTimeout(() => {
          savedNotes = { ...savedNotes, [id]: false };
        }, 2000);
      }
    } finally {
      savingNotes = { ...savingNotes, [id]: false };
    }
  }

  async function setStatus(id, status) {
    actionBusy = { ...actionBusy, [id]: true };
    try {
      const res = await fetch('/api/league/applicants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) return;
      const { statusCounts: fresh } = await res.json();
      statusCounts = fresh;
      // Remove from current tab list
      tabCache = {
        ...tabCache,
        [activeTab]: (tabCache[activeTab] ?? []).filter(a => a.id !== id),
        // Invalidate destination tab so it reloads fresh
        [status]: undefined,
      };
    } finally {
      actionBusy = { ...actionBusy, [id]: false };
    }
  }

  async function sendInvite() {
    if (!inviteModal) return;
    inviting = true;
    inviteError = '';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inviteModal.name, email: inviteModal.email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        inviteError = body.message || 'Failed to send invite.';
        return;
      }
      inviteDone = { ...inviteDone, [inviteModal.id]: true };
      inviteModal = null;
    } finally {
      inviting = false;
    }
  }

  function platformList(platforms) {
    if (!platforms?.length) return '—';
    return platforms.join(', ');
  }
</script>

<svelte:head><title>Applications · The League · down bad ↓</title></svelte:head>

<div class="db-page">
  <div style="max-width:860px;margin:0 auto">

    <div style="margin-bottom:28px">
      <div class="db-card-h">Membership Applications</div>
      <p class="db-sub" style="margin-top:6px;font-size:13px">
        Review and manage league applicants. Notes and decisions are only visible here.
      </p>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      {#each TABS as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab.key}
          onclick={() => switchTab(tab.key)}
        >
          {tab.label}
          {#if count(tab.key) > 0}
            <span class="tab-badge" class:active={activeTab === tab.key}>
              {count(tab.key)}
            </span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Content -->
    {#if loading}
      <div class="empty-state">Loading…</div>
    {:else if loadError}
      <div class="empty-state error">{loadError}</div>
    {:else if applicants.length === 0}
      <div class="empty-state">No applicants in this queue.</div>
    {:else}
      <div class="card-list">
        {#each applicants as applicant (applicant.id)}
          <div
            class="applicant-card db-card"
            animate:flip={{ duration: 250 }}
            transition:slide={{ duration: 200 }}
          >
            <!-- Header row -->
            <div class="card-header">
              <div>
                <div class="applicant-name">{applicant.name}</div>
                <div class="applicant-contact">
                  <a href="mailto:{applicant.email}" class="contact-link">{applicant.email}</a>
                  {#if applicant.secondary_contact}
                    <span class="contact-sep">·</span>
                    <span class="contact-secondary">{applicant.secondary_contact}</span>
                  {/if}
                </div>
              </div>
              <div class="card-meta-right">
                {#if applicant.fantasy_experience}
                  <span class="exp-badge">{applicant.fantasy_experience}</span>
                {/if}
                <span class="date-label">{applicant.created_date}</span>
              </div>
            </div>

            <!-- Why join -->
            <div class="section-block">
              <div class="section-label">Why they want to join</div>
              <p class="answer-text">{applicant.why_join}</p>
            </div>

            <!-- Referral + platforms -->
            <div class="detail-row">
              <div class="detail-item">
                <span class="detail-label">Knows anyone</span>
                <span class="detail-value">{applicant.knows_anyone || '—'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Platforms</span>
                <span class="detail-value">{platformList(applicant.platforms)}</span>
              </div>
            </div>

            {#if applicant.fantasy_style}
              <div class="section-block" style="margin-top:0">
                <div class="section-label">Fantasy style</div>
                <p class="answer-text muted">{applicant.fantasy_style}</p>
              </div>
            {/if}

            <!-- Admin notes -->
            <div class="notes-block">
              <div class="notes-header">
                <span class="section-label" style="margin-bottom:0">Internal notes</span>
                {#if savedNotes[applicant.id]}
                  <span class="saved-confirm" transition:fade={{ duration: 300 }}>Saved ✓</span>
                {/if}
              </div>
              <textarea
                class="db-input notes-textarea"
                placeholder="Only visible to admins and commissioner…"
                value={applicant.admin_notes ?? ''}
                onblur={(e) => saveNotes(applicant.id, e.currentTarget.value)}
                rows="3"
              ></textarea>
            </div>

            <!-- Action buttons -->
            <div class="action-row">
              {#if activeTab === 'pending'}
                <button
                  class="db-btn"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'in_review')}
                >Mark In Review</button>
                <button
                  class="db-btn primary"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'approved')}
                >Approve</button>
                <button
                  class="db-btn reject-btn"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'rejected')}
                >Reject</button>

              {:else if activeTab === 'in_review'}
                <button
                  class="db-btn primary"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'approved')}
                >Approve</button>
                <button
                  class="db-btn reject-btn"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'rejected')}
                >Reject</button>
                <button
                  class="db-btn"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'pending')}
                >Back to Pending</button>

              {:else if activeTab === 'approved'}
                <button
                  class="db-btn reject-btn"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'rejected')}
                >Reject</button>
                {#if data.isAdmin}
                  {#if inviteDone[applicant.id]}
                    <span class="invite-sent">Invite sent ✓</span>
                  {:else}
                    <button
                      class="db-btn create-btn"
                      onclick={() => { inviteModal = { id: applicant.id, name: applicant.name, email: applicant.email }; inviteError = ''; }}
                    >Create Account</button>
                  {/if}
                {/if}

              {:else if activeTab === 'rejected'}
                <button
                  class="db-btn"
                  disabled={actionBusy[applicant.id]}
                  onclick={() => setStatus(applicant.id, 'pending')}
                >Restore to Pending</button>
              {/if}
            </div>

          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<!-- Create Account modal -->
{#if inviteModal}
  <div class="modal-backdrop" onclick={() => { inviteModal = null; inviteError = ''; }}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-title">Send Account Invite</div>
      <p class="modal-body">
        This will send a Supabase invite email to the address below. They'll set their own password
        and their account will link automatically on first login.
      </p>

      <div class="modal-field">
        <span class="db-label">Name</span>
        <div class="modal-value">{inviteModal.name}</div>
      </div>
      <div class="modal-field">
        <span class="db-label">Email</span>
        <div class="modal-value">{inviteModal.email}</div>
      </div>

      {#if inviteError}
        <div class="modal-error">{inviteError}</div>
      {/if}

      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="db-btn primary" onclick={sendInvite} disabled={inviting}>
          {inviting ? 'Sending…' : 'Send Invite →'}
        </button>
        <button class="db-btn" onclick={() => { inviteModal = null; inviteError = ''; }}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Tabs */
  .tab-bar {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 24px;
  }
  .tab-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-3);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab-btn:hover { color: var(--fg-1); }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-badge {
    font-size: 10px;
    font-weight: 800;
    background: var(--bg-3);
    color: var(--fg-3);
    padding: 1px 6px;
    border-radius: 999px;
  }
  .tab-badge.active { background: var(--accent); color: #0a0a0a; }

  /* Empty / loading */
  .empty-state {
    text-align: center;
    padding: 60px 24px;
    color: var(--fg-3);
    font-size: 14px;
  }
  .empty-state.error { color: var(--bad); }

  /* Card list */
  .card-list { display: flex; flex-direction: column; gap: 16px; }

  /* Applicant card */
  .applicant-card { padding: 22px 24px; }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }
  .applicant-name {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.01em;
    color: var(--fg-1);
    margin-bottom: 4px;
  }
  .applicant-contact {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .contact-link {
    font-size: 13px;
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
  }
  .contact-link:hover { text-decoration: underline; }
  .contact-sep { color: var(--fg-3); font-size: 12px; }
  .contact-secondary { font-size: 13px; color: var(--fg-3); }

  .card-meta-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }
  .exp-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--bg-2));
    padding: 2px 8px;
    border-radius: 999px;
    text-align: right;
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .date-label {
    font-size: 11px;
    color: var(--fg-3);
    font-weight: 500;
  }

  /* Sections */
  .section-block {
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--bg-3);
  }
  .section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--fg-3);
    margin-bottom: 6px;
  }
  .answer-text {
    font-size: 14px;
    line-height: 1.65;
    color: var(--fg-1);
  }
  .answer-text.muted { color: var(--fg-2); }

  /* Detail row */
  .detail-row {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--bg-3);
  }
  .detail-item { display: flex; flex-direction: column; gap: 3px; }
  .detail-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--fg-3);
  }
  .detail-value { font-size: 13px; color: var(--fg-2); }

  /* Notes */
  .notes-block {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--bg-3);
  }
  .notes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .notes-textarea { width: 100%; resize: vertical; font-size: 13px; line-height: 1.5; }
  .saved-confirm {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.05em;
  }

  /* Actions */
  .action-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .reject-btn { color: var(--bad) !important; }
  .create-btn {
    background: color-mix(in srgb, var(--accent) 15%, var(--bg-2)) !important;
    border-color: var(--accent) !important;
    color: var(--accent) !important;
    font-weight: 800 !important;
  }
  .invite-sent {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 24px;
  }
  .modal-card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px;
    max-width: 440px;
    width: 100%;
  }
  .modal-title {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.01em;
    color: var(--fg-1);
    margin-bottom: 10px;
  }
  .modal-body {
    font-size: 13px;
    color: var(--fg-3);
    line-height: 1.6;
    margin-bottom: 20px;
  }
  .modal-field { margin-bottom: 12px; }
  .modal-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-1);
    margin-top: 4px;
  }
  .modal-error {
    font-size: 13px;
    color: var(--bad);
    background: color-mix(in srgb, var(--bad) 8%, var(--bg-2));
    border: 1px solid color-mix(in srgb, var(--bad) 25%, transparent);
    border-radius: 8px;
    padding: 10px 14px;
    margin-top: 12px;
  }

  @media (max-width: 600px) {
    .applicant-card { padding: 16px; }
    .card-header { flex-direction: column; }
    .card-meta-right { align-items: flex-start; flex-direction: row; flex-wrap: wrap; }
    .tab-btn { padding: 9px 10px; font-size: 12px; }
  }
</style>

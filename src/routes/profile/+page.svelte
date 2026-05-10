<script>
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';

  let { data, form } = $props();

  let displayName = $state(untrack(() => data.profile?.display_name ?? ''));
  let primaryColor = $state(untrack(() => data.profile?.primary_color || '#ff5db1'));
  let secondaryColor = $state(untrack(() => data.profile?.secondary_color || '#b06bff'));
  let timezone = $state(untrack(() => data.profile?.timezone ?? 'America/New_York'));
  let saving = $state(false);

  const timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Phoenix', 'Pacific/Honolulu',
    'America/Anchorage'
  ];
</script>

<svelte:head><title>Profile · down bad ↓</title></svelte:head>

<div class="db-page" style="max-width:480px;margin:0 auto">
  <div class="db-card-h" style="margin-bottom:20px">
    Profile
  </div>

  {#if form?.success}
    <div class="db-alert success" style="margin-bottom:16px">Profile saved!</div>
  {/if}
  {#if form?.error}
    <div class="db-alert error" style="margin-bottom:16px">{form.error}</div>
  {/if}

  <!-- Avatar preview -->
  <div class="db-card" style="padding:22px;display:flex;gap:16px;align-items:center;margin-bottom:16px">
    <div class="db-avatar-lg" style="background:{primaryColor}">
      {displayName.charAt(0).toUpperCase() || '?'}
    </div>
    <div>
      <div style="font-weight:800;font-size:18px">{displayName || 'Your name'}</div>
      <div class="db-sub">{data.profile?.username ?? ''}</div>
    </div>
  </div>

  <div class="db-card" style="padding:22px">
    <form method="POST" action="?/update" use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
      };
    }}>
      <div style="margin-bottom:16px">
        <label class="db-label" for="displayName">Display name</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          class="db-input"
          bind:value={displayName}
          required
          maxlength="40"
        />
      </div>

      <div style="margin-bottom:16px;display:flex;gap:12px">
        <div style="flex:1">
          <label class="db-label" for="primaryColor">Primary color</label>
          <div style="display:flex;align-items:center;gap:8px">
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              bind:value={primaryColor}
              style="width:40px;height:38px;border:none;cursor:pointer;border-radius:6px;padding:2px;background:var(--bg-2)"
            />
            <input
              type="text"
              class="db-input"
              bind:value={primaryColor}
              pattern="^#[0-9a-fA-F]{6}$"
              style="font-family:var(--font-mono);flex:1"
            />
          </div>
        </div>
        <div style="flex:1">
          <label class="db-label" for="secondaryColor">Secondary color</label>
          <div style="display:flex;align-items:center;gap:8px">
            <input
              id="secondaryColor"
              name="secondaryColor"
              type="color"
              bind:value={secondaryColor}
              style="width:40px;height:38px;border:none;cursor:pointer;border-radius:6px;padding:2px;background:var(--bg-2)"
            />
            <input
              type="text"
              class="db-input"
              bind:value={secondaryColor}
              pattern="^#[0-9a-fA-F]{6}$"
              style="font-family:var(--font-mono);flex:1"
            />
          </div>
        </div>
      </div>
      <input type="hidden" name="secondaryColor" value={secondaryColor} />

      <div style="margin-bottom:20px">
        <label class="db-label" for="timezone">Timezone</label>
        <select id="timezone" name="timezone" class="db-input" bind:value={timezone}>
          {#each timezones as tz}
            <option value={tz}>{tz.replace('America/', '').replace('_', ' ')}</option>
          {/each}
        </select>
      </div>

      <button type="submit" class="db-btn primary lg" style="width:100%;justify-content:center" disabled={saving}>
        {saving ? 'Saving…' : 'Save profile →'}
      </button>
    </form>
  </div>
</div>

<style>
  .db-alert {
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
  }
  .db-alert.success { background: color-mix(in srgb, var(--good) 15%, var(--bg-2)); color: var(--good); border: 1px solid var(--good); }
  .db-alert.error { background: color-mix(in srgb, var(--bad) 12%, var(--bg-2)); color: var(--bad); border: 1px solid var(--bad); }
  .db-avatar-lg {
    width: 56px; height: 56px;
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 900;
    color: #fff;
    flex-shrink: 0;
  }
</style>

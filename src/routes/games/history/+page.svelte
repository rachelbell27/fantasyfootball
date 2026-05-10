<script>
  let { data } = $props();
</script>

<svelte:head><title>Game History · down bad ↓</title></svelte:head>

<div class="db-page">
  <h1 class="db-h1" style="margin-bottom:8px">Game History</h1>
  <p class="db-sub" style="margin-bottom:28px">Browse completed seasons</p>

  {#if data.years.length === 0}
    <div class="db-card" style="padding:48px;text-align:center">
      <p style="font-size:40px;margin:0 0 12px">👻</p>
      <p style="font-weight:700;margin:0">No completed games yet.</p>
    </div>
  {:else}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
      {#each data.years as year}
        <a href="/games?year={year}" class="db-card year-card">
          <span class="year-num">{year}</span>
          <span class="db-sub" style="font-size:11px">Season →</span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .year-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 24px 16px;
    text-decoration: none;
    color: var(--ink);
    transition: border-color .15s, background .15s;
  }
  .year-card:hover { border-color: var(--accent); background: color-mix(in srgb,var(--accent) 8%,var(--card)); }
  .year-num { font-size: 28px; font-weight: 900; font-family: var(--font-mono); }
</style>

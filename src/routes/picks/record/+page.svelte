<script>
  let { data } = $props();

  const weekLabel = (w) =>
    w.week_type === 'regular'
      ? `Week ${w.week_number}`
      : { wildcard: 'Wild Card', divisional: 'Divisional', conference: 'Conference Championship', superbowl: 'Super Bowl' }[w.week_type] ?? w.week_type;

  const totalWins   = $derived(data.record.reduce((s, y) => s + y.wins, 0));
  const totalLosses = $derived(data.record.reduce((s, y) => s + y.losses, 0));
  const winPct      = $derived(
    totalWins + totalLosses > 0
      ? Math.round(totalWins / (totalWins + totalLosses) * 100)
      : 0
  );
</script>

<svelte:head><title>Record · down bad ↓</title></svelte:head>

<div class="db-page">
  <h1 class="db-h1" style="margin-bottom:24px">My Record</h1>

  {#if data.record.length === 0}
    <div class="db-card" style="padding:48px;text-align:center">
      <p style="font-size:40px;margin:0 0 12px">👻</p>
      <p style="font-weight:700;margin:0 0 6px">No picks yet.</p>
      <p class="db-sub"><a href="/picks" style="color:var(--accent)">Make your first picks →</a></p>
    </div>
  {:else}
    <!-- Overall summary -->
    <div class="db-card" style="padding:20px 24px;margin-bottom:28px;display:flex;gap:40px;flex-wrap:wrap">
      <div style="text-align:center">
        <div style="font-size:36px;font-weight:900;color:var(--good);font-family:var(--font-mono)">{totalWins}</div>
        <div class="db-sub" style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:2px">Wins</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:36px;font-weight:900;color:var(--bad);font-family:var(--font-mono)">{totalLosses}</div>
        <div class="db-sub" style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:2px">Losses</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:36px;font-weight:900;font-family:var(--font-mono)">{winPct}%</div>
        <div class="db-sub" style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:2px">Win Rate</div>
      </div>
    </div>

    {#each data.record as yearData}
      <div style="margin-bottom:24px">
        <div class="db-card-h" style="margin-bottom:10px">
          {yearData.year}
          <span class="db-pill" style="background:color-mix(in srgb,var(--good) 15%,var(--bg-2));color:var(--good)">{yearData.wins}W</span>
          <span class="db-pill" style="background:color-mix(in srgb,var(--bad) 12%,var(--bg-2));color:var(--bad);margin-left:4px">{yearData.losses}L</span>
        </div>
        <div class="db-card" style="overflow:hidden;padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--line)">
                <th class="th">Week</th>
                <th class="th" style="text-align:center">W</th>
                <th class="th" style="text-align:center">L</th>
                <th class="th" style="text-align:center">Picks</th>
              </tr>
            </thead>
            <tbody>
              {#each yearData.weeks as week, i}
                <tr style="border-bottom:{i < yearData.weeks.length - 1 ? '1px solid var(--line)' : 'none'}">
                  <td class="td">{weekLabel(week)}</td>
                  <td class="td" style="text-align:center;font-weight:700;color:var(--good)">{week.wins}</td>
                  <td class="td" style="text-align:center;font-weight:700;color:var(--bad)">{week.losses}</td>
                  <td class="td" style="text-align:center;color:var(--ink-soft)">{week.total}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .th {
    text-align: left;
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--ink-soft);
  }
  .td {
    padding: 11px 16px;
    font-size: 14px;
    font-weight: 600;
  }
</style>

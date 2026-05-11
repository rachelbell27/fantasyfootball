<script>
  import { goto } from '$app/navigation';
  import { slots, foundIds, timeLeft, gameOver, playerNames, progress } from '$lib/stores/trivia.js';
  import SlotCard from '$lib/components/trivia/SlotCard.svelte';
  import SearchAutocomplete from '$lib/components/trivia/SearchAutocomplete.svelte';
  import Timer from '$lib/components/trivia/Timer.svelte';
  import ResultsSummary from '$lib/components/trivia/ResultsSummary.svelte';

  let { data } = $props();

  let timerRunning = $state(false);
  let shake = $state(false);
  let shakeKey = $state(0);

  let slotsVal = $state([]);
  let foundIdsVal = $state(new Set());
  let gameOverVal = $state(false);
  let playerNamesVal = $state({});
  let progressVal = $state({ found: 0, total: 0, pct: 0 });
  let timeLeftVal = $state(0);

  $effect(() => {
    slots.set(data.slots);
    foundIds.set(new Set());
    timeLeft.set(data.game.time_limit_seconds);
    gameOver.set(false);
    playerNames.set({});

    const unsubs = [
      slots.subscribe(v => { slotsVal = v; }),
      foundIds.subscribe(v => { foundIdsVal = v; }),
      timeLeft.subscribe(v => { timeLeftVal = v; }),
      gameOver.subscribe(v => { gameOverVal = v; }),
      playerNames.subscribe(v => { playerNamesVal = v; }),
      progress.subscribe(v => { progressVal = v; }),
    ];
    return () => unsubs.forEach(u => u());
  });

  async function handleGuess(guess) {
    if (gameOverVal) return;
    if (!timerRunning) timerRunning = true;

    try {
      const res = await fetch('/api/trivia/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: data.game.id, guess, foundIds: Array.from(foundIdsVal) }),
      });
      const result = await res.json();

      if (result.matched) {
        let newSize = 0;
        foundIds.update(s => {
          const next = new Set(s);
          next.add(result.slotId);
          newSize = next.size;
          return next;
        });
        playerNames.update(n => ({ ...n, [result.slotId]: result.playerName }));
        if (newSize >= data.game.total) triggerGameOver();
      } else {
        shake = true;
        shakeKey += 1;
        setTimeout(() => { shake = false; }, 700);
      }
    } catch (err) {
      console.error('Validate error:', err);
    }
  }

  function triggerGameOver() { timerRunning = false; gameOver.set(true); }
  function handleTimerExpire() { triggerGameOver(); }
  function handleGiveUp() { triggerGameOver(); }
  function handlePlayAgain() { goto('/trivia'); }
</script>

<svelte:head><title>{data.game.title} · down bad ↓</title></svelte:head>

<div class="db-page game-page">
  {#if gameOverVal && progressVal.found === progressVal.total && progressVal.total > 0}
    <h2 class="db-h1 game-title-centered">{data.game.title}</h2>
    <ResultsSummary
      game={data.game}
      found={progressVal.found}
      total={progressVal.total}
      onPlayAgain={handlePlayAgain}
    />
    <div class="slots-section">
      <p class="db-sub slots-label">Answers</p>
      <div class="slots-grid">
        {#each slotsVal as slot (slot.id)}
          <SlotCard
            {slot}
            hintType={data.game.hint_type}
            found={foundIdsVal.has(slot.id)}
            revealed={!foundIdsVal.has(slot.id)}
            playerName={playerNamesVal[slot.id] ?? null}
          />
        {/each}
      </div>
    </div>

  {:else if gameOverVal}
    <h2 class="db-h1 game-title-centered">{data.game.title}</h2>
    <ResultsSummary
      game={data.game}
      found={progressVal.found}
      total={progressVal.total}
      onPlayAgain={handlePlayAgain}
    />
    <div class="slots-section">
      <p class="db-sub slots-label">All answers</p>
      <div class="slots-grid">
        {#each slotsVal as slot (slot.id)}
          <SlotCard
            {slot}
            hintType={data.game.hint_type}
            found={foundIdsVal.has(slot.id)}
            revealed={!foundIdsVal.has(slot.id)}
            playerName={playerNamesVal[slot.id] ?? null}
          />
        {/each}
      </div>
    </div>

  {:else}
    <div class="game-header">
      <h1 class="db-h1 game-title">{data.game.title}</h1>
      <p class="prompt-text">{data.game.prompt}</p>
    </div>

    <div class="game-controls">
      <Timer
        seconds={timeLeftVal}
        running={timerRunning}
        onExpire={handleTimerExpire}
      />
      <div class="progress-display">
        <span class="found-count">{progressVal.found}</span>
        <span class="progress-sep"> / </span>
        <span class="total-count">{progressVal.total}</span>
        <span class="found-label">found</span>
      </div>
    </div>

    <div class="input-section">
      {#key shakeKey}
        <SearchAutocomplete
          gameId={data.game.id}
          searchDisplayFields={data.game.search_display_fields}
          disabled={gameOverVal}
          onGuess={handleGuess}
          {shake}
        />
      {/key}
    </div>

    <div class="slots-grid">
      {#each slotsVal as slot (slot.id)}
        <SlotCard
          {slot}
          hintType={data.game.hint_type}
          found={foundIdsVal.has(slot.id)}
          revealed={false}
          playerName={playerNamesVal[slot.id] ?? null}
        />
      {/each}
    </div>

    <div class="give-up-row">
      <button class="db-btn give-up-btn" onclick={handleGiveUp}>Give up</button>
    </div>
  {/if}
</div>

<style>
  .game-page { max-width: 860px; margin: 0 auto; }

  .game-header { text-align: center; margin-bottom: 20px; }
  .game-title { margin-bottom: 8px; }
  .game-title-centered { text-align: center; margin-bottom: 8px; }
  .prompt-text { font-size: 17px; color: var(--ink-soft); line-height: 1.5; margin: 0; }

  .game-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 20px;
    margin-bottom: 16px;
  }

  .progress-display { display: flex; align-items: baseline; gap: 4px; font-weight: 700; }
  .found-count { font-size: 26px; color: var(--accent); font-weight: 800; }
  .progress-sep { font-size: 18px; color: var(--ink-soft); }
  .total-count { font-size: 20px; color: var(--ink); }
  .found-label { font-size: 13px; color: var(--ink-soft); margin-left: 4px; }

  .input-section { margin-bottom: 20px; }

  .slots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }

  .give-up-row { display: flex; justify-content: center; padding-bottom: 32px; }
  .give-up-btn { opacity: 0.65; font-size: 13px; }
  .give-up-btn:hover { opacity: 1; }

  .slots-section { margin-top: 32px; }
  .slots-label {
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
    font-weight: 700;
  }
</style>

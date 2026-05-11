<script>
	let { gameId, searchDisplayFields = [], disabled = false, onGuess, shake = false } = $props();

	let inputValue = $state('');
	let results = $state([]);
	let highlightedIndex = $state(-1);
	let isOpen = $state(false);
	let debounceTimer = null;

	$effect(() => {
		if (shake) {
			// Re-trigger shake by forcing a reflow if needed
		}
	});

	function handleInput(e) {
		const q = e.target.value;
		inputValue = q;
		highlightedIndex = -1;

		clearTimeout(debounceTimer);

		if (q.length < 2 || !gameId) {
			results = [];
			isOpen = false;
			return;
		}

		debounceTimer = setTimeout(async () => {
			try {
				const res = await fetch(
					`/api/trivia/search?gameId=${gameId}&q=${encodeURIComponent(q)}`
				);
				if (res.ok) {
					const data = await res.json();
					results = data;
					isOpen = data.length > 0;
				} else {
					results = [];
					isOpen = false;
				}
			} catch {
				results = [];
				isOpen = false;
			}
		}, 200);
	}

	function submitGuess(value) {
		if (!value) return;
		onGuess(value);
		inputValue = '';
		results = [];
		isOpen = false;
		highlightedIndex = -1;
	}

	function handleKeydown(e) {
		if (!isOpen && e.key !== 'Enter') return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, -1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (highlightedIndex >= 0 && results[highlightedIndex]) {
				submitGuess(results[highlightedIndex].full_name);
			} else if (inputValue.trim()) {
				submitGuess(inputValue.trim());
			}
		} else if (e.key === 'Escape') {
			isOpen = false;
			highlightedIndex = -1;
		}
	}

	function handleResultClick(result) {
		submitGuess(result.full_name);
	}

	function handleBlur() {
		setTimeout(() => {
			isOpen = false;
			highlightedIndex = -1;
		}, 150);
	}

	function formatTeams(teams) {
		if (!teams || teams.length === 0) return '';
		return teams.map((t) => t.name).join(', ');
	}
</script>

<div class="wrapper" class:shake>
	<input
		class="answer-input"
		type="text"
		value={inputValue}
		{disabled}
		placeholder={disabled ? "Time's up!" : 'Type a name…'}
		autofocus
		oninput={handleInput}
		onkeydown={handleKeydown}
		onblur={handleBlur}
		autocomplete="off"
		autocorrect="off"
		autocapitalize="off"
		spellcheck="false"
	/>

	{#if isOpen && results.length > 0}
		<div class="dropdown">
			{#each results as result, i}
				<div
					class="result-row"
					class:highlighted={i === highlightedIndex}
					onmousedown={() => handleResultClick(result)}
					role="option"
					aria-selected={i === highlightedIndex}
				>
					<span class="result-name">{result.full_name}</span>

					{#if searchDisplayFields.includes('position') && result.position}
						<span class="badge">{result.position}</span>
					{/if}

					{#if searchDisplayFields.includes('teams') && result.teams && result.teams.length > 0}
						<span class="badge">{formatTeams(result.teams)}</span>
					{/if}

					{#if searchDisplayFields.includes('college') && result.college}
						<span class="result-college">{result.college}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wrapper {
		position: relative;
		width: 100%;
	}

	.answer-input {
		width: 100%;
		font-size: 20px;
		font-weight: 600;
		padding: 14px 18px;
		border-radius: 12px;
		box-sizing: border-box;
		background: var(--card);
		border: 1.5px solid var(--line);
		color: var(--ink);
	}

	.answer-input:focus {
		outline: none;
		border-color: var(--accent, var(--line));
	}

	.answer-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--card);
		border: 1.5px solid var(--line);
		border-radius: 12px;
		overflow: hidden;
		z-index: 50;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.result-row {
		padding: 10px 16px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.result-row.highlighted,
	.result-row:hover {
		background: var(--bg-2);
	}

	.result-name {
		font-weight: 700;
		font-size: 15px;
		flex: 1;
	}

	.badge {
		font-size: 11px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--bg-3);
		color: var(--ink-soft);
	}

	.result-college {
		font-size: 12px;
		color: var(--ink-soft);
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		15% {
			transform: translateX(-8px);
		}
		30% {
			transform: translateX(8px);
		}
		45% {
			transform: translateX(-6px);
		}
		60% {
			transform: translateX(6px);
		}
		75% {
			transform: translateX(-3px);
		}
		90% {
			transform: translateX(3px);
		}
	}

	.shake {
		animation: shake 0.6s ease-in-out;
	}
</style>

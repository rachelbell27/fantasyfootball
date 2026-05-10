<script>
  import { createSupabaseBrowserClient } from '$lib/supabase.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let { data } = $props();
  const supabase = createSupabaseBrowserClient(data.supabase.url, data.supabase.anonKey);

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  let mode = $state('login'); // 'login' | 'reset'
  let resetEmail = $state('');
  let resetSent = $state(false);
  let resetError = $state('');

  const redirect = $derived($page.url.searchParams.get('redirect') ?? '/');

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      goto(redirect);
    } catch (err) {
      error = err.message ?? 'Invalid email or password';
    } finally {
      loading = false;
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    resetError = '';
    loading = true;
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`
      });
      if (err) throw err;
      resetSent = true;
    } catch (err) {
      resetError = err.message ?? 'Failed to send reset email';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Sign in · down bad ↓</title></svelte:head>

<div style="min-height:100vh;display:grid;place-items:center;background:var(--bg);padding:24px">
  <div style="width:100%;max-width:380px">
    <div style="text-align:center;margin-bottom:32px">
      <div class="db-brand-mark" style="width:56px;height:56px;font-size:28px;margin:0 auto 12px">👻</div>
      <h1 style="font-size:28px;font-weight:800;font-style:italic;letter-spacing:-.025em;margin:0 0 4px">down bad ↓</h1>
      <p class="db-sub">sign in to make your picks</p>
    </div>

    <div class="db-card" style="padding:24px">
      {#if mode === 'login'}
        <form onsubmit={handleSubmit}>
          <div style="margin-bottom:14px">
            <label class="db-label" for="email">Email</label>
            <input id="email" type="email" class="db-input" placeholder="you@somewhere.com"
              bind:value={email} required autocomplete="email" />
          </div>
          <div style="margin-bottom:16px">
            <label class="db-label" for="password">Password</label>
            <input id="password" type="password" class="db-input" placeholder="••••••••"
              bind:value={password} required autocomplete="current-password" />
          </div>

          {#if error}
            <div style="color:var(--bad);font-size:13px;font-weight:600;margin-bottom:12px;
                        padding:10px 14px;background:var(--bg-2);border-radius:8px;
                        border:1px solid var(--bad)">
              {error}
            </div>
          {/if}

          <button type="submit" class="db-btn primary lg" style="width:100%;justify-content:center"
            disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <p style="text-align:center;margin-top:16px;font-size:12px">
          <button type="button" class="db-link" onclick={() => { mode = 'reset'; error = ''; }}>
            Forgot password?
          </button>
        </p>

      {:else if resetSent}
        <p style="color:var(--good);font-weight:700;text-align:center;margin:0 0 16px">
          Check your email for a reset link.
        </p>
        <button type="button" class="db-btn" style="width:100%;justify-content:center"
          onclick={() => { mode = 'login'; resetSent = false; }}>
          Back to sign in
        </button>

      {:else}
        <p style="font-weight:700;margin:0 0 16px">Reset your password</p>
        <form onsubmit={handleReset}>
          <div style="margin-bottom:16px">
            <label class="db-label" for="resetEmail">Email</label>
            <input id="resetEmail" type="email" class="db-input" placeholder="you@somewhere.com"
              bind:value={resetEmail} required autocomplete="email" />
          </div>

          {#if resetError}
            <div style="color:var(--bad);font-size:13px;font-weight:600;margin-bottom:12px;
                        padding:10px 14px;background:var(--bg-2);border-radius:8px;
                        border:1px solid var(--bad)">
              {resetError}
            </div>
          {/if}

          <button type="submit" class="db-btn primary lg" style="width:100%;justify-content:center"
            disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link →'}
          </button>
        </form>

        <p style="text-align:center;margin-top:16px;font-size:12px">
          <button type="button" class="db-link" onclick={() => { mode = 'login'; resetError = ''; }}>
            Back to sign in
          </button>
        </p>
      {/if}
    </div>

    <p class="db-sub" style="text-align:center;margin-top:24px;font-size:11px">
      not affiliated with ghost energy, taylor swift, the nfl, or anyone referenced on this site.
    </p>
  </div>
</div>

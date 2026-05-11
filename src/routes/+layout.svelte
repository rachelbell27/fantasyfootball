<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { createSupabaseBrowserClient } from '$lib/supabase.js';
  import { goto, invalidate } from '$app/navigation';

  let { data, children } = $props();

  const supabase = createSupabaseBrowserClient(data.supabase.url, data.supabase.anonKey);

  // Apply user theme colors as CSS vars
  $effect(() => {
    const color = data.profile?.primary_color ?? '#ff5db1';
    const secondary = data.profile?.secondary_color ?? '#b06bff';
    document.documentElement.style.setProperty('--user-primary', color);
    document.documentElement.style.setProperty('--user-secondary', secondary);
  });

  // Sync theme preference from profile (handles cross-device consistency)
  $effect(() => {
    const pref = data.profile?.theme_preference;
    if (pref) {
      document.documentElement.setAttribute('data-theme', pref);
      localStorage.setItem('db-theme', pref);
    }
  });

  // Keep session in sync on client navigation
  $effect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        invalidate('supabase:auth');
      }
    });
    return () => subscription.unsubscribe();
  });

  const mobileLinks = [
    { href: '/',        label: 'Home',    icon: '🏠', match: (p) => p === '/' },
    { href: '/picks',   label: "Pick'ems", icon: '🏈', match: (p) => p.startsWith('/picks') || p.startsWith('/games') },
    { href: '/trivia',  label: 'Trivia',  icon: '🧠', match: (p) => p.startsWith('/trivia') },
    { href: '/league',  label: 'League',  icon: '🏆', match: (p) => p.startsWith('/league') },
    { href: '/apply',   label: 'Apply',   icon: '📝', match: (p) => p === '/apply' },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    goto('/auth/login');
  }

  async function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('db-theme', next);
    // Persist to profile so preference follows the user across devices
    try {
      await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themePreference: next })
      });
    } catch { /* non-critical */ }
  }

  const displayName = $derived(data.profile?.display_name ?? '');
  const initial = $derived(displayName.charAt(0).toUpperCase() || '?');
</script>

<svelte:head>
  <title>down bad ↓</title>
</svelte:head>


<!-- Desktop navbar -->
{#if data.session}
  <nav class="navbar">
    <a href="/" class="db-brand">
      <span class="db-brand-mark">👻</span>
      <span>down bad</span>
    </a>

    <a href="/" class="db-nav-link" class:active={$page.url.pathname === '/'}>Home</a>

    <div class="db-nav-group">
      <a href="/picks" class="db-nav-link" class:active={$page.url.pathname.startsWith('/picks')}>
        Pick'ems ▾
      </a>
      <div class="db-dropdown">
        <a href="/picks" class="db-dropdown-item" class:active={$page.url.pathname === '/picks'}>Picks</a>
        <a href="/picks/record" class="db-dropdown-item" class:active={$page.url.pathname === '/picks/record'}>Record</a>
        <a href="/games" class="db-dropdown-item" class:active={$page.url.pathname === '/games'}>Results</a>
        {#if data.availableYears?.length > 0}
          <div class="db-dropdown-divider"></div>
          {#each data.availableYears as year}
            <a href="/picks/history/{year}" class="db-dropdown-item"
               class:active={$page.url.pathname === `/picks/history/${year}`}>{year}</a>
          {/each}
        {/if}
      </div>
    </div>

    <div class="db-nav-group">
      <a href="/trivia" class="db-nav-link" class:active={$page.url.pathname.startsWith('/trivia')}>
        Trivia ▾
      </a>
      <div class="db-dropdown">
        <a href="/trivia" class="db-dropdown-item" class:active={$page.url.pathname === '/trivia'}>Play</a>
        <a href="/trivia/history" class="db-dropdown-item" class:active={$page.url.pathname === '/trivia/history'}>History</a>
        {#if data.profile?.is_admin}
          <div class="db-dropdown-divider"></div>
          <a href="/trivia/admin" class="db-dropdown-item" class:active={$page.url.pathname.startsWith('/trivia/admin')}>Admin</a>
        {/if}
      </div>
    </div>

    <a href="/league" class="db-nav-link" class:active={$page.url.pathname.startsWith('/league')}>The League</a>

    <a href="/apply" class="db-nav-link" class:active={$page.url.pathname === '/apply'}>Apply</a>

    {#if data.profile?.is_admin || data.profile?.is_commissioner}
      <a href="/admin" class="db-nav-link" class:active={$page.url.pathname.startsWith('/admin')}>Admin</a>
    {/if}

    <span class="db-nav-spacer"></span>

    <div class="db-nav-right">
      <button class="db-theme-btn" onclick={toggleTheme} aria-label="Toggle theme">☀</button>
      <a href="/profile" class="db-nav-user">
        <span class="db-avatar" style="background:{data.profile?.primary_color ?? 'var(--avatar-bg)'}">
          {initial}
        </span>
        <span>{displayName}</span>
      </a>
      <button class="db-btn" onclick={signOut} style="height:32px;padding:0 12px;font-size:12px">
        Sign out
      </button>
    </div>
  </nav>

  <!-- Mobile tab bar -->
  <div class="db-mobile-nav">
    {#each mobileLinks as link}
      <a href={link.href} class="db-mobile-tab" class:active={link.match($page.url.pathname)}>
        <span style="font-size:18px">{link.icon}</span>
        <span>{link.label}</span>
      </a>
    {/each}
    <a href="/profile" class="db-mobile-tab" class:active={$page.url.pathname.startsWith('/profile')}>
      <span style="font-size:18px">👤</span>
      <span>Profile</span>
    </a>
  </div>
{/if}

<main>
  {@render children()}
</main>

<footer class="db-footer">
  not affiliated with ghost energy, taylor swift, the nfl, or anyone referenced on this site. just big fans of all of them.
</footer>

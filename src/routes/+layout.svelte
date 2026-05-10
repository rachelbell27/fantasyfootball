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
    { href: '/picks',   label: "Pick'ems", icon: '🏈', match: (p) => p.startsWith('/picks') },
    { href: '/games',   label: 'Games',   icon: '📅', match: (p) => p.startsWith('/games') },
    { href: '/compare', label: 'Compare', icon: '📊', match: (p) => p.startsWith('/compare') },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    goto('/auth/login');
  }

  function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('db-theme', next);
  }

  const displayName = $derived(data.profile?.display_name ?? '');
  const initial = $derived(displayName.charAt(0).toUpperCase() || '?');
</script>

<svelte:head>
  <title>down bad ↓</title>
</svelte:head>

<!-- Restore saved theme on load -->
<svelte:window onload={() => {
  const saved = localStorage.getItem('db-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}} />

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
      <a href="/games" class="db-nav-link" class:active={$page.url.pathname.startsWith('/games')}>
        Games ▾
      </a>
      <div class="db-dropdown">
        <a href="/games" class="db-dropdown-item" class:active={$page.url.pathname === '/games'}>Today's Game</a>
        <a href="/games?browse=1" class="db-dropdown-item">More Games</a>
        <a href="/games/history" class="db-dropdown-item" class:active={$page.url.pathname === '/games/history'}>History</a>
      </div>
    </div>

    <a href="/compare" class="db-nav-link" class:active={$page.url.pathname.startsWith('/compare')}>Compare</a>

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

import { serverSupabase, supabasePublicConfig } from '$lib/server/auth.js';

export async function load({ url, cookies }) {
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = serverSupabase(cookies);
    await supabase.auth.exchangeCodeForSession(code);
  }
  return { supabase: supabasePublicConfig };
}

import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const db = await createClient();
  try {
    const res = await db.query(
      `SELECT DISTINCT season_year FROM games
       WHERE game_status IN ('final', 'status_final')
       ORDER BY season_year DESC`
    );
    return { years: res.rows.map(r => r.season_year) };
  } finally {
    await db.end();
  }
}

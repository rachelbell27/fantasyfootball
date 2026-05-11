import { redirect } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';

export async function load({ parent }) {
  const { profile } = await parent();

  if (!profile?.is_admin && !profile?.is_commissioner) {
    throw redirect(303, '/league');
  }

  const db = await createClient();
  try {
    await db.query(`ALTER TABLE league_applicants ADD COLUMN IF NOT EXISTS admin_notes TEXT`).catch(() => {});
    await db.query(`ALTER TABLE league_applicants ADD COLUMN IF NOT EXISTS reviewed_by INTEGER`).catch(() => {});
    await db.query(`ALTER TABLE league_applicants ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`).catch(() => {});

    const [applicantsRes, countsRes] = await Promise.all([
      db.query(
        `SELECT *,
                to_char(created_at AT TIME ZONE 'America/New_York', 'Mon DD, YYYY') AS created_date
         FROM league_applicants
         WHERE status = 'pending'
         ORDER BY created_at ASC`
      ),
      db.query(
        `SELECT status, COUNT(*) AS count FROM league_applicants GROUP BY status`
      ),
    ]);

    const statusCounts = {};
    for (const row of countsRes.rows) {
      statusCounts[row.status] = parseInt(row.count);
    }

    return {
      applicants: applicantsRes.rows,
      statusCounts,
      isAdmin: !!profile.is_admin,
    };
  } catch (e) {
    console.error('applicants load error:', e);
    return { applicants: [], statusCounts: {}, isAdmin: false };
  } finally {
    await db.end();
  }
}

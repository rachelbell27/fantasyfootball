import { json, error } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { serverSupabase } from '$lib/server/auth.js';

async function getUser(cookies, db) {
  try {
    const supabase = serverSupabase(cookies);
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    const res = await db.query(
      'SELECT id, is_admin, is_commissioner FROM users WHERE supabase_uid = $1',
      [session.user.id]
    );
    return res.rows[0] ?? null;
  } catch { return null; }
}

async function selfHeal(db) {
  await db.query(`ALTER TABLE league_applicants ADD COLUMN IF NOT EXISTS admin_notes TEXT`).catch(() => {});
  await db.query(`ALTER TABLE league_applicants ADD COLUMN IF NOT EXISTS reviewed_by INTEGER`).catch(() => {});
  await db.query(`ALTER TABLE league_applicants ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`).catch(() => {});
}

export async function GET({ url, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user?.is_admin && !user?.is_commissioner) throw error(403, 'Forbidden');

    const status = url.searchParams.get('status') ?? 'pending';
    if (!['pending', 'in_review', 'approved', 'rejected'].includes(status)) {
      throw error(400, 'Invalid status');
    }

    await selfHeal(db);

    const result = await db.query(
      `SELECT *,
              to_char(created_at AT TIME ZONE 'America/New_York', 'Mon DD, YYYY') AS created_date
       FROM league_applicants
       WHERE status = $1
       ORDER BY created_at ASC`,
      [status]
    );

    return json(result.rows);
  } catch (e) {
    if (e.status) throw e;
    console.error('[GET /api/league/applicants]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}

export async function PATCH({ request, cookies }) {
  const db = await createClient();
  try {
    const user = await getUser(cookies, db);
    if (!user?.is_admin && !user?.is_commissioner) throw error(403, 'Forbidden');

    const body = await request.json();
    const { id, status, admin_notes } = body;
    if (!id) throw error(400, 'Missing id');

    await selfHeal(db);

    if (status !== undefined) {
      if (!['pending', 'in_review', 'approved', 'rejected'].includes(status)) {
        throw error(400, 'Invalid status');
      }
      await db.query(
        `UPDATE league_applicants
         SET status = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3`,
        [status, user.id, id]
      );
    } else if (admin_notes !== undefined) {
      await db.query(
        `UPDATE league_applicants SET admin_notes = $1 WHERE id = $2`,
        [admin_notes, id]
      );
    } else {
      throw error(400, 'Nothing to update');
    }

    // Always return fresh counts so the client can update badges
    const countsRes = await db.query(
      `SELECT status, COUNT(*) AS count FROM league_applicants GROUP BY status`
    );
    const statusCounts = {};
    for (const row of countsRes.rows) {
      statusCounts[row.status] = parseInt(row.count);
    }

    return json({ ok: true, statusCounts });
  } catch (e) {
    if (e.status) throw e;
    console.error('[PATCH /api/league/applicants]', e.message);
    throw error(500, e.message);
  } finally {
    await db.end();
  }
}

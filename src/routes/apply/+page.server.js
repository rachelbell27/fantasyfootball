import { fail } from '@sveltejs/kit';
import { createClient } from '$lib/server/db.js';
import { HCAPTCHA_SECRET } from '$env/static/private';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    const captchaToken  = data.get('captchaToken')?.toString() ?? '';
    const name          = data.get('name')?.toString().trim() ?? '';
    const email         = data.get('email')?.toString().trim().toLowerCase() ?? '';
    const secondary     = data.get('secondaryContact')?.toString().trim() || null;
    const whyJoin       = data.get('whyJoin')?.toString().trim() ?? '';
    const knowsAnyone   = data.get('knowsAnyone')?.toString().trim() || null;
    const hasIphone     = data.get('hasIphone')?.toString() === 'yes';
    const experience    = data.get('fantasyExperience')?.toString().trim() || null;
    const fantasyStyle  = data.get('fantasyStyle')?.toString().trim() || null;

    let platforms = [];
    try { platforms = JSON.parse(data.get('platforms')?.toString() ?? '[]'); } catch {}

    if (!name || !email || !whyJoin) {
      return fail(400, { error: 'Please fill out all required fields.' });
    }
    if (!hasIphone) {
      return fail(400, { error: 'iPhone required to join.' });
    }
    if (!captchaToken) {
      return fail(400, { error: 'Please complete the captcha.' });
    }

    // Verify hCaptcha
    try {
      const verifyRes = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: HCAPTCHA_SECRET ?? '', response: captchaToken }).toString()
      });
      const verifyJson = await verifyRes.json();
      if (!verifyJson.success) {
        return fail(400, { error: 'Captcha verification failed. Please try again.' });
      }
    } catch (e) {
      console.error('[apply] hCaptcha verify error:', e.message);
      return fail(500, { error: 'Could not verify captcha. Please try again.' });
    }

    const db = await createClient();
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS league_applicants (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          secondary_contact TEXT,
          why_join TEXT NOT NULL,
          knows_anyone TEXT,
          has_iphone BOOLEAN NOT NULL DEFAULT true,
          fantasy_experience TEXT,
          platforms TEXT[],
          fantasy_style TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await db.query(
        `INSERT INTO league_applicants
         (name, email, secondary_contact, why_join, knows_anyone,
          has_iphone, fantasy_experience, platforms, fantasy_style)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [name, email, secondary, whyJoin, knowsAnyone, hasIphone, experience, platforms, fantasyStyle]
      );

      return { success: true };
    } catch (e) {
      if (e.code === '23505') {
        return fail(409, { error: "Looks like you've already applied. We'll be in touch." });
      }
      console.error('[apply POST]', e.message);
      return fail(500, { error: 'Something went wrong on our end. Please try again.' });
    } finally {
      await db.end();
    }
  }
};

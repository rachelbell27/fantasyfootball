<script>
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';

  let { data } = $props();
  const siteKey = data?.siteKey ?? '';

  // Form field state
  let name            = $state('');
  let email           = $state('');
  let secondary       = $state('');
  let whyJoin         = $state('');
  let knowsAnyone     = $state('');
  let hasIphone       = $state('');   // '' | 'yes' | 'no'
  let experience      = $state('');
  let platforms       = $state([]);
  let fantasyStyle    = $state('');
  let agreedVibe      = $state(false);
  let agreedRules     = $state(false);
  let captchaToken    = $state('');

  // Submission state
  let submitting  = $state(false);
  let submitted   = $state(false);
  let formError   = $state('');

  let captchaContainer;

  const PLATFORMS = ['Sleeper', 'ESPN', 'Yahoo', 'NFL.com', 'Other'];
  const EXPERIENCE_OPTIONS = [
    'First timer',
    'Some seasons under my belt',
    'Veteran',
    'I take it too seriously and I know it',
  ];

  const canSubmit = $derived(
    hasIphone === 'yes' &&
    agreedVibe &&
    agreedRules &&
    !!captchaToken &&
    name.trim() !== '' &&
    email.trim() !== '' &&
    whyJoin.trim() !== ''
  );

  function togglePlatform(p) {
    platforms = platforms.includes(p)
      ? platforms.filter(x => x !== p)
      : [...platforms, p];
  }

  onMount(() => {
    if (!siteKey) return;

    window._hcLoad = () => {
      if (window.hcaptcha && captchaContainer) {
        window.hcaptcha.render(captchaContainer, {
          sitekey: siteKey,
          callback: (token) => { captchaToken = token; },
          'expired-callback': () => { captchaToken = ''; },
          'error-callback': () => { captchaToken = ''; },
        });
      }
    };

    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=_hcLoad';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => { delete window._hcLoad; };
  });

  function handleSubmit({ formData, cancel }) {
    if (!canSubmit) { cancel(); return; }

    formData.set('captchaToken', captchaToken);
    formData.set('platforms', JSON.stringify(platforms));

    submitting = true;
    formError = '';

    return async ({ result }) => {
      submitting = false;
      if (result.type === 'success') {
        submitted = true;
      } else if (result.type === 'failure') {
        formError = result.data?.error ?? 'Something went wrong. Please try again.';
        if (typeof window !== 'undefined' && window.hcaptcha) {
          window.hcaptcha.reset();
        }
        captchaToken = '';
      }
    };
  }
</script>

<svelte:head>
  <title>Apply · down bad ↓</title>
</svelte:head>

<div class="db-page">
  <div class="apply-wrap">

    {#if submitted}
      <!-- ── Success state ── -->
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h2>Application received.</h2>
        <p>
          We read every one. If you're a fit, we'll reach out — usually within a week or two.
          Don't pester anyone. We'll find you.
        </p>
      </div>

    {:else}
      <!-- ── Header ── -->
      <div class="apply-header">
        <div class="apply-eyebrow">Down Bad for Ghost · Open Application</div>
        <h1>Think you're<br>Down Bad enough?</h1>
        <p class="apply-subhead">Spots are limited. We're selective. No promises.</p>
      </div>

      <!-- ── Form ── -->
      <form method="POST" use:enhance={handleSubmit} novalidate>

        <!-- Name -->
        <div class="field">
          <label class="db-label" for="f-name">Name <span class="req">*</span></label>
          <input
            id="f-name"
            class="db-input"
            type="text"
            name="name"
            bind:value={name}
            required
            autocomplete="name"
          />
        </div>

        <!-- Email -->
        <div class="field">
          <label class="db-label" for="f-email">Email <span class="req">*</span></label>
          <input
            id="f-email"
            class="db-input"
            type="email"
            name="email"
            bind:value={email}
            required
            autocomplete="email"
          />
        </div>

        <!-- Secondary contact -->
        <div class="field">
          <label class="db-label" for="f-secondary">Phone, Discord, Instagram — however you prefer to be reached</label>
          <input
            id="f-secondary"
            class="db-input"
            type="text"
            name="secondaryContact"
            bind:value={secondary}
            placeholder="@handle, +1 555…, etc."
          />
        </div>

        <div class="divider"></div>

        <!-- Why join -->
        <div class="field">
          <label class="db-label" for="f-why">Why do you want to join? <span class="req">*</span></label>
          <textarea
            id="f-why"
            class="db-input"
            name="whyJoin"
            bind:value={whyJoin}
            rows="4"
            required
            placeholder="Give us more than 'it looks fun.' Sell yourself a little."
          ></textarea>
        </div>

        <!-- Knows anyone -->
        <div class="field">
          <label class="db-label" for="f-knows">Do you know anyone in the league? If so, who?</label>
          <input
            id="f-knows"
            class="db-input"
            type="text"
            name="knowsAnyone"
            bind:value={knowsAnyone}
            placeholder="Name(s), or leave blank"
          />
        </div>

        <div class="divider"></div>

        <!-- iPhone question -->
        <div class="field">
          <div class="db-label">Do you have an iPhone? <span class="req">*</span></div>
          <div class="radio-group">
            <label class="radio-option" class:selected={hasIphone === 'yes'}>
              <input
                type="radio"
                name="hasIphone"
                value="yes"
                bind:group={hasIphone}
              />
              Yes
            </label>
            <label class="radio-option" class:selected={hasIphone === 'no'}>
              <input
                type="radio"
                name="hasIphone"
                value="no"
                bind:group={hasIphone}
              />
              No
            </label>
          </div>
          {#if hasIphone === 'no'}
            <p class="iphone-sorry">
              We don't want to waste your time — we're blue message snobs. So sorry.
            </p>
          {/if}
        </div>

        <div class="divider"></div>

        <!-- Fantasy experience -->
        <div class="field">
          <label class="db-label" for="f-exp">Fantasy experience</label>
          <select id="f-exp" class="db-input" name="fantasyExperience" bind:value={experience}>
            <option value="">Select your experience level</option>
            {#each EXPERIENCE_OPTIONS as opt}
              <option value={opt}>{opt}</option>
            {/each}
          </select>
        </div>

        <!-- Platforms -->
        <div class="field">
          <div class="db-label">Platforms you've used</div>
          <div class="checkbox-grid">
            {#each PLATFORMS as p}
              <label class="checkbox-option" class:checked={platforms.includes(p)}>
                <input
                  type="checkbox"
                  checked={platforms.includes(p)}
                  onchange={() => togglePlatform(p)}
                />
                {p}
              </label>
            {/each}
          </div>
        </div>

        <!-- Fantasy style -->
        <div class="field">
          <label class="db-label" for="f-style">Describe your fantasy style <span class="optional">(optional)</span></label>
          <textarea
            id="f-style"
            class="db-input"
            name="fantasyStyle"
            bind:value={fantasyStyle}
            rows="3"
            placeholder="Punt RBs? Zero-RB? Stack? Or do you just hit autopick and pray?"
          ></textarea>
        </div>

        <div class="divider"></div>

        <!-- Vibe block -->
        <div class="vibe-block">
          <div class="vibe-label">A note before you continue</div>
          <p>
            We're big fans of Taylor Swift and supporting women in general. Before you get weird
            about it — we're roughly 50/50 men and women and our commissioner is a guy, so don't
            be sexist. We also lean a certain way on social issues. Anyone is welcome to apply,
            but if that already has you rolling your eyes, you probably won't enjoy the group chat
            or find your people here. Just being honest.
          </p>
        </div>

        <div class="field">
          <label class="agree-option">
            <input type="checkbox" bind:checked={agreedVibe} />
            <span>I've read the above and understand the vibe of this league.</span>
          </label>
        </div>

        <div class="divider"></div>

        <!-- Rules -->
        <div class="field">
          <a
            href="/league/rules"
            target="_blank"
            rel="noopener noreferrer"
            class="rules-link"
          >
            Read the Official Rulebook →
          </a>
        </div>

        <div class="field">
          <label class="agree-option">
            <input type="checkbox" bind:checked={agreedRules} />
            <span>I agree to the rules, the character standards, and the Commissioner's authority as outlined in the rulebook.</span>
          </label>
        </div>

        <div class="divider"></div>

        <!-- hCaptcha -->
        <div class="field">
          <div bind:this={captchaContainer}></div>
          {#if !siteKey}
            <p class="captcha-missing">hCaptcha not configured.</p>
          {/if}
        </div>

        <!-- Error -->
        {#if formError}
          <div class="form-error">{formError}</div>
        {/if}

        <!-- Submit -->
        <button
          type="submit"
          class="db-btn primary submit-btn"
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Submitting…' : 'Submit Application →'}
        </button>

        {#if hasIphone === 'no'}
          <p class="submit-blocked">
            Application disabled — iPhone required to join.
          </p>
        {:else if !agreedVibe || !agreedRules}
          <p class="submit-hint">Check both boxes above to continue.</p>
        {:else if !captchaToken}
          <p class="submit-hint">Complete the captcha to submit.</p>
        {/if}

      </form>
    {/if}

  </div>
</div>

<style>
  .apply-wrap {
    max-width: 600px;
    margin: 0 auto;
    padding: 0 0 80px;
  }

  /* Header */
  .apply-header {
    margin-bottom: 40px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
  }
  .apply-eyebrow {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--accent);
    margin-bottom: 14px;
  }
  .apply-header h1 {
    font-size: clamp(32px, 7vw, 56px);
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--fg-1);
    margin-bottom: 12px;
  }
  .apply-subhead {
    font-size: 15px;
    color: var(--fg-3);
    font-weight: 400;
  }

  /* Form layout */
  form {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .field {
    margin-bottom: 20px;
  }
  .divider {
    height: 1px;
    background: var(--border);
    margin: 28px 0;
  }

  /* Labels */
  .req {
    color: var(--accent);
    font-weight: 900;
  }
  .optional {
    font-weight: 400;
    color: var(--fg-3);
    font-size: 11px;
  }

  /* Textarea */
  textarea.db-input {
    resize: vertical;
    line-height: 1.55;
  }

  /* iPhone radio */
  .radio-group {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
  .radio-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-2);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 18px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    user-select: none;
  }
  .radio-option input { display: none; }
  .radio-option.selected {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-2));
  }

  .iphone-sorry {
    margin-top: 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--bad);
    padding: 10px 14px;
    background: color-mix(in srgb, var(--bad) 8%, var(--bg-2));
    border: 1px solid color-mix(in srgb, var(--bad) 25%, transparent);
    border-radius: 8px;
  }

  /* Platforms checkboxes */
  .checkbox-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-2);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 14px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    user-select: none;
  }
  .checkbox-option input { display: none; }
  .checkbox-option.checked {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-2));
  }

  /* Vibe block */
  .vibe-block {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    padding: 20px 22px;
    margin-bottom: 16px;
  }
  .vibe-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--accent);
    margin-bottom: 10px;
  }
  .vibe-block p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--fg-2);
  }

  /* Agreement checkboxes */
  .agree-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1.5;
    color: var(--fg-2);
  }
  .agree-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    margin-top: 2px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  /* Rules link */
  .rules-link {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .rules-link:hover { text-decoration: underline; }

  /* Submit */
  .submit-btn {
    width: 100%;
    padding: 14px;
    font-size: 15px;
    font-weight: 800;
    margin-top: 8px;
  }
  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .submit-hint,
  .submit-blocked {
    font-size: 12px;
    color: var(--fg-3);
    text-align: center;
    margin-top: 8px;
  }
  .submit-blocked {
    color: var(--bad);
    font-weight: 600;
  }

  /* Error */
  .form-error {
    font-size: 13px;
    font-weight: 600;
    color: var(--bad);
    background: color-mix(in srgb, var(--bad) 8%, var(--bg-2));
    border: 1px solid color-mix(in srgb, var(--bad) 25%, transparent);
    border-radius: 8px;
    padding: 12px 16px;
    margin-top: 4px;
  }

  /* Captcha missing (dev) */
  .captcha-missing {
    font-size: 12px;
    color: var(--fg-3);
    font-style: italic;
  }

  /* Success */
  .success-card {
    text-align: center;
    padding: 80px 32px;
  }
  .success-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent);
    color: #0a0a0a;
    font-size: 24px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
  }
  .success-card h2 {
    font-size: 28px;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--fg-1);
    margin-bottom: 12px;
  }
  .success-card p {
    font-size: 15px;
    color: var(--fg-3);
    line-height: 1.6;
    max-width: 380px;
    margin: 0 auto;
  }
</style>

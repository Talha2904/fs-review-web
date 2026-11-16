import React, { useEffect, useState } from 'react';
import { MIN_PASSWORD } from '../lib/roles';
import { BRAND } from '../lib/brand';
import BrandWordmark from '../components/BrandWordmark';
import '../login.css';

// The StatementX sign-in page (design: "StatementX Sign In"). It also creates the first Administrator
// on a new installation, asks for a password-reset link, and sets a new password from that link.

// A reset link from an email opens this page with ?reset=<token>.
const resetTokenInUrl = () => { try { return new URLSearchParams(window.location.search).get('reset') || ''; } catch { return ''; } };

export default function LoginPage({ auth, setupRequired, onSignedIn }) {
  const [mode, setMode] = useState(resetTokenInUrl() ? 'reset' : 'signin');   // signin | forgot | reset
  const [notice, setNotice] = useState('');
  const back = msg => { setNotice(msg || ''); setMode('signin'); };
  return (
    <div className="signin">
      <aside className="signin-brand" aria-label={`About ${BRAND.name}`}>
        <div className="signin-ambient" aria-hidden="true" />
        <img className="signin-logo" src="/pa-logo-white.png" alt="Project Accountants — Empowering Businesses Worldwide" />
        <div className="signin-hero">
          <p className="signin-name"><BrandWordmark word={BRAND.word} label={BRAND.name} draw /></p>
          <div className="signin-rule" aria-hidden="true" />
          <p className="signin-headline">Smarter reviews.<br />Better insights.</p>
          <p className="signin-tagline">{BRAND.tagline}</p>
          <ReviewSteps />
        </div>
        <div className="signin-legal">© {new Date().getFullYear()} {BRAND.firm}. For authorised users only.</div>
      </aside>

      <main className="signin-main">
        <div className="signin-spacer" />
        {mode === 'forgot' && <ForgotForm auth={auth} onBack={() => back('')} />}
        {mode === 'reset' && <ResetForm auth={auth} onDone={msg => { try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ } back(msg); }} />}
        {mode === 'signin' && <SignInForm auth={auth} setupRequired={setupRequired} onSignedIn={onSignedIn} notice={notice} onForgot={() => { setNotice(''); setMode('forgot'); }} />}
        <div className="signin-foot">
          <span>Access is limited to accounts issued by your administrator.</span>
          {BRAND.supportEmail && <a className="signin-link" href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(`${BRAND.name} support`)}`} title={BRAND.supportEmail}>Contact support</a>}
        </div>
      </main>
    </div>
  );
}

// The review in four steps, each lit in turn (every 2.6 seconds); still for people who prefer reduced motion.
const STEPS = ['Assess', 'Challenge', 'Resolve', 'Sign off'];
function ReviewSteps() {
  const [on, setOn] = useState(0);
  useEffect(() => {
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* keep moving */ }
    if (still) return undefined;
    const t = setInterval(() => setOn(i => (i + 1) % STEPS.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <ol className="signin-steps" aria-label="How a review works">
      {STEPS.map((s, i) => <li key={s} className={'signin-step' + (i === on ? ' is-on' : '')}><span className="signin-step-text">{s}</span></li>)}
    </ol>
  );
}

function SignInForm({ auth, setupRequired, onSignedIn, notice, onForgot }) {
  const [f, setF] = useState({ name: '', username: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => { setF(s => ({ ...s, [k]: e.target.value })); setError(''); };
  const capsCheck = e => setCaps(!!e.getModifierState?.('CapsLock'));
  const MISMATCH = 'The two passwords do not match.', mismatch = error === MISMATCH;

  async function submit(e) {
    e.preventDefault();
    if (setupRequired && f.password !== f.confirm) return setError(MISMATCH);
    setBusy(true); setError('');
    try {
      const user = setupRequired
        ? await auth.setup({ name: f.name, username: f.username, password: f.password })
        : await auth.login(f.username, f.password);
      onSignedIn(user);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <form className="signin-form" onSubmit={submit} noValidate>
      <div className="signin-head">
        {setupRequired && <span className="signin-eyebrow">First-time setup</span>}
        <h1 className="signin-title">{setupRequired ? 'Create the administrator account' : 'Sign in'}</h1>
        <p className="signin-lead">{setupRequired ? 'No accounts exist yet. This first account is an Administrator, who then adds everyone else.' : 'Enter your account credentials to continue.'}</p>
      </div>
      {notice && <div role="status" className="signin-alert is-ok">{notice}</div>}

      <div className="signin-fields">
        {setupRequired && <Field id="signin-fullname" label="Full name"><input id="signin-fullname" className="signin-input" autoComplete="name" value={f.name} onChange={set('name')} required autoFocus /></Field>}
        <Field id="signin-user" label="Username"><input id="signin-user" className="signin-input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.username} onChange={set('username')} required autoFocus={!setupRequired} /></Field>
        <Field id="signin-pass" label="Password" help={setupRequired ? `At least ${MIN_PASSWORD} characters.` : error} invalid={!setupRequired && !!error}
          toggle={<button type="button" className="signin-show" aria-pressed={show} aria-controls="signin-pass" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>}>
          <input id="signin-pass" className="signin-input" type={show ? 'text' : 'password'} autoComplete={setupRequired ? 'new-password' : 'current-password'}
            value={f.password} onChange={set('password')} onKeyUp={capsCheck} onKeyDown={capsCheck} required />
        </Field>
        {setupRequired && <Field id="signin-confirm" label="Confirm password" help={mismatch ? error : ''} invalid={mismatch}>
          <input id="signin-confirm" className="signin-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.confirm} onChange={set('confirm')} onKeyUp={capsCheck} required />
        </Field>}
        {caps && <div role="status" className="signin-help" style={{ marginTop: -8 }}>Caps Lock is on.</div>}
      </div>
      {/* first-time setup: a problem from the server (a taken username, a weak password) is about the whole form */}
      {setupRequired && error && !mismatch && <div role="alert" className="signin-alert">{error}</div>}

      <div className="signin-actions">
        <button type="submit" className="signin-submit" disabled={busy || !f.username || !f.password || (setupRequired && (!f.name || !f.confirm))}>
          {busy && <span className="spin" aria-hidden="true" />}{busy ? (setupRequired ? 'Creating…' : 'Signing in…') : setupRequired ? 'Create account and sign in' : 'Sign in'}
        </button>
        {!setupRequired && (auth.resetAvailable
          ? <button type="button" className="signin-link" onClick={onForgot}>Forgot your password?</button>
          : <p className="signin-note">Forgotten your password? Ask an Administrator to reset it.</p>)}
      </div>
    </form>
  );
}

// Ask for a reset link: always the same answer, so it doesn't reveal which accounts exist.
function ForgotForm({ auth, onBack }) {
  const [login, setLogin] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await auth.forgot(login.trim()); setMsg(r.message || 'If an account matches, we’ve emailed a link to reset the password.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <form className="signin-form" onSubmit={submit} noValidate>
      <div className="signin-head">
        <h1 className="signin-title">Reset your password</h1>
        <p className="signin-lead">Enter your username or the email address on your account. We’ll email you a link to choose a new password.</p>
      </div>
      {msg ? <div role="status" className="signin-alert is-ok">{msg}</div> : (
        <div className="signin-fields">
          <Field id="signin-login" label="Username or email" help={error} invalid={!!error}>
            <input id="signin-login" className="signin-input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={login} onChange={e => { setLogin(e.target.value); setError(''); }} autoFocus aria-invalid={!!error} />
          </Field>
        </div>)}
      <div className="signin-actions">
        {!msg && <button type="submit" className="signin-submit" disabled={busy || !login.trim()}>{busy && <span className="spin" aria-hidden="true" />}{busy ? 'Sending…' : 'Email me a reset link'}</button>}
        <button type="button" className="signin-link" onClick={onBack}>Back to sign in</button>
      </div>
    </form>);
}

// Choose a new password from an emailed link.
function ResetForm({ auth, onDone }) {
  const token = resetTokenInUrl();
  const [pw, setPw] = useState(''), [confirm, setConfirm] = useState(''), [show, setShow] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (pw !== confirm) return setError('The two passwords do not match.');
    setBusy(true); setError('');
    try { await auth.resetPassword(token, pw); onDone('Your password has been changed. Sign in with your new password.'); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <form className="signin-form" onSubmit={submit} noValidate>
      <div className="signin-head">
        <h1 className="signin-title">Choose a new password</h1>
        <p className="signin-lead">The link works once. When you save, you’ll be signed out everywhere else.</p>
      </div>
      <div className="signin-fields">
        <Field id="signin-new" label="New password" help={`At least ${MIN_PASSWORD} characters.`}
          toggle={<button type="button" className="signin-show" aria-pressed={show} aria-controls="signin-new" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>}>
          <input id="signin-new" className="signin-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={e => { setPw(e.target.value); setError(''); }} autoFocus />
        </Field>
        <Field id="signin-new2" label="Confirm new password" help={error} invalid={!!error}>
          <input id="signin-new2" className="signin-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} aria-invalid={!!error} />
        </Field>
      </div>
      <div className="signin-actions">
        <button type="submit" className="signin-submit" disabled={busy || !pw || !confirm}>{busy && <span className="spin" aria-hidden="true" />}{busy ? 'Saving…' : 'Save new password'}</button>
        <button type="button" className="signin-link" onClick={() => onDone('')}>Back to sign in</button>
      </div>
    </form>);
}

// A labelled input; `toggle` (Show / Hide) is drawn on the label line but comes after the input, so Tab goes
// from one input to the next; `help` sits under the input (red when invalid) and describes it.
const Field = ({ id, label, help, invalid, toggle, children }) => (
  <div className="signin-field">
    <label className="signin-label" htmlFor={id}>{label}</label>
    {React.cloneElement(children, { 'aria-describedby': help ? `${id}-help` : undefined, 'aria-invalid': invalid || undefined })}
    {toggle}
    {help && <div id={`${id}-help`} className={'signin-help' + (invalid ? ' is-error' : '')} role={invalid ? 'alert' : undefined}>{help}</div>}
  </div>
);

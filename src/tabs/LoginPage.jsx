import React, { useState } from 'react';
import { ROLES, MIN_PASSWORD, describeRole } from '../lib/roles';
import { cap, body, muted } from '../components/ui';

// How a review moves through the app, and who does each part: AI, the app's own
// arithmetic, or the reviewer. Ticked in turn as the page loads.
const BY = { ai: 'AI', code: 'Calculated', reviewer: 'Reviewer' };
const STAGES = [
  ['Documents read', 'ai', 'AI reads the draft, prior year, trial balance and custodian schedule, and extracts every figure.', '#E9B949'],
  ['Checks recalculated', 'code', 'Totals are recast and tied out by the app’s own arithmetic, so every result can be reproduced.', '#8DBB3A'],
  ['Movements explained', 'ai', 'AI drafts the reason behind each material change for the reviewer to confirm.', '#3FB8C9'],
  ['Disclosures read', 'ai', 'AI looks for stale wording, changed directors and events left out of the notes.', '#4F86D3'],
  ['Review points cleared', 'reviewer', 'The reviewer decides. AI re-tests each open point on the next draft.', '#5B6B7F']
];

// A generic AI mark (not tied to any one model or vendor): a circle in the four
// Project Accountants colours with a white sparkle.
const Sparkle = () => (
  <span className="ai-mark" aria-hidden="true">
    <svg viewBox="0 0 12 12" width="9" height="9">
      <path d="M6 0.5 C6.5 3.6 8.4 5.5 11.5 6 C8.4 6.5 6.5 8.4 6 11.5 C5.5 8.4 3.6 6.5 0.5 6 C3.6 5.5 5.5 3.6 6 0.5 Z" fill="#fff" />
    </svg>
  </span>
);

// The review as a cycle: five coloured segments drawn in turn on load, a tick on each stage,
// stage names around the ring, and the selected stage's description in the centre.
const W = 480, H = 430, CX = 240, CY = 215, R = 110, LR = 134, GAP = 5;
const rad = d => (d * Math.PI) / 180;
const pt = (a, r = R) => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];
const f = n => n.toFixed(2);

function ReviewCycle() {
  const [sel, setSel] = useState(null);
  const n = STAGES.length, step = 360 / n;
  return (
    <figure className="cycle" aria-label="How a review runs, repeated for each new draft">
      <svg className="cycle-ring" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {STAGES.map(([t, , , color], i) => {
          const s0 = -90 + i * step + GAP, e0 = -90 + (i + 1) * step - GAP, m = -90 + i * step + step / 2;
          const [x1, y1] = pt(s0), [x2, y2] = pt(e0), [mx, my] = pt(m);
          // arrowhead at the end of each segment, pointing clockwise into the next
          const tip = pt(e0 + 4.5), b1 = pt(e0 - 0.5, R + 9), b2 = pt(e0 - 0.5, R - 9);
          const on = sel === i;
          return (
            <g key={t} style={{ '--i': i, '--c': color }}>
              <path className="cycle-arc" d={`M ${f(x1)} ${f(y1)} A ${R} ${R} 0 0 1 ${f(x2)} ${f(y2)}`} pathLength="1" style={{ strokeWidth: on ? 24 : 18 }} />
              <path className="cycle-arrow" d={`M ${f(b1[0])} ${f(b1[1])} L ${f(tip[0])} ${f(tip[1])} L ${f(b2[0])} ${f(b2[1])} Z`} />
              <circle cx={f(mx)} cy={f(my)} r={on ? 16 : 14} className="cycle-node" />
              <g transform={`translate(${f(mx - 7)} ${f(my - 5.5)})`}>
                <path className="cycle-tick" d="M1 5.5 L5 9.5 L13 1.5" pathLength="1" />
              </g>
            </g>
          );
        })}
      </svg>

      <div className="cycle-center" aria-live="polite">
        {sel === null ? (
          <>
            <div className="cycle-center-title">Every draft</div>
            <div className="cycle-center-text">goes round once. Select a stage to see who does what.</div>
          </>
        ) : (
          <>
            <div className="cycle-center-title">{STAGES[sel][0]}</div>
            <div className="cycle-center-text">{STAGES[sel][2]}</div>
          </>
        )}
      </div>

      {STAGES.map(([t, by], i) => {
        const m = -90 + i * step + step / 2, [x, y] = pt(m, LR), c = Math.cos(rad(m));
        const side = c > 0.3 ? 'right' : c < -0.3 ? 'left' : Math.sin(rad(m)) > 0 ? 'bottom' : 'top';
        return (
          <button type="button" key={t} className={`cycle-label cycle-${side}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }} aria-pressed={sel === i}
            onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onClick={() => setSel(i)}>
            <span className="cycle-label-title">{t}</span>
            <span className={'stage-by by-' + by}>{by === 'ai' && <Sparkle />}{BY[by]}</span>
          </button>
        );
      })}
    </figure>
  );
}

// A reset link from an email opens this page with ?reset=<token>.
const resetTokenInUrl = () => { try { return new URLSearchParams(window.location.search).get('reset') || ''; } catch { return ''; } };

export default function LoginPage({ auth, setupRequired, onSignedIn, matrix }) {
  const [f, setF] = useState({ name: '', username: '', password: '', confirm: '' });
  const [mode, setMode] = useState(resetTokenInUrl() ? 'reset' : 'signin');   // signin | forgot | reset
  const [notice, setNotice] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => { setF(s => ({ ...s, [k]: e.target.value })); setError(''); };
  const capsCheck = e => setCaps(!!e.getModifierState?.('CapsLock'));

  async function submit(e) {
    e.preventDefault();
    if (setupRequired && f.password !== f.confirm) return setError('The two passwords do not match.');
    setBusy(true); setError('');
    try {
      const user = setupRequired
        ? await auth.setup({ name: f.name, username: f.username, password: f.password })
        : await auth.login(f.username, f.password);
      onSignedIn(user);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="login">
      <section className="login-brand" aria-label="About FS Review">
        <div className="login-title">
          <img src="/pa-mark.png" alt="" width="40" height="40" />
          <span>FS Review</span>
        </div>
        <p className="login-lede">AI-assisted year-end review of investment fund financial statements: AI reads and drafts, the app recalculates, and the reviewer decides.</p>

        <ReviewCycle />

        <dl className="login-roles">
          {ROLES.map(r => (
            <div key={r}><dt>{r}</dt><dd>{describeRole(r, matrix)}</dd></div>
          ))}
        </dl>

        <img className="login-logo" src="/pa-logo.png" alt="Project Accountants" />
      </section>

      <main className="login-form">
        {mode === 'forgot' && <ForgotCard auth={auth} onBack={() => { setMode('signin'); setError(''); }} />}
        {mode === 'reset' && <ResetCard auth={auth} onDone={msg => { try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ } setNotice(msg); setMode('signin'); }} />}
        {mode === 'signin' && <form onSubmit={submit} className="login-card" noValidate>
          {notice && <div role="status" style={{ ...cap, marginBottom: 12, background: 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '10px 12px' }}>{notice}</div>}
          <h1 className="login-h1">{setupRequired ? 'Create the administrator account' : 'Sign in'}</h1>
          <p style={{ ...body, ...muted, margin: '6px 0 0' }}>
            {setupRequired ? 'No accounts exist yet. This first account is an Administrator, who then adds everyone else.' : 'Use the username and password your administrator gave you.'}
          </p>

          <div className="login-fields">
            {setupRequired && <Field label="Full name"><input className="input input-lg" autoComplete="name" value={f.name} onChange={set('name')} required autoFocus /></Field>}
            <Field label="Username"><input className="input input-lg" autoComplete="username" autoCapitalize="none" spellCheck={false} value={f.username} onChange={set('username')} required autoFocus={!setupRequired} /></Field>
            <Field label="Password" hint={setupRequired ? `At least ${MIN_PASSWORD} characters.` : ''}>
              <div className="pw">
                <input className="input input-lg" type={show ? 'text' : 'password'} autoComplete={setupRequired ? 'new-password' : 'current-password'}
                  value={f.password} onChange={set('password')} onKeyUp={capsCheck} onKeyDown={capsCheck} required />
                <button type="button" className="pw-toggle" aria-pressed={show} onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button>
              </div>
            </Field>
            {setupRequired && <Field label="Confirm password"><input className="input input-lg" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.confirm} onChange={set('confirm')} onKeyUp={capsCheck} required /></Field>}
          </div>

          {caps && <div role="status" style={{ ...cap, marginTop: 12 }}>Caps Lock is on.</div>}
          {error && <div role="alert" style={{ ...cap, marginTop: 12, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '10px 12px' }}>{error}</div>}

          <button type="submit" className="btn btn-primary login-submit" disabled={busy || !f.username || !f.password || (setupRequired && !f.name)}>
            {busy ? (setupRequired ? 'Creating…' : 'Signing in…') : setupRequired ? 'Create Account and Sign In' : 'Sign In'}
          </button>

          {!setupRequired && (auth.resetAvailable
            ? <p style={{ ...cap, margin: '16px 0 0' }}><button type="button" className="link" onClick={() => { setMode('forgot'); setError(''); }}>Forgot your password?</button></p>
            : <p style={{ ...cap, ...muted, margin: '16px 0 0' }}>Forgotten your password? Ask an Administrator to reset it.</p>)}

        </form>}
      </main>
    </div>
  );
}

const Field = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{ ...cap, color: 'var(--snow-black-80)', fontWeight: 600 }}>{label}</span>
    {children}
    {hint && <span style={{ ...cap, ...muted }}>{hint}</span>}
  </label>
);


// Ask for a reset link: always the same answer, so it doesn't reveal which accounts exist.
function ForgotCard({ auth, onBack }) {
  const [login, setLogin] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await auth.forgot(login.trim()); setMsg(r.message || 'If an account matches, we’ve emailed a link to reset the password.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="login-card" noValidate>
      <h1 className="login-h1">Reset your password</h1>
      <p style={{ ...body, ...muted, margin: '6px 0 0' }}>Enter your username or the email address on your account. We’ll email you a link to choose a new password.</p>
      {msg ? <div role="status" style={{ ...cap, marginTop: 16, background: 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '10px 12px' }}>{msg}</div> : (
        <div className="login-fields"><Field label="Username or email"><input className="input input-lg" autoComplete="username" autoCapitalize="none" spellCheck={false} value={login} onChange={e => { setLogin(e.target.value); setError(''); }} autoFocus /></Field></div>)}
      {error && <div role="alert" style={{ ...cap, marginTop: 12, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '10px 12px' }}>{error}</div>}
      {!msg && <button type="submit" className="btn btn-primary login-submit" disabled={busy || !login.trim()}>{busy ? 'Sending…' : 'Email Me a Reset Link'}</button>}
      <p style={{ ...cap, margin: '16px 0 0' }}><button type="button" className="link" onClick={onBack}>Back to sign in</button></p>
    </form>);
}

// Choose a new password from an emailed link.
function ResetCard({ auth, onDone }) {
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
    <form onSubmit={submit} className="login-card" noValidate>
      <h1 className="login-h1">Choose a new password</h1>
      <p style={{ ...body, ...muted, margin: '6px 0 0' }}>The link works once. When you save, you’ll be signed out everywhere else.</p>
      <div className="login-fields">
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
          <div className="pw"><input className="input input-lg" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={e => { setPw(e.target.value); setError(''); }} autoFocus />
            <button type="button" className="pw-toggle" aria-pressed={show} onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button></div>
        </Field>
        <Field label="Confirm new password"><input className="input input-lg" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} /></Field>
      </div>
      {error && <div role="alert" style={{ ...cap, marginTop: 12, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '10px 12px' }}>{error}</div>}
      <button type="submit" className="btn btn-primary login-submit" disabled={busy || !pw || !confirm}>{busy ? 'Saving…' : 'Save New Password'}</button>
      <p style={{ ...cap, margin: '16px 0 0' }}><button type="button" className="link" onClick={() => onDone('')}>Back to sign in</button></p>
    </form>);
}

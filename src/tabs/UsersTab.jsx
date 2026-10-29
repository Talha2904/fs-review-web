import React, { useEffect, useState } from 'react';
import { ROLES, STAFF_ROLES, EDITABLE_PERMS, DEFAULT_MATRIX, MIN_PASSWORD, normalizeMatrix, describeRole, getPermissions, setPermissions } from '../lib/roles';
import { describeMatrixChange } from '../lib/activityText';
import { Button, Card, CardHead, Pill, cap, body, h2, muted, page } from '../components/ui';
import Modal from '../components/Modal';

const GRID = 'minmax(220px,1.8fr) 120px 96px 120px 316px';
const EMPTY = { name: '', username: '', role: 'Reviewer', password: '' };

export default function UsersTab({ auth, me }) {
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(null); // null = closed
  const [resetFor, setResetFor] = useState(null); // the user whose password is being reset
  const [editFor, setEditFor] = useState(null); // the user being edited
  const [matrix, setMatrix] = useState(getPermissions);
  useEffect(() => { auth.getPermissions().then(m => { setPermissions(m); setMatrix(normalizeMatrix(m)); }).catch(() => {}); }, [auth]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = () => auth.listUsers().then(setUsers).catch(e => setError(e.message));
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn, done) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); await refresh(); done && setNotice(done); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }
  const add = async () => { if (await run(() => auth.createUser(form), `${form.name.trim()} was added as ${form.role}. Give them their username and temporary password.`)) setForm(null); };
  const update = (u, patch, msg) => run(() => auth.updateUser(u.id, patch), msg);

  const counts = Object.fromEntries(ROLES.map(r => [r, (users || []).filter(u => u.active && u.role === r).length]));

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 680 }}>
          <div style={h2}>Users and Roles</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>Who can do what · {users ? users.filter(u => u.active).length : '…'} active users</div>
        </div>
        <Button size="lg" disabled={busy || !!form} onClick={() => { setForm(EMPTY); setNotice(''); setError(''); }}>Add User</Button>
      </div>

      {notice && <div role="status" style={{ ...cap, background: 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '10px 14px' }}>{notice}</div>}
      {error && <div role="alert" style={{ ...cap, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

      {form && (
        <Card>
          <CardHead title="Add User" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
            <Field label="Full name"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Username"><input className="input" autoCapitalize="none" spellCheck={false} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Role" hint={describeRole(form.role, matrix)}>
              <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="Email" hint="For self-service password reset. Optional."><input className="input" type="email" autoComplete="off" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Temporary password" hint={`At least ${MIN_PASSWORD} characters.`}>
              <input className="input" type="text" autoComplete="off" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <Button kind="secondary" onClick={() => setForm(null)}>Cancel</Button>
            <Button disabled={busy || !form.name.trim() || !form.username || !form.password} onClick={add}>{busy ? 'Adding…' : 'Add User'}</Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="Staff directory" aside={ROLES.map(r => `${counts[r]} ${r}`).join(' · ')} />
        {users === null ? <div style={{ ...body, ...muted, marginTop: 12 }}>Loading users…</div> : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '8px 12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: 900 }}>
              {['User', 'Role', 'Status', 'Last sign-in', ''].map((c, i) => <div key={i} style={{ ...cap, ...muted }}>{c}</div>)}
            </div>
            {users.map(u => {
              const self = u.id === me.id;
              return (
                <div key={u.id} style={{ padding: '12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', minWidth: 900, opacity: u.active ? 1 : 0.6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                      <div aria-hidden="true" style={{ width: 36, height: 36, flex: '0 0 auto', borderRadius: '50%', background: 'var(--snow-primary-purple)', display: 'grid', placeItems: 'center', ...cap, fontWeight: 600 }}>{initials(u.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ ...body, fontWeight: 600 }}>{u.name}{self && <span style={{ ...cap, ...muted, fontWeight: 400, marginLeft: 8 }}>You</span>}</div>
                        <div style={{ ...cap, ...muted }}>{u.username}</div>
                      </div>
                    </div>
                    <div style={body}>{u.role}</div>
                    <div><Pill bg={u.active ? 'var(--snow-status-complete-bg)' : 'var(--snow-ink-5)'}>{u.active ? 'Active' : 'Deactivated'}</Pill></div>
                    <div style={{ ...cap }}>{lastSeen(u.lastSignInAt)}</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Button size="sm" kind="secondary" disabled={busy} onClick={() => { setNotice(''); setError(''); setEditFor(u); }}>Edit</Button>
                      <Button size="sm" kind="secondary" disabled={busy} onClick={() => { setNotice(''); setError(''); setResetFor(u); }}>Reset Password</Button>
                      {self
                        ? <span title="You cannot deactivate your own account." style={{ display: 'inline-flex' }}><Button size="sm" kind="secondary" disabled>Deactivate</Button></span>
                        : <Button size="sm" kind="secondary" disabled={busy} onClick={() => update(u, { active: !u.active }, `${u.name} was ${u.active ? 'deactivated' : 'reactivated'}.`)}>{u.active ? 'Deactivate' : 'Reactivate'}</Button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <PermissionMatrix auth={auth} saved={matrix} onSaved={m => { setPermissions(m); setMatrix(m); }} />

      {editFor && <EditUserModal matrix={matrix} user={editFor} self={editFor.id === me.id} auth={auth} onClose={() => setEditFor(null)}
        onDone={msg => { setEditFor(null); setNotice(msg); refresh(); }} />}

      {resetFor && <ResetPasswordModal user={resetFor} self={resetFor.id === me.id} auth={auth} onClose={() => setResetFor(null)}
        onDone={() => { setResetFor(null); setNotice(`The password for ${resetFor.name} was reset. Give them the new password.`); refresh(); }} />}
    </div>
  );
}

function EditUserModal({ user, self, auth, onClose, onDone, matrix }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const patch = {};
  if (name.trim() !== user.name) patch.name = name.trim();
  if (role !== user.role) patch.role = role;
  if (email.trim().toLowerCase() !== (user.email || '')) patch.email = email.trim();
  const changed = Object.keys(patch).length > 0;
  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter the person’s name.');
    setBusy(true); setError('');
    try {
      await auth.updateUser(user.id, patch);
      onDone(`${patch.name || user.name} was updated: ${[patch.name && `renamed from ${user.name}`, patch.role && `role changed to ${patch.role}`, patch.email !== undefined && 'email updated'].filter(Boolean).join(', ')}.`);
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full name"><input className="input" autoComplete="off" value={name} onChange={e => { setName(e.target.value); setError(''); }} /></Field>
        <Field label="Email" hint="Used for self-service password reset links."><input className="input" type="email" autoComplete="off" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} /></Field>
        <Field label="Username" hint="People sign in with their username and the activity log refers to it, so it cannot be changed.">
          <input className="input" value={user.username} disabled readOnly />
        </Field>
        <Field label="Role" hint={self ? 'You cannot change your own role. Another Administrator can.' : describeRole(role, matrix)}>
          <select className="input" value={role} disabled={self} onChange={e => { setRole(e.target.value); setError(''); }}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
        </Field>
        {error && <div role="alert" style={{ ...cap, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <button type="submit" className="btn btn-primary" style={{ height: 36, padding: '0 16px' }} disabled={busy || !changed || !name.trim()}>{busy ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, self, auth, onClose, onDone }) {
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mismatch = pw.confirm && pw.next !== pw.confirm;
  async function submit(e) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return setError('The two passwords do not match.');
    setBusy(true); setError('');
    try { await auth.updateUser(user.id, { password: pw.next }); onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <Modal title={`Reset password for ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...body, ...muted }}>
          {self ? 'This changes your own password.' : `Choose a new password for ${user.username}. They use it the next time they sign in.`}
        </div>
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
          <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw.next} onChange={e => { setPw({ ...pw, next: e.target.value }); setError(''); }} />
        </Field>
        <Field label="Confirm new password">
          <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw.confirm} onChange={e => { setPw({ ...pw, confirm: e.target.value }); setError(''); }} />
        </Field>
        <label style={{ ...cap, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show passwords
        </label>
        {(error || mismatch) && <div role="alert" style={{ ...cap, background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 12px' }}>{error || 'The two passwords do not match.'}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button kind="secondary" onClick={onClose}>Cancel</Button>
          <button type="submit" className="btn btn-primary" style={{ height: 36, padding: '0 16px' }} disabled={busy || !pw.next || !pw.confirm || mismatch}>{busy ? 'Resetting…' : 'Reset Password'}</button>
        </div>
      </form>
    </Modal>
  );
}

// The permission matrix. Rows are fixed; the Administrator ticks which roles hold each permission.
function PermissionMatrix({ auth, saved, onSaved }) {
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: '', text: '' });
  useEffect(() => { setDraft(saved); }, [saved]);
  const grid = `minmax(260px,2fr) repeat(${ROLES.length}, minmax(90px,1fr))`;
  const changes = describeMatrixChange(saved, draft, EDITABLE_PERMS, STAFF_ROLES);
  const toggle = (perm, role) => {
    setMsg({ kind: '', text: '' });
    setDraft(d => ({ ...d, [perm]: d[perm].includes(role) ? d[perm].filter(r => r !== role) : STAFF_ROLES.filter(r => r === role || d[perm].includes(r)) }));
  };
  const nobody = EDITABLE_PERMS.filter(p => !draft[p.id].length);
  async function save() {
    setBusy(true);
    try { const m = await auth.savePermissions(draft); onSaved(m); setMsg({ kind: 'ok', text: `Permissions saved: ${changes.join('; ')}.` }); }
    catch (e) { setMsg({ kind: 'err', text: `The permissions were not saved: ${e.message}` }); }
    finally { setBusy(false); }
  }
  const Locked = ({ on, why }) => <div style={{ ...body, textAlign: 'center' }} title={why}>{on ? '✓' : <span style={muted}>—</span>}<span className="sr-only">{on ? 'Yes' : 'No'} (fixed)</span></div>;

  return (
    <Card>
      <CardHead title="Who can do what" aside="Every role can view engagements, the analysis and review points" />
      <div style={{ ...cap, ...muted, marginTop: 6, maxWidth: 720 }}>Tick the roles that hold each permission, then save. Administrators always have full access, and only they manage users, permissions and check rules.</div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '8px 12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)', minWidth: 700 }}>
          <div style={{ ...cap, ...muted }}>Permission</div>
          {ROLES.map(r => <div key={r} style={{ ...cap, ...muted, textAlign: 'center' }}>{r}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', minWidth: 700, alignItems: 'center' }}>
          <div style={body}>Manage users, permissions and check rules</div>
          {ROLES.map(r => <Locked key={r} on={r === 'Administrator'} why="Fixed: only Administrators have the administration area." />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', minWidth: 700, alignItems: 'center' }}>
          <div style={body}>Billing: invoices, payments and recovery</div>
          {ROLES.map(r => <Locked key={r} on={r === 'Finance'} why="Fixed: only Finance has the billing area, and Finance has nothing else." />)}
        </div>
        {EDITABLE_PERMS.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: 12, padding: '12px', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)', minWidth: 700, alignItems: 'center',
            background: STAFF_ROLES.some(r => saved[p.id].includes(r) !== draft[p.id].includes(r)) ? 'var(--snow-primary-light)' : undefined }}>
            <div style={body}>{p.label}</div>
            <Locked on why="Fixed: Administrators always have full access." />
            {STAFF_ROLES.map(r => p.noPreparer && r === 'Preparer' ? <Locked key={r} on={false} why="Fixed: a preparer never clears points; the person who raised it, or a senior, accepts the answer." /> : (
              <div key={r} style={{ textAlign: 'center' }}>
                <input type="checkbox" className="perm-check" aria-label={`${r}: ${p.label}`} checked={draft[p.id].includes(r)} disabled={busy} onChange={() => toggle(p.id, r)} />
              </div>
            ))}
            <Locked on={false} why="Fixed: Finance works only in the billing area." />
          </div>
        ))}
      </div>

      {nobody.length > 0 && <div style={{ ...cap, marginTop: 12, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '8px 12px' }}>
        No role outside administration will be able to: {nobody.map(p => p.label.charAt(0).toLowerCase() + p.label.slice(1)).join('; ')}.</div>}
      {msg.text && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ ...cap, marginTop: 12, background: msg.kind === 'err' ? 'rgba(255,71,71,0.1)' : 'var(--snow-status-complete-bg)', borderRadius: 8, padding: '8px 12px' }}>{msg.text}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
        <div style={{ ...cap, ...muted, maxWidth: 520 }}>
          {changes.length ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}.` : 'No unsaved changes.'} Saved changes apply to each person’s next action; their screens update when they next sign in.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="secondary" disabled={busy} onClick={() => { setDraft(normalizeMatrix(DEFAULT_MATRIX)); setMsg({ kind: '', text: '' }); }}>Reset to Defaults</Button>
          {changes.length > 0 && <Button kind="secondary" disabled={busy} onClick={() => setDraft(saved)}>Discard Changes</Button>}
          <Button disabled={busy || !changes.length} onClick={save}>{busy ? 'Saving…' : 'Save Permissions'}</Button>
        </div>
      </div>
    </Card>
  );
}

const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
function lastSeen(iso) {
  if (!iso) return <span style={muted}>Never</span>;
  const d = new Date(iso), now = new Date(), t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = 86400e3, start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return `Today ${t}`;
  if (d.getTime() >= start - day) return `Yesterday ${t}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + t;
}

const Field = ({ label, hint, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ ...cap, ...muted }}>{label}</span>
    {children}
    {hint && <span style={{ ...cap, ...muted }}>{hint}</span>}
  </label>
);

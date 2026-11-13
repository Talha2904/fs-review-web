import React, { useState } from 'react';
import Modal from './Modal';
import { Button, Field, InfoTip, REDBG, body, cap } from './ui';
import { fmtDate } from '../lib/format';

// Deleting a fund: the person types the fund's name to confirm and may give a reason. The api keeps the fund and its
// whole review (a soft delete), so it can be restored from Deleted funds; billing is not changed.
const same = (a, b) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

export default function DeleteFundDialog({ fund, onDelete, onClose }) {
  const name = fund.fund?.name || 'Untitled fund';
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ok = same(typed, name) && reason.length <= 500 && !busy;
  const submit = async () => {
    if (!ok) return;
    setBusy(true); setError('');
    try { await onDelete(fund, typed, reason.trim()); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Delete ${name}?`} onClose={busy ? () => {} : onClose} width={520}
      footer={<>
        <Button kind="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={!ok} onClick={submit} style={ok ? { background: '#C8374B', borderColor: '#C8374B' } : undefined}>{busy ? 'Deleting…' : 'Delete Fund'}</Button>
      </>}>
      <form onSubmit={e => { e.preventDefault(); submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...body }}>
          The fund for the year ended {fmtDate(fund.fund?.yearEnd)} will be removed from every screen: engagements, portfolio,
          notifications, its Consolidated Review group and shared review points. Nothing is erased, and it can be restored from Deleted funds.
          <InfoTip label="What stays">Its documents, review points, sign-off and activity entries are all kept. Billing is unchanged: its AI usage can still be invoiced.</InfoTip>
        </div>
        <Field label={`Type the fund’s name, ${name}, to confirm`} hint="Case and spacing don’t matter.">
          <input className="input" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Reason (optional)" hint={`${reason.length} of 500 characters`}>
          <textarea className="input" rows={3} maxLength={500} style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        {error && <div role="alert" style={{ ...cap, background: REDBG, borderRadius: 8, padding: '10px 14px' }}>{error}</div>}
      </form>
    </Modal>
  );
}

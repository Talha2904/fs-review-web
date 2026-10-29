import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button, Card, Pill, FileButton, Segmented, cap, body, h2, muted, page, RING } from '../components/ui';
import { FRAMEWORKS, STARTER } from '../data/disclosureChecklists';
import { useActivity } from '../lib/activity';

// Administration › Disclosure Checklists: one checklist per framework, saved in the firm's settings.
// Import from Excel (columns: Ref, Section, Requirement, Keywords) or edit here. Saving makes a new
// version; reviews already started keep the version they began with.
export default function ChecklistsTab({ store }) {
  const { log } = useActivity();
  const [cfg, setCfg] = useState(null), [fw, setFw] = useState(FRAMEWORKS[0]);
  const [items, setItems] = useState(null), [dirty, setDirty] = useState(false), [msg, setMsg] = useState({ kind: '', text: '' });
  useEffect(() => (store ? store.subscribeConfig(c => setCfg(c || {})) : undefined), [store]);
  const saved = cfg?.checklists?.[fw] || STARTER[fw];
  useEffect(() => { if (cfg) { setItems((cfg.checklists?.[fw] || STARTER[fw]).items.map(i => ({ ...i }))); setDirty(false); } }, [cfg, fw]);
  if (!cfg || !items) return <div style={page}><div style={h2}>Disclosure Checklists</div><div style={{ ...body, ...muted }}>Loading…</div></div>;

  const set = (idx, patch) => { setItems(xs => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x))); setDirty(true); };
  const nextVersion = () => { const n = /^v(\d+)$/.exec(saved.version || '')?.[1]; return `v${n ? +n + 1 : 1}`; };
  async function save() {
    const clean = items.map((x, i) => ({ ...x, id: x.id || `item-${Date.now()}-${i}`, ref: String(x.ref || '').trim(), section: String(x.section || 'General').trim(), text: String(x.text || '').trim(),
      keywords: (Array.isArray(x.keywords) ? x.keywords : String(x.keywords || '').split(',')).map(k => k.trim()).filter(Boolean) })).filter(x => x.text);
    if (!clean.length) return setMsg({ kind: 'err', text: 'A checklist needs at least one item.' });
    const version = nextVersion();
    try {
      await store.saveConfig({ ...cfg, checklists: { ...(cfg.checklists || {}), [fw]: { version, items: clean, savedAt: new Date().toISOString() } } });
      setDirty(false); setMsg({ kind: 'ok', text: `${fw} checklist saved as ${version}. Reviews already started keep the version they began with.` });
      log('Check rules', `Saved the ${fw} disclosure checklist ${version}`, `${clean.length} items`);
    } catch (e) { setMsg({ kind: 'err', text: `Not saved: ${e.message}` }); }
  }
  async function importXlsx(file) {
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const pick = (r, ...names) => { const k = Object.keys(r).find(c => names.some(n => c.trim().toLowerCase() === n)); return k ? String(r[k]).trim() : ''; };
      const got = rows.map((r, i) => ({ id: `imp-${i + 1}`, ref: pick(r, 'ref', 'reference', 'paragraph'), section: pick(r, 'section', 'area', 'topic') || 'General',
        text: pick(r, 'requirement', 'disclosure', 'text', 'item', 'description'), keywords: pick(r, 'keywords', 'search terms').split(/[,;]/).map(k => k.trim()).filter(Boolean) })).filter(x => x.text);
      if (!got.length) return setMsg({ kind: 'err', text: 'No items found. The first sheet needs a “Requirement” column (and ideally Ref, Section and Keywords).' });
      setItems(got); setDirty(true); setMsg({ kind: 'ok', text: `Imported ${got.length} items from “${file.name}”. Check them, then save.` });
    } catch (e) { setMsg({ kind: 'err', text: `That file could not be read: ${e.message}` }); }
  }
  const template = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items.map(i => ({ Ref: i.ref, Section: i.section, Requirement: i.text, Keywords: (i.keywords || []).join(', ') }))), 'Checklist');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })])); a.download = `${fw.replace(/\s/g, '')}-disclosure-checklist.xlsx`; a.click(); };

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 760 }}>
          <div style={h2}>Disclosure Checklists</div>
          <div style={{ ...body, ...muted, marginTop: 6 }}>The checklist reviewers complete for CHK-13, one per accounting framework. Each client’s framework is set on its entity. Keywords are used to suggest where each item may be disclosed in the draft.</div>
        </div>
        <Segmented value={fw} onChange={v => { if (!dirty || window.confirm('Discard unsaved changes?')) setFw(v); }} options={FRAMEWORKS.map(f => [f, f])} />
      </div>
      {saved.starter && <div role="status" style={{ ...cap, background: 'var(--snow-status-approved-bg)', borderRadius: 8, padding: '10px 14px' }}>This is the <b>starter checklist</b>: a short, generic list of common investment fund disclosures with indicative references. Replace it with your firm’s checklist (Import from Excel) before relying on it.</div>}
      {msg.text && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ ...cap, borderRadius: 8, padding: '10px 14px', background: msg.kind === 'err' ? 'rgba(255,71,71,0.1)' : 'var(--snow-status-complete-bg)' }}>{msg.text}</div>}
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...body }}><b>{fw}</b> · version {saved.version}{saved.savedAt ? ` · saved ${new Date(saved.savedAt).toLocaleDateString('en-GB')}` : ''} · {items.length} items</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FileButton label="Import from Excel" accept=".xlsx,.xls,.csv" onFile={importXlsx} />
            <Button kind="secondary" onClick={template}>Export (.xlsx)</Button>
            <Button kind="secondary" onClick={() => { setItems(xs => [...xs, { id: '', ref: '', section: 'General', text: '', keywords: [] }]); setDirty(true); }}>Add Item</Button>
          </div>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 170px minmax(280px,2fr) minmax(200px,1.2fr) 36px', gap: 10, padding: '6px 4px', minWidth: 860, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>
            {['Ref', 'Section', 'Requirement', 'Keywords (comma separated)', ''].map(c => <span key={c} style={{ ...cap, ...muted }}>{c}</span>)}
          </div>
          {items.map((x, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 170px minmax(280px,2fr) minmax(200px,1.2fr) 36px', gap: 10, padding: '6px 4px', minWidth: 860, alignItems: 'center' }}>
              <input className="input" aria-label="Reference" value={x.ref} onChange={e => set(i, { ref: e.target.value })} />
              <input className="input" aria-label="Section" value={x.section} onChange={e => set(i, { section: e.target.value })} />
              <input className="input" aria-label="Requirement" value={x.text} onChange={e => set(i, { text: e.target.value })} />
              <input className="input" aria-label="Keywords" value={Array.isArray(x.keywords) ? x.keywords.join(', ') : x.keywords} onChange={e => set(i, { keywords: e.target.value })} />
              <button type="button" className="link" aria-label={`Remove ${x.ref || 'item'}`} onClick={() => { setItems(xs => xs.filter((_, j) => j !== i)); setDirty(true); }} style={{ ...body, ...muted }}>×</button>
            </div>))}
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--snow-primary-light)', borderRadius: 16, padding: '16px 24px' }}>
        <span style={{ ...cap, ...muted }}>{dirty ? 'You have unsaved changes.' : 'No unsaved changes.'} CHK-13 itself is switched on or off under Check Rules, by client on its entity, or by fund.</span>
        <Button size="lg" disabled={!dirty} onClick={save}>Save as {nextVersion()}</Button>
      </div>
    </div>
  );
}

import React from 'react';

export const RING = 'inset 0 0 0 1px rgba(0,0,0,0.1)';
export const RED = '#FF4747', REDBG = 'rgba(255,71,71,0.1)';
export const cap = { fontSize: 12, lineHeight: '18px' };
export const body = { fontSize: 14, lineHeight: '20px' };
export const h3 = { fontSize: 18, lineHeight: '28px', fontWeight: 600 };
export const h2 = { fontSize: 24, lineHeight: '36px', fontWeight: 600 };
export const muted = { color: 'var(--snow-black-40)' };
export const PRI_BG = { High: REDBG, Medium: 'var(--snow-status-approved-bg)', Low: 'var(--snow-ink-5)' };
export const BAND_BG = { Investigate: 'var(--snow-status-rejected-bg)', Explain: 'var(--snow-status-pending-bg)', Expected: 'var(--snow-status-complete-bg)' };
export const STATUS_LABEL = { open: 'Open', info: 'Info Requested', cleared: 'Cleared' };
export const page = { padding: '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 20 };
export const hairBottom = { boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' };

export const Pill = ({ bg = 'var(--snow-ink-5)', children, style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...cap, background: bg, padding: '0 10px', height: 18, borderRadius: 18, whiteSpace: 'nowrap', ...style }}>{children}</span>
);
export const PriPill = ({ pri }) => <Pill bg={PRI_BG[pri]}>{pri}</Pill>;

export const Card = ({ children, tint, style }) => (
  <div style={{ background: tint || '#fff', borderRadius: 16, boxShadow: tint ? 'none' : RING, padding: 24, ...style }}>{children}</div>
);

export const CardHead = ({ title, aside, small }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', justifyContent: 'space-between' }}>
    <div style={small ? { ...body, fontWeight: 600 } : h3}>{title}</div>
    {aside != null && <div style={{ ...cap, ...muted }}>{aside}</div>}
  </div>
);

export function Button({ kind = 'primary', size = 'md', disabled, onClick, children, style }) {
  const h = size === 'sm' ? 32 : size === 'lg' ? 40 : 36;
  return <button type="button" disabled={disabled} onClick={onClick} className={'btn btn-' + kind} style={{ height: h, padding: size === 'lg' ? '0 24px' : '0 14px', ...style }}>{children}</button>;
}

export const FileButton = ({ label, onFile, accept = '.pdf,.xlsx,.xls,.csv,.png,.jpg' }) => (
  <label className="btn btn-primary" style={{ height: 36, padding: '0 16px' }}>
    {label}
    <input type="file" hidden accept={accept} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
  </label>
);

export const Tile = ({ bg, label, value, sub, flex = '1 1 180px' }) => (
  <div style={{ flex, minWidth: 160, background: bg, borderRadius: 16, padding: 24 }}>
    <div style={{ ...body, fontWeight: 600 }}>{label}</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 12, flexWrap: 'wrap' }}>
      <span style={h2}>{value}</span>
      {sub && <span style={{ ...cap, ...muted }}>{sub}</span>}
    </div>
  </div>
);

export const Segmented = ({ options, value, onChange, children }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: 'var(--snow-primary-light)', borderRadius: 16, padding: 8 }}>
    {options.map(([v, l]) => (
      <button type="button" key={v} aria-pressed={value === v} className="seg" onClick={() => onChange(v)} style={{ ...body, height: 32, padding: '0 14px', display: 'inline-flex', alignItems: 'center', border: 0, font: 'inherit', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', background: value === v ? '#fff' : 'transparent', boxShadow: value === v ? RING : 'none', color: value === v ? 'var(--snow-black-100)' : 'var(--snow-black-40)' }}>{l}</button>
    ))}
    {children}
  </div>
);

export const StatusButtons = ({ value, onChange, vertical, readOnly }) => readOnly ? (
  <div><Pill bg={value === 'cleared' ? 'var(--snow-status-complete-bg)' : value === 'info' ? 'var(--snow-status-approved-bg)' : 'var(--snow-ink-5)'}>{STATUS_LABEL[value] || 'Open'}</Pill></div>
) : (
  <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', flexWrap: 'wrap', gap: vertical ? 4 : 6 }}>
    {Object.entries(STATUS_LABEL).map(([s, l]) => (
      <button type="button" key={s} aria-pressed={value === s} className="seg" onClick={e => { e.stopPropagation(); onChange(s); }} style={{ ...cap, font: 'inherit', fontSize: 'inherit', border: 0, padding: '3px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap', background: value === s ? 'var(--snow-black-100)' : 'transparent', color: value === s ? '#fff' : 'var(--snow-black-40)', boxShadow: value === s ? 'none' : RING }}>{l}</button>
    ))}
  </div>
);

export const Dot = ({ c, size = 6 }) => <span style={{ width: size, height: size, borderRadius: '50%', background: c, flex: '0 0 auto' }} />;

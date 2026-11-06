import React, { useEffect, useRef, useState } from 'react';

export const RING = 'inset 0 0 0 1px rgba(0,0,0,0.1)';
export const RED = '#C8374B', REDBG = 'var(--snow-status-rejected-bg)';
export const cap = { fontSize: 12, lineHeight: '18px' };
export const body = { fontSize: 14, lineHeight: '20px' };
export const h3 = { fontSize: 18, lineHeight: '28px', fontWeight: 600 };
export const h2 = { fontSize: 24, lineHeight: '36px', fontWeight: 600 };
export const muted = { color: 'var(--snow-black-40)' };
export const PRI_BG = { High: REDBG, Medium: 'var(--snow-status-approved-bg)', Low: 'var(--snow-ink-5)' };
export const BAND_BG = { Investigate: 'var(--snow-status-rejected-bg)', Explain: 'var(--snow-status-pending-bg)', Expected: 'var(--snow-status-complete-bg)' };
export const STATUS_LABEL = { open: 'Open', info: 'Info Requested', cleared: 'Cleared' };
export const page = { padding: '20px var(--gutter) 40px', display: 'flex', flexDirection: 'column', gap: 20 };
export const hairBottom = { boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' };

export const Pill = ({ bg = 'var(--snow-ink-5)', children, style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...cap, background: bg, padding: '0 10px', height: 18, borderRadius: 18, whiteSpace: 'nowrap', ...style }}>{children}</span>
);
export const PriPill = ({ pri }) => <Pill bg={PRI_BG[pri]}>{pri}</Pill>;

export const Card = ({ children, tint, style }) => (
  <div className={'card' + (tint ? ' card-tint' : '')} style={{ background: tint || undefined, padding: 'var(--card-pad)', ...style }}>{children}</div>
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

// A figure tile. With `onClick` it is a button that takes the reader to what it counts; `title` says where.
export const Tile = ({ bg, label, value, sub, flex = '1 1 140px', onClick, title }) => {
  const inner = <>
    <div style={{ ...body, fontWeight: 600 }}>{label}</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 12, flexWrap: 'wrap' }}>
      <span className="tile-value" style={h2}><CountUp value={value} /></span>
      {sub && <span style={{ ...cap, ...muted }}>{sub}</span>}
    </div>
  </>;
  const style = { flex, minWidth: 140, background: bg, padding: 'var(--card-pad)' };
  return onClick
    ? <button type="button" className="tile is-link" title={title} onClick={onClick} style={{ ...style, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch', border: 0, font: 'inherit', color: 'inherit', textAlign: 'left' }}>{inner}</button>
    : <div className="tile" style={style}>{inner}</div>;
};

export const Segmented = ({ options, value, onChange, children }) => (
  <div className="segmented" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', borderRadius: 12, padding: 4 }}>
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

// A number that counts up to its value when it appears or changes (static under reduced motion).
export function CountUp({ value, ms = 600 }) {
  const num = typeof value === 'number' && Number.isFinite(value);
  const [n, setN] = useState(num ? 0 : value);
  const from = useRef(0);
  useEffect(() => {
    if (!num || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); from.current = num ? value : 0; return; }
    const a = from.current, t0 = performance.now(); let raf;
    const tick = t => { const p = Math.min(1, (t - t0) / ms); setN(Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return num ? <><span aria-hidden="true">{n}</span><span className="sr-only">{value}</span></> : <>{value}</>;
}

// The review report: the permanent record of a fund's review, made as a PDF at the final sign-off (the
// Manager's, or the Partner's where partner sign-off is required) and on demand as a DRAFT before it.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const INK = rgb(0.11, 0.11, 0.11), GREY = rgb(0.4, 0.42, 0.45), RULE = rgb(0.84, 0.85, 0.87), TINT = rgb(0.95, 0.96, 0.98), RED = rgb(0.7, 0.14, 0.1);
const W = 595.28, H = 841.89, M = 48;
const when = iso => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const day = iso => (iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const KIND = { raise: 'Raised', assign: 'Assigned', comment: 'Comment', response: 'Response', reopen: 'Reopened', clear: 'Cleared', note: 'Note' };
const STATE = { signed: 'Signed off', 'manager-signed': 'Manager signed off', returned: 'Returned to reviewer', resubmitted: 'Resubmitted', unlocked: 'Unlocked' };

export async function reviewReport({ eng, entity, snap, checks, slotName, checklist, ai, money, options, draft, version, user }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (s, f = font) => [...String(s ?? '')].map(ch => { try { f.encodeText(ch); return ch; } catch { return ch === '\u2192' ? '->' : '?'; } }).join('');
  const fund = eng.fund?.name || 'Fund';
  pdf.setTitle(safe(`Review report · ${fund} · ${draft ? 'DRAFT' : `v${version}`}`)); pdf.setAuthor(safe(user?.name || '')); pdf.setCreationDate(new Date());
  let page, y;
  const newPage = () => { page = pdf.addPage([W, H]); y = H - 56; };
  const need = h => { if (y - h < 60) newPage(); };
  const width = (s, size, f = font) => f.widthOfTextAtSize(safe(s, f), size);
  // line breaks are kept (split before the text is cleaned); a word wider than the column is broken
  const wrap = (s, w, size = 9, f = font) => {
    const out = [];
    for (const raw of String(s ?? '').split('\n')) {
      let line = '';
      for (let word of safe(raw, f).split(/\s+/)) {
        while (f.widthOfTextAtSize(word, size) > w && word.length > 1) {
          let n = word.length; while (n > 1 && f.widthOfTextAtSize(word.slice(0, n), size) > w) n--;
          if (line) { out.push(line); line = ''; }
          out.push(word.slice(0, n)); word = word.slice(n);
        }
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) > w && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const text = (s, x, yy, { size = 9, f = font, color = INK, right = false } = {}) => { const t = safe(s, f); page.drawText(t, { x: right ? x - f.widthOfTextAtSize(t, size) : x, y: yy, size, font: f, color }); };
  const h1 = s => { need(40); text(s, M, y, { size: 16, f: bold }); y -= 26; };
  const h2 = s => { need(46); y -= 6; text(s, M, y, { size: 12, f: bold }); page.drawLine({ start: { x: M, y: y - 5 }, end: { x: W - M, y: y - 5 }, thickness: 0.6, color: INK }); y -= 20; };
  const para = (s, { size = 9, color = INK, f = font, indent = 0 } = {}) => { for (const l of wrap(s, W - 2 * M - indent, size, f)) { need(size + 4); text(l, M + indent, y, { size, color, f }); y -= size + 3.5; } y -= 3; };
  const kv = rows => { for (const [k, v] of rows) { const ls = wrap(v, W - 2 * M - 150, 9); need(ls.length * 12.5 + 2); text(k, M, y, { color: GREY }); ls.forEach((l, i) => text(l, M + 150, y - i * 12.5)); y -= ls.length * 12.5 + 3; } y -= 4; };
  // a table: cols [{ label, w (share), right }], rows of cell strings; text wraps within each cell
  const table = (cols, rows) => {
    const total = W - 2 * M, ws = cols.map(c => c.w * total), xs = ws.map((_, i) => M + ws.slice(0, i).reduce((a, b) => a + b, 0));
    const header = () => { need(22); page.drawRectangle({ x: M, y: y - 5, width: total, height: 16, color: TINT }); cols.forEach((c, i) => text(c.label, c.right ? xs[i] + ws[i] - 4 : xs[i] + 4, y, { size: 8, f: bold, color: GREY, right: c.right })); y -= 18; };
    header();
    for (const r of rows) {
      const cells = r.map((c, i) => wrap(c, ws[i] - 8, 8.5, cols[i].bold ? bold : font)), hgt = Math.max(...cells.map(c => c.length)) * 11.5 + 4;
      if (y - hgt < 60) { newPage(); header(); }
      cells.forEach((ls, i) => ls.forEach((l, j) => text(l, cols[i].right ? xs[i] + ws[i] - 4 : xs[i] + 4, y - j * 11.5, { size: 8.5, right: cols[i].right, f: cols[i].bold ? bold : font, color: r.color?.[i] || INK })));
      y -= hgt; page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.3, color: RULE });
    }
    y -= 8;
  };

  // ---- cover ---------------------------------------------------------------------------------
  newPage();
  text(draft ? 'DRAFT REVIEW REPORT' : 'REVIEW REPORT', M, y, { size: 10, f: bold, color: draft ? RED : GREY }); y -= 24;
  text(fund, M, y, { size: 22, f: bold }); y -= 22;
  text(`${entity?.name || ''}${entity?.name ? ' · ' : ''}Year ended ${day(eng.fund?.yearEnd)}`, M, y, { size: 11, color: GREY }); y -= 30;
  const s = snap, so = s.signoff || {}, hist = so.history || [];
  const finalEntry = [...hist].reverse().find(h => h.state === 'signed'), mgrEntry = [...hist].reverse().find(h => h.state === 'manager-signed');
  const open = s.points.filter(p => p.status !== 'cleared').length;
  const diffs = checks.filter(c => c.result === 'Difference').length;
  page.drawRectangle({ x: M, y: y - 92, width: W - 2 * M, height: 104, color: TINT }); y -= 4;
  [['Conclusion', draft ? 'Not yet signed off' : `Signed off by ${finalEntry?.by?.name || '—'} on ${when(finalEntry?.at)}${options.partner ? ' (Partner sign-off)' : ''}`],
    ['Review points', `${s.points.length} raised; ${s.points.length - open} cleared${open ? `, ${open} open` : ''}`],
    ['Checks', `${checks.length} run; ${diffs} with a difference at the final analysis`],
    ['Analysis', s.latestRun ? `Last run ${when(s.latestRun.at)} by ${s.latestRun.by?.name || '—'}` : 'Not run'],
    ['Report', draft ? `Draft generated ${when(new Date().toISOString())} by ${user?.name}` : `Version ${version}, generated ${when(new Date().toISOString())}`]]
    .forEach(([k, v]) => { text(k, M + 12, y - 10, { color: GREY }); text(v, M + 130, y - 10, { f: bold }); y -= 18; });
  y -= 24;

  // ---- 1 engagement -------------------------------------------------------------------------
  h2('1. Engagement');
  const team = k => eng.fund?.[k] || '—';
  kv([['Client', `${entity?.name || '—'}${entity?.client && entity.client !== entity.name ? ` (${entity.client})` : ''}`], ['Fund', fund], ['Year end', day(eng.fund?.yearEnd)],
    ['Presentation currency', eng.fund?.currency || 'GBP'], ['Accounting framework', entity?.framework || 'Not set'],
    ['Team', `Preparer ${team('preparer')} · Reviewer ${team('reviewer')} · Manager ${team('manager')}${options.partner ? ` · Partner ${team('partner')}` : ''}`],
    ['Review threshold', money(eng.threshold)], ['Umbrella accounts', options.umbrella ? `Yes: read as “${options.umbrella}”` : 'No'],
    ['Partner sign-off', options.partner ? 'Required' : 'Not required (the Manager signs off last)'],
    ['Check rules overridden', options.overrides.length ? options.overrides.join(', ') : 'None: the firm template applied']]);

  // ---- 2 documents --------------------------------------------------------------------------
  h2('2. Documents reviewed');
  const cur = Object.entries(s.current || {});
  table([{ label: 'Document', w: 0.24, bold: true }, { label: 'File and version', w: 0.3 }, { label: 'Attached', w: 0.2 }, { label: 'Check', w: 0.26 }],
    cur.map(([slot, v]) => [slotName(slot), `${v.fileName} · v${v.version}${v.sample ? ' (built-in sample)' : ''}`, `${v.uploadedBy?.name || ''}\n${when(v.uploadedAt)}`,
      v.confirmation ? `Confirmed by ${v.confirmation.by?.name}: ${v.confirmation.reason}` : v.readWith === 'ai' ? `Read by AI (chosen by ${v.readWithBy?.name})` : v.validation?.summary || '—']));
  para('Content fingerprints (SHA-256) identify the exact files reviewed:', { color: GREY, size: 8 });
  cur.filter(([, v]) => v.sha256).forEach(([slot, v]) => para(`${slotName(slot)}: ${v.sha256}`, { size: 7, color: GREY }));

  // ---- 3 checks ------------------------------------------------------------------------------
  h2('3. Checks at the final analysis');
  table([{ label: 'Rule', w: 0.09, bold: true }, { label: 'Check', w: 0.3 }, { label: 'Detail', w: 0.43 }, { label: 'Result', w: 0.18 }],
    checks.map(c => Object.assign([c.rule || '', c.name, c.detail || '', c.result === 'Difference' ? (c.count ? `${c.diff} found` : `Difference ${money(Math.abs(c.diff))}`) : c.result],
      { color: [null, null, null, c.result === 'Difference' ? RED : null] })));

  // ---- 4 review points ----------------------------------------------------------------------
  h2('4. Review points');
  if (!s.points.length) para('No review points were raised.');
  const byPoint = id => (s.messages || []).filter(m => m.pointId === id).sort((a, b) => a.at.localeCompare(b.at));
  for (const p of [...s.points].sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }))) {
    need(60); const c = p.content || {};
    text(`${p.ref}  ${c.title || ''}`.slice(0, 120), M, y, { size: 10, f: bold }); y -= 13;
    para(`${c.pri || ''} priority · ${c.area || ''} · status ${p.status}${p.dueDate ? ` · due ${day(p.dueDate)}` : ''}${c.rule ? ` · ${c.rule}` : ''}${c.aiDrafted ? ' · drafted by AI' : ''}`, { color: GREY, size: 8 });
    if (c.basis) para(c.basis, { size: 8.5 });
    for (const m of byPoint(p.id)) {
      const att = (m.attachments || []).map(a => (a.type === 'version' ? `revised ${slotName(a.slot)} v${a.version}` : `evidence ${a.fileName}`)).join(', ');
      para(`${KIND[m.kind] || m.kind} · ${m.author?.name || ''} · ${when(m.at)}${m.text ? `: ${m.text}` : ''}${att ? ` [${att}]` : ''}`, { size: 8, indent: 12 });
    }
    y -= 4;
  }

  // ---- 5 disclosure checklist ---------------------------------------------------------------
  if (checklist) {
    h2('5. Disclosure checklist');
    para(`${checklist.framework} checklist, version ${checklist.version}${checklist.version === 'starter' ? ' (starter checklist)' : ''}.`, { color: GREY, size: 8.5 });
    const A = { yes: 'Yes', no: 'No', na: 'N/A' };
    table([{ label: 'Ref', w: 0.12 }, { label: 'Requirement', w: 0.46 }, { label: 'Answer', w: 0.1, bold: true }, { label: 'Reference and who', w: 0.32 }],
      checklist.items.map(i => { const a = checklist.answers?.[i.id]; return Object.assign([i.ref, i.text, a ? A[a.answer] : 'Not answered', a ? `${a.ref || ''}${a.ref ? '\n' : ''}${a.by?.name || ''}, ${when(a.at)}` : ''], { color: [null, null, a?.answer === 'no' || !a ? RED : null, null] }); }));
  }

  // ---- 6 sign-off ----------------------------------------------------------------------------
  h2(`${checklist ? 6 : 5}. Sign-off`);
  if (!hist.length) para('Not yet signed off.');
  for (const h of hist) {
    need(30); text(`${STATE[h.state] || h.state} · ${h.by?.name || ''} · ${when(h.at)}`, M, y, { f: bold }); y -= 13;
    if (h.text) para(`“${h.text}”`, { indent: 12 });
    const att = h.summary?.attention || [];
    if ((h.state === 'signed' || h.state === 'manager-signed') && att.length) para(`Acknowledged at sign-off: ${att.map(a => a.title || a).join('; ')}`, { indent: 12, size: 8, color: GREY });
  }
  if (mgrEntry && finalEntry && options.partner) para(`Manager sign-off by ${mgrEntry.by?.name} on ${when(mgrEntry.at)}; Partner sign-off by ${finalEntry.by?.name} on ${when(finalEntry.at)}.`, { color: GREY, size: 8.5 });

  // ---- 7 AI and OCR --------------------------------------------------------------------------
  h2(`${checklist ? 7 : 6}. Use of AI and OCR`);
  para(ai.summary);
  if (ai.ocr.length) para(`Read from scanned pages with OCR (Tesseract, on the firm’s server, no AI): ${ai.ocr.join(', ')}.`);
  para('This report records the review carried out with the FS Review application. The application supports the reviewer’s judgement; it does not establish that the financial statements are complete or correct.', { size: 8, color: GREY });

  // ---- footer and watermark on every page ----------------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    if (draft) p.drawText('DRAFT', { x: 150, y: 330, size: 120, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.08, rotate: degrees(40) });
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.4, color: RULE });
    p.drawText(safe(`Review report · ${fund} · ${draft ? 'DRAFT' : `version ${version}`}`), { x: M, y: 32, size: 7.5, font, color: GREY });
    const pg = `Page ${i + 1} of ${pages.length}`; p.drawText(pg, { x: W - M - font.widthOfTextAtSize(pg, 7.5), y: 32, size: 7.5, font, color: GREY });
  });
  return pdf.save();
}

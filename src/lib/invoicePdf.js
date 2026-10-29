// The invoice as a PDF, made in the browser (pdf-lib), so it can be downloaded or emailed.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { totals, money } from './billing';

const INK = rgb(0.11, 0.11, 0.11), GREY = rgb(0.38, 0.4, 0.42), RULE = rgb(0.82, 0.83, 0.85), TINT = rgb(0.95, 0.96, 0.98);
const d = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export async function invoicePdf(inv, settings) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // keep only characters the standard font can draw
  const safe = (s, f = font) => [...String(s ?? '')].map(ch => { try { f.encodeText(ch); return ch; } catch { return '?'; } }).join('');
  pdf.setTitle(`${inv.number || 'Draft invoice'} · ${safe(inv.clientName)}`); pdf.setAuthor(safe(settings.firmName || 'Invoice')); pdf.setCreationDate(new Date());
  let page = pdf.addPage([595.28, 841.89]); const W = 595.28, M = 50; let y = 790;
  const text = (s, x, yy, { size = 10, f = font, color = INK, right = false } = {}) => { const t = safe(s, f); page.drawText(t, { x: right ? x - f.widthOfTextAtSize(t, size) : x, y: yy, size, font: f, color }); };
  const wrap = (s, width, size = 10, f = font) => { const out = []; let line = ''; for (const w of safe(s, f).split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; };
  const t = totals(inv), f = inv.settingsAtIssue || settings;

  // header: the firm, and the invoice's own details
  text(f.firmName || 'Invoice', M, y, { size: 16, f: bold });
  wrap(f.firmAddress || '', 260, 9).forEach((l, i) => text(l, M, y - 16 - i * 12, { size: 9, color: GREY }));
  if (f.vatNumber) text(`VAT number: ${f.vatNumber}`, M, y - 16 - (wrap(f.firmAddress || '', 260, 9).length) * 12, { size: 9, color: GREY });
  text(inv.status === 'draft' ? 'DRAFT INVOICE' : 'INVOICE', W - M, y, { size: 16, f: bold, right: true });
  [['Invoice number', inv.number || 'Draft'], ['Date', d(inv.issuedAt) || d(new Date().toISOString())], ['Due', d(inv.dueDate) || `${inv.termsDays} days from issue`]]
    .forEach(([k, v], i) => { text(k, W - M - 150, y - 22 - i * 14, { size: 9, color: GREY }); text(v, W - M, y - 22 - i * 14, { size: 9, f: bold, right: true }); });
  y -= 100;
  page.drawRectangle({ x: M, y: y - 44, width: W - 2 * M, height: 52, color: TINT });
  text('Bill to', M + 12, y - 4, { size: 8, color: GREY }); text(inv.clientName, M + 12, y - 18, { size: 11, f: bold });
  text(`${inv.fundName}${inv.yearEnd ? ` · year ended ${d(inv.yearEnd)}` : ''}`, M + 12, y - 32, { size: 9, color: GREY });
  y -= 76;

  // lines
  text('Description', M, y, { size: 9, f: bold, color: GREY }); text('Amount (GBP)', W - M, y, { size: 9, f: bold, color: GREY, right: true });
  page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.8, color: INK }); y -= 22;
  for (const l of inv.lines) {
    const ls = wrap(l.description, W - 2 * M - 120, 10);
    if (y - ls.length * 13 < 140) { page = pdf.addPage([595.28, 841.89]); y = 790; }
    ls.forEach((s, i) => text(s, M, y - i * 13));
    text(money(l.amount).replace('£', ''), W - M, y, { right: true });
    if (l.kind === 'ai' && l.costAtCost != null) text(`AI usage at cost ${money(l.costAtCost)}${l.markupPct ? ` plus ${l.markupPct}%` : ''}`, M, y - ls.length * 13, { size: 8, color: GREY });
    y -= ls.length * 13 + (l.kind === 'ai' ? 20 : 10);
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.3, color: RULE });
  }
  // totals
  y -= 6;
  const row = (k, v, b = false) => { text(k, W - M - 200, y, { size: 10, f: b ? bold : font }); text(v, W - M, y, { size: 10, f: b ? bold : font, right: true }); y -= 16; };
  row('Net', money(t.net)); row(`VAT at ${inv.vatRate}%`, money(t.vat)); page.drawLine({ start: { x: W - M - 200, y: y + 12 }, end: { x: W - M, y: y + 12 }, thickness: 0.6, color: INK }); row('Total', money(t.gross), true);
  for (const c of inv.creditNotes || []) row(`Credit note ${c.number}`, `(${money(c.amount)})`);
  if (t.paid) row('Paid', `(${money(t.paid)})`);
  if (inv.status === 'issued' && (t.paid || t.credited || t.writtenOff)) row('Balance due', money(t.outstanding), true);
  y -= 16;
  text(`Payment terms: ${inv.termsDays} days. Please quote ${inv.number || 'the invoice number'} with your payment.`, M, y, { size: 9, color: GREY });
  if (inv.notes) wrap(inv.notes, W - 2 * M, 9).forEach((l, i) => text(l, M, y - 14 - i * 12, { size: 9 }));
  pdf.getPages().forEach((p, i, all) => { p.drawText(safe(`${f.firmName || ''}${f.firmName ? ' · ' : ''}${inv.number || 'Draft'} · page ${i + 1} of ${all.length}`), { x: M, y: 30, size: 8, font, color: GREY }); });
  return pdf.save();   // Uint8Array
}
export const toBase64 = bytes => { let s = ''; const c = 0x8000; for (let i = 0; i < bytes.length; i += c) s += String.fromCharCode(...bytes.subarray(i, i + c)); return btoa(s); };

// Disclosure checklist (CHK-13): which checklist applies, where an item may be disclosed in the draft
// (a keyword search, no AI), and the result for the checks table.
import { STARTER } from '../data/disclosureChecklists';

export const checklistFor = (framework, firmConfig) => (framework ? (firmConfig?.checklists?.[framework] || STARTER[framework] || null) : null);

// Where an item may be disclosed: the first heading, paragraph or table line that contains a keyword.
export function suggestLocation(item, cy) {
  let head = '';
  for (const b of cy?.blocks || []) {
    if (b.k === 'head') { head = b.title || ''; if (hit(item, head)) return { where: head, snippet: head }; continue; }
    const texts = b.k === 'para' ? [b.text] : b.k === 'table' ? (b.rows || []).map(r => r.l) : [];
    for (const t of texts) { const k = hit(item, t); if (k) return { where: head || 'Draft', snippet: excerpt(t, k) }; }
  }
  return null;
}
const hit = (item, text) => (item.keywords || []).find(k => String(text || '').toLowerCase().includes(String(k).toLowerCase()));
const excerpt = (t, k) => { const i = t.toLowerCase().indexOf(k.toLowerCase()); return (i > 40 ? '…' : '') + t.slice(Math.max(0, i - 40), i + k.length + 60).trim() + '…'; };

export function checklistSummary(list, state) {
  const items = list?.items || [], ans = state?.answers || {};
  const answered = items.filter(i => ans[i.id]?.answer).length, no = items.filter(i => ans[i.id]?.answer === 'no');
  return { total: items.length, answered, unanswered: items.length - answered, no: no.length, noItems: no };
}

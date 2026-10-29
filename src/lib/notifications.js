// Alerts and notifications for the signed-in person, worked out from the review data of every fund.
//   actions: things waiting for this person now; they disappear once done.
//   updates: things other people did that concern this person, newest first.
// A fund's Preparer, Reviewer and Manager fields decide who is "theirs"; when a field is empty,
// everyone whose role has the matching permission is included.
import { can, canClearPoint } from './roles';
import { contentChanges, contentKey } from './reviewStore';
import { umbrellaFor } from './engagementOptions';

export function computeNotifications({ all, engagements, entities = [], user, noServer = false }) {
  const actions = [], updates = [];
  const byId = Object.fromEntries((engagements || []).map(e => [e.id, e]));
  // every fund, including ones with no review activity yet (they can still have alerts, e.g. umbrella drafts)
  const EMPTY = { versions: [], current: {}, workflow: { state: 'preparing', history: [] }, points: [], messages: [], signoff: { state: 'none', history: [] }, latestRun: null };
  for (const eng of engagements || []) {
    const engId = eng.id, s = all?.[engId] || EMPTY;
    const fund = eng.fund?.name || 'Untitled fund';
    const mine = (field, perm) => can(user, perm) && (eng.fund?.[field + 'Id'] ? eng.fund[field + 'Id'] === user.id : true);
    const base = { engagementId: engId, fund };
    const add = (list, item) => list.push({ ...base, ...item, id: `${list === actions ? 'a' : 'u'}:${engId}:${item.key}` });

    // ---- needs your action ----
    for (const p of s.points) {
      const ref = p.ref, title = p.content?.title || '';
      if (can(user, 'points.respond') && ['open', 'reopened'].includes(p.status) && (p.assignedTo ? p.assignedTo.id === user.id : mine('preparer', 'points.respond')))
        add(actions, { key: 'respond:' + ref, title: p.status === 'reopened' ? `${ref} was reopened and needs your response` : `${ref} is waiting for your response`, detail: title, at: p.updatedAt, tab: 'sched', ref });
      const overdue = p.dueDate && p.status !== 'cleared' && p.dueDate < new Date().toISOString().slice(0, 10);
      if (overdue && ['open', 'reopened'].includes(p.status) && p.assignedTo?.id === user.id)
        add(actions, { key: 'overdue:' + ref, title: `${ref} is overdue (due ${p.dueDate})`, detail: title, at: p.updatedAt, tab: 'sched', ref });
      if (p.status === 'responded' && canClearPoint(user, p))
        add(actions, { key: 'clear:' + ref, title: `${ref} has a response for you to review`, detail: title, at: p.updatedAt, tab: 'sched', ref });
    }
    const run = s.latestRun, wf = s.workflow, so = s.signoff || { state: 'none' };
    const changedSinceRun = run ? contentChanges(s, run).length > 0 : true;           // by content, not version number
    const canAnalyseHere = !noServer || Object.values(s.current).every(v => v.sample || v.validation?.localReadable); // other real documents need the server
    if (wf.state === 'returned' && mine('preparer', 'documents.attach'))
      add(actions, { key: 'docs-returned', title: 'Documents were sent back to you', detail: wf.reason, at: wf.at, tab: 'docs' });
    if (wf.state === 'ready' && so.state !== 'signed' && changedSinceRun && canAnalyseHere && mine('reviewer', 'analysis.run'))
      add(actions, { key: 'docs-ready', title: run ? 'Changed documents are ready to analyse again' : 'Documents are ready to analyse', detail: `Marked ready by ${wf.by?.name || 'the preparer'}`, at: wf.at, tab: 'docs' });
    const allCleared = s.points.every(p => p.status === 'cleared');
    if (run && wf.state === 'ready' && allCleared && !['signed', 'returned'].includes(so.state) && mine('manager', 'review.signoff'))
      add(actions, { key: 'signoff', title: 'Ready for your sign-off', detail: `All ${s.points.length} review points are cleared`, at: so.at || run.at, tab: 'signoff' });
    if (so.state === 'manager-signed' && mine('partner', 'review.partnerSignoff'))
      add(actions, { key: 'partner', title: 'Ready for your partner sign-off', detail: `Signed off by the Manager, ${so.by?.name || ''}`, at: so.at, tab: 'signoff' });
    if (so.state === 'returned' && (can(user, 'points.clear') || can(user, 'points.clearAny')) && mine('reviewer', 'points.clear'))
      add(actions, { key: 'signoff-returned', title: 'The review was returned to you', detail: so.text, at: so.at, tab: 'signoff' });

    // a scanned document read with low OCR confidence: someone needs to choose AI, the OCR reading or a clearer scan
    for (const v of Object.values(s.current)) if (v.validation?.ocrLow && !v.confirmation && v.readWith !== 'ai' && mine('preparer', 'documents.attach'))
      add(actions, { key: 'ocr:' + v.id, title: `Low OCR confidence on ${v.fileName}`, detail: `${v.validation.ocrLow}% confidence: choose AI, the OCR reading, or a clearer scan`, at: v.uploadedAt, tab: 'docs' });

    // umbrella: a sister fund of the same client has a newer umbrella draft than this fund
    const ent = (entities || []).find(x => x.id === eng.entityId);
    if (umbrellaFor(eng, ent) && mine('preparer', 'documents.attach') && so.state !== 'signed') {
      const mineCy = s.current.cy;
      for (const sib of (engagements || []).filter(e => e.entityId === eng.entityId && e.id !== engId && umbrellaFor(e, ent))) {
        const sc = all[sib.id]?.current?.cy;
        if (sc && !sc.sample && contentKey(sc) !== contentKey(mineCy) && (!mineCy || sc.uploadedAt > mineCy.uploadedAt))
          add(actions, { key: 'umb:' + sib.id, title: `A newer umbrella draft is in ${sib.fund?.name}`, detail: `${sc.fileName} (v${sc.version}): attach it here from the Documents screen`, at: sc.uploadedAt, tab: 'docs' });
      }
    }

    // ---- updates from other people ----
    const pointOf = Object.fromEntries(s.points.map(p => [p.id, p]));
    for (const m of s.messages) {
      const p = pointOf[m.pointId]; if (!p || !m.author || m.author.id === user.id) continue;
      const who = m.author.name, ref = p.ref, toRaiser = p.raisedBy?.id === user.id, toAssignee = p.assignedTo?.id === user.id;
      const item = (title, tab = 'sched') => add(updates, { key: m.id, title, detail: m.text, at: m.at, tab, ref });
      if (m.kind === 'response' && toRaiser) item(`${who} responded to ${ref}`);
      else if (m.kind === 'reopen' && toAssignee) item(`${who} reopened ${ref}`);
      else if (m.kind === 'clear' && toAssignee) item(`${who} cleared ${ref}`);
      // the analysis's own assignments are summarised once ("ran the analysis… N points assigned to you")
      else if (m.kind === 'assign' && toAssignee && m.text.includes(user.name)
        && !(p.source === 'analysis' && m.author.id === p.raisedBy?.id && Math.abs(Date.parse(m.at) - Date.parse(p.raisedAt)) < 5000)) item(`${who} assigned ${ref} to you`);
      else if (m.kind === 'comment' && (toRaiser || toAssignee)) item(`${who} commented on ${ref}`);
      else if (m.kind === 'raise' && p.source === 'manual' && toAssignee) item(`${who} raised ${ref} for you`);
    }
    if (run && run.by?.id !== user.id && mine('preparer', 'points.respond')) {
      const n = s.points.filter(p => p.assignedTo?.id === user.id && p.status !== 'cleared').length;
      add(updates, { key: 'run:' + run.id, title: `${run.by?.name} ran the analysis of draft v${run.version}`, detail: n ? `${n} point${n === 1 ? '' : 's'} assigned to you` : '', at: run.at, tab: 'sched' });
    }
    for (const h of wf.history || []) {
      if (!h.by || h.by.id === user.id) continue;
      if (h.state === 'ready' && mine('reviewer', 'analysis.run')) add(updates, { key: 'wf:' + h.at, title: `${h.by.name} marked the documents ready for review`, at: h.at, tab: 'docs' });
      if (h.state === 'returned' && mine('preparer', 'documents.attach')) add(updates, { key: 'wf:' + h.at, title: `${h.by.name} sent the documents back`, detail: h.reason, at: h.at, tab: 'docs' });
    }
    for (const h of so.history || []) {
      if (!h.by || h.by.id === user.id) continue;
      const t = { returned: [`${h.by.name} returned the review to the reviewer`, mine('reviewer', 'points.clear')],
        resubmitted: [`${h.by.name} resubmitted the review for sign-off`, mine('manager', 'review.signoff')],
        signed: [`${h.by.name} signed off ${fund}`, mine('preparer', 'points.respond') || mine('reviewer', 'points.clear')],
        unlocked: [`${h.by.name} unlocked ${fund} after sign-off`, mine('preparer', 'points.respond') || mine('reviewer', 'points.clear')] }[h.state];
      if (t && t[1]) add(updates, { key: 'so:' + h.at, title: t[0], detail: h.text, at: h.at, tab: 'signoff' });
    }
  }
  actions.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  updates.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return { actions, updates: updates.slice(0, 60) };
}

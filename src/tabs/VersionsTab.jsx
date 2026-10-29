import React from 'react';
import { gbp, plural } from '../lib/format';
import { ACCEPT } from '../lib/fileRules';
import { validateFile } from '../lib/validateFile';
import { Button, Card, FileButton, PriPill, Dot, Tile, RED, REDBG, cap, body, h2, muted, page } from '../components/ui';

export default function VersionsTab({ result, points, onNextDraft, onAttachNextDraft, running, canRun = true, nextDraftBlock = '', onRejected }) {
  const [problem, setProblem] = React.useState('');
  const nextDraft = async f => {
    const why = await validateFile('cy', f, 'The next draft');
    setProblem(why);
    if (why) { onRejected?.({ id: 'cy', name: 'Next draft' }, f, why); return; }
    setProblem(await onAttachNextDraft({ name: f.name, file: f, sample: false }));
  };
  const v = result.version;
  const outstanding = points.filter(p => p.agent === 'outstanding' && p.status !== 'cleared');
  const introduced = points.filter(p => p.agent === 'new' && p.status !== 'cleared');
  const resolved = [...(result.priorResolved || []), ...points.filter(p => p.agent === 'resolved' || p.status === 'cleared')];
  const cols = [
    ['Resolved', 'var(--snow-status-complete)', 'Re-tested against the new draft and agreed to source. No further action.', resolved],
    ['Outstanding', 'var(--snow-status-approved)', 'Raised on an earlier draft and not yet addressed, or addressed without evidence.', outstanding],
    ['Newly Introduced', RED, 'Not present in the earlier draft — arising from changes made between versions.', introduced]
  ];
  const demoV3Available = result.demo && v === 2;

  return (
    <div style={page}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '2 1 380px', minWidth: 280, background: 'var(--snow-primary-purple)', borderRadius: 16, padding: 24 }}>
          <div style={{ ...cap, ...muted }}>Version Pass</div>
          <div style={{ ...h2, marginTop: 6 }}>{v > 1 ? `Draft v${v - 1} → Draft v${v}` : 'Draft v1 — first pass'}</div>
          <div style={{ ...body, marginTop: 8, maxWidth: 620 }}>Every point raised on the earlier draft is re-tested against the new one, and the new draft is read for matters not previously present. Resolution is assessed against the evidence on file; where no evidence was provided the point stays outstanding.</div>
        </div>
        <Tile bg="var(--snow-status-complete-bg)" label="Resolved" value={resolved.length} />
        <Tile bg="var(--snow-status-approved-bg)" label="Outstanding" value={outstanding.length} />
        <Tile bg={REDBG} label="Newly Introduced" value={introduced.length} />
      </div>

      <Card style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ ...body, fontWeight: 600 }}>Review the next version</div>
          <div style={{ ...cap, ...muted, marginTop: 4 }}>Attach the next draft and the analysis runs again, separating points that have been resolved from those still outstanding and any newly introduced.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canRun ? <>
            {nextDraftBlock ? <span style={{ ...cap, ...muted, maxWidth: 320 }}>A real next draft can’t be analysed here: {nextDraftBlock.split('.')[0].toLowerCase()}.</span>
              : <FileButton label={running ? 'Analysing…' : 'Attach Next Draft'} accept={ACCEPT.pdf} onFile={nextDraft} />}
            {demoV3Available && <Button kind="secondary" disabled={running} onClick={() => onNextDraft({ name: 'MGEF_2025_draft_FS_v3.pdf', sample: true })}>Use Sample v3</Button>}
          </> : <span style={{ ...cap, ...muted, maxWidth: 260 }}>Your role cannot run the version pass.</span>}
          {problem && <div role="alert" style={{ ...cap, flexBasis: '100%', background: 'rgba(255,71,71,0.1)', borderRadius: 8, padding: '8px 10px' }}>{problem}</div>}
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {cols.map(([title, c, note, items]) => (
          <div key={title} style={{ flex: '1 1 300px', minWidth: 270, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 4px' }}>
              <Dot c={c} size={8} /><span style={{ ...body, fontWeight: 600 }}>{title}</span><span style={{ ...cap, ...muted }}>{plural(items.length, 'point')}</span>
            </div>
            <div style={{ ...cap, ...muted, padding: '0 4px 4px' }}>{note}</div>
            {items.map(i => (
              <Card key={i.ref}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ ...cap, ...muted }}>{i.ref}</span><PriPill pri={i.pri} /></div>
                <div style={{ ...body, fontWeight: 600, marginTop: 6 }}>{i.title}</div>
                <div style={{ ...cap, marginTop: 8 }}>{i.agentNote || i.note || i.basis}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: 12, paddingTop: 10, boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.1)' }}>
                  <span style={{ ...cap, ...muted }}>{(i.refs || '').split(' · ')[0]}</span><span style={body}>{gbp(i.amount)}</span>
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

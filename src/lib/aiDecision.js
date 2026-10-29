// The client's decision on AI, recorded on its entity when it is onboarded, and an optional opt-out
// for a single fund. A fund may use AI only when its client said yes and the fund is not opted out.
// A client with no recorded decision is treated as "no AI" until someone records one.
export const entityAi = ent => (!ent || !ent.aiDecidedAt ? 'undecided' : ent.aiPermitted === true ? 'permitted' : 'not-permitted');
export function fundAi(eng, ent) {
  const e = entityAi(ent);
  return e !== 'permitted' ? e : eng?.aiOff ? 'off-for-fund' : 'permitted';
}
export const AI_LABEL = { permitted: 'AI permitted', 'not-permitted': 'AI not permitted', undecided: 'AI not decided', 'off-for-fund': 'AI off for this fund' };
export const AI_REASON = {
  undecided: 'The client’s decision on AI has not been recorded, so this fund is reviewed without AI. A Manager records the decision on the client’s entity (Engagement › Edit Entity).',
  'not-permitted': 'The client does not permit AI, so this fund is reviewed without AI.',
  'off-for-fund': 'AI is turned off for this fund, so it is reviewed without AI.'
};

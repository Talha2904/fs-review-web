// The four places the app uses AI, and the models an Administrator can choose. Shared by the
// server (which enforces the settings) and the app (which explains them).
export const AI_STEPS = [
  { id: 'extract', label: 'Reading real documents', desc: 'Turns an uploaded PDF or spreadsheet into structured statements and figures.',
    off: 'Real documents can be attached and checked, but not analysed. The built-in samples still work.' },
  { id: 'narrative', label: 'Narrative review', desc: 'Finds stale wording, wrong directors, missing subsequent events, currency labels, and the firm’s own narrative rules.',
    off: 'The analysis runs without narrative points; recalculation checks still run.' },
  { id: 'explain', label: 'Variance explanations', desc: 'Writes the explanation for each flagged movement.',
    off: 'Movements are still flagged by the app’s own arithmetic, without written explanations.' },
  { id: 'version', label: 'Version pass', desc: 'Decides which points a new draft resolved, which are still outstanding, and what is new.',
    off: 'A new draft is analysed as a fresh analysis; existing points keep their status and the reviewer decides.' }
];
export const MODELS = [
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'Recommended: strong accuracy at moderate cost and speed.' },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'Most thorough; slower and more expensive.' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'Fastest and lowest cost; best for simpler documents.' }
];
export const DEFAULT_AI = { enabled: false, acknowledgement: null, steps: { extract: true, narrative: true, explain: true, version: true }, model: 'claude-sonnet-5-5' };
export function normalizeAi(s) {
  const steps = Object.fromEntries(AI_STEPS.map(x => [x.id, s?.steps?.[x.id] !== false]));
  const model = MODELS.some(m => m.id === s?.model) ? s.model : DEFAULT_AI.model;
  return { enabled: !!s?.enabled && !!s?.acknowledgement, acknowledgement: s?.acknowledgement || null, steps, model };
}
export const stepLabel = id => AI_STEPS.find(s => s.id === id)?.label || id;

// Roles and what each may do. Used by the app to show or hide controls; the api enforces the same rules
// (its shared/src/roles.ts) in every use case, which is what actually protects the data.
export const ROLES = ['Administrator', 'Partner', 'Manager', 'Reviewer', 'Preparer', 'Finance'];

// The permission matrix. Administrators always have full access and work in the administration
// area; the rows below are what the Administrator can grant to the other roles. Saved by the
// Administrator in the api's database (the permission_matrix table), enforced by the api and reflected in the app.
export const STAFF_ROLES = ['Partner', 'Manager', 'Reviewer', 'Preparer'];
export const EDITABLE_PERMS = [
  { id: 'engagements.edit', label: 'Add and edit engagements', verb: 'sets up engagements' },
  { id: 'documents.attach', label: 'Attach documents', verb: 'attaches documents' },
  { id: 'analysis.run', label: 'Run the analysis and version pass', verb: 'runs the analysis' },
  { id: 'points.raise', label: 'Raise review points and assign them', verb: 'raises review points' },
  { id: 'points.respond', label: 'Respond to review points', verb: 'responds to review points' },
  { id: 'points.clear', label: 'Clear or reopen points they raised', verb: 'clears their own points', noPreparer: true },
  { id: 'points.clearAny', label: 'Clear or reopen any point', verb: 'clears any point', noPreparer: true },
  { id: 'review.signoff', label: 'Sign off the review, or unlock it', verb: 'signs off reviews', noPreparer: true },
  { id: 'review.partnerSignoff', label: 'Partner sign-off, where a client or fund requires it', verb: 'gives the partner sign-off', noPreparer: true }
];
export const DEFAULT_MATRIX = {
  'engagements.edit': ['Manager'],
  'documents.attach': ['Manager', 'Reviewer', 'Preparer'],
  'analysis.run': ['Manager', 'Reviewer'],
  'points.raise': ['Partner', 'Manager', 'Reviewer'],
  'points.respond': ['Preparer'],
  'points.clear': ['Manager', 'Reviewer'],
  'points.clearAny': ['Partner', 'Manager'],
  'review.signoff': ['Manager'],
  'review.partnerSignoff': ['Partner']
};
// Not editable: only Administrators manage users, permissions and check rules, and read the log.
// Finance works only in the billing module: invoices, payments and recovery, never review content.
const FIXED = { 'users.manage': ['Administrator'], 'activity.read': ['Administrator'], 'activity.write': ROLES, 'billing.manage': ['Finance'] };

// Keeps only known permissions and staff roles, in a stable order.
// A Preparer can never clear a point: the person who raised it (or a senior) accepts the answer.
export function normalizeMatrix(m) {
  const src = { ...(m || {}) };
  if (Array.isArray(src['points.edit']) && !Array.isArray(src['points.raise'])) src['points.raise'] = src['points.edit']; // matrices saved before the split
  return Object.fromEntries(EDITABLE_PERMS.map(({ id, noPreparer }) => {
    const roles = Array.isArray(src[id]) ? src[id] : DEFAULT_MATRIX[id];
    return [id, STAFF_ROLES.filter(r => roles.includes(r) && !(noPreparer && r === 'Preparer'))];
  }));
}
let current = normalizeMatrix(DEFAULT_MATRIX);
export const setPermissions = m => { current = normalizeMatrix(m); };
export const getPermissions = () => current;

export function describeRole(role, matrix = current) {
  if (role === 'Administrator') return 'Manages users, roles, permissions and the firm’s check rules.';
  if (role === 'Finance') return 'Invoices signed-off reviews, including AI usage, and records payments and recovery.';
  const verbs = EDITABLE_PERMS.filter(p => matrix[p.id]?.includes(role)).map(p => p.verb);
  if (!verbs.length) return 'Views engagements, the analysis and review points.';
  const list = verbs.length > 1 ? verbs.slice(0, -1).join(', ') + ' and ' + verbs[verbs.length - 1] : verbs[0];
  return list.charAt(0).toUpperCase() + list.slice(1) + '.';
}

// Which part of the app a role works in: Administrators get the admin area only.
export const isAdminArea = user => user?.role === 'Administrator';
export const isFinanceArea = user => user?.role === 'Finance';

// Clearing or reopening a point: the person who raised it, if their role may clear their own points,
// or anyone whose role may clear any point.
export const canClearPoint = (user, point, matrix = current) =>
  can(user, 'points.clearAny', matrix) || (can(user, 'points.clear', matrix) && point?.raisedBy?.id === user?.id);

export function can(user, permission, matrix = current) {
  if (!user || user.active === false) return false;
  if (FIXED[permission]) return FIXED[permission].includes(user.role);
  if (user.role === 'Preparer' && EDITABLE_PERMS.find(p => p.id === permission)?.noPreparer) return false;
  if (user.role === 'Administrator') return true;
  return (matrix[permission] || []).includes(user.role);
}

export const MIN_PASSWORD = 8;
export function passwordProblem(pw) {
  if (!pw || pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  return '';
}
export const cleanUsername = u => String(u || '').trim().toLowerCase();
export const usernameProblem = u => (/^[a-z0-9._-]{3,40}$/.test(cleanUsername(u)) ? '' : 'Use 3 to 40 letters, numbers, dots, dashes or underscores.');

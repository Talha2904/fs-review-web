// Preparer, reviewer and manager are chosen from the staff directory. A fund stores the
// person's user id (preparerId, reviewerId, managerId) plus their name at the time, so screens
// show the person's current name and older funds saved with typed names still display.
export const ASSIGNEES = [
  { key: 'preparer', role: 'Preparer', label: 'Preparer' },
  { key: 'reviewer', role: 'Reviewer', label: 'Reviewer' },
  { key: 'manager', role: 'Manager', label: 'Manager' },
  { key: 'partner', role: 'Partner', label: 'Partner' }
];
export function personName(fund, key, people = []) {
  const id = fund?.[key + 'Id'];
  return (id && people.find(p => p.id === id)?.name) || fund?.[key] || '';
}

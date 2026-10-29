// Wording for user-account changes, the same as the api's shared/src/activityText.ts so the log reads the same.
export function describeUserChange(before, after, passwordReset) {
  const out = [];
  if (after.name !== before.name) out.push(`Renamed ${before.name} to ${after.name}`);
  if (after.role !== before.role) out.push(`Changed ${after.name}’s role from ${before.role} to ${after.role}`);
  if (after.active !== before.active) out.push(`${after.active ? 'Reactivated' : 'Deactivated'} ${after.name} (${after.username})`);
  if (passwordReset) out.push(`Reset the password for ${after.name} (${after.username})`);
  return out;
}

// One line per change to the permission matrix.
export function describeMatrixChange(before, after, perms, roles) {
  const out = [];
  for (const p of perms) for (const r of roles) {
    const was = before[p.id]?.includes(r), now = after[p.id]?.includes(r);
    if (was !== now) out.push(`${now ? 'Granted' : 'Removed'} ${r}: ${p.label}`);
  }
  return out;
}

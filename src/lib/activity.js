// Activity log client: entries are posted to /api/activity; the api stamps who did it from the session.
import { createContext, useContext } from 'react';

export function makeActivity() {
  return {
    log: (category, summary, details = '', meta = {}) => fetch('/api/activity', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, summary, details, engagementId: meta.engagementId || null, fundName: meta.fundName || null }) }).catch(() => {}),
    list: async ({ engagementId } = {}) => {
      const r = await fetch('/api/activity?limit=5000' + (engagementId ? '&engagementId=' + encodeURIComponent(engagementId) : ''), { credentials: 'same-origin' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error?.message || j?.error || 'The activity log could not be loaded.');
      return j.entries;
    }
  };
}

export const ActivityContext = createContext({ log: () => {}, list: async () => [] });
export const useActivity = () => useContext(ActivityContext);

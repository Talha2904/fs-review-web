import { useEffect, useState } from 'react';
import { reviewStore } from './reviewStore';

// A value worked out on the api (the portfolio, the bell), fetched now, again shortly after any change on the
// event stream, and every 30 seconds in case the stream is blocked by a proxy. After a change every open tab in the
// firm refetches, so each waits a random 0.4 to 2.4 seconds: the requests reach the api spread out, not at once
// (Phase 7 load test).
export function useLive(fetcher, initial) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  useEffect(() => {
    let gone = false, soon = null;
    const load = () => fetcher().then(v => { if (!gone) { setValue(v); setError(''); } }, e => { if (!gone) setError(e.message); });
    load();
    const off = reviewStore.onChange(() => { clearTimeout(soon); soon = setTimeout(load, 400 + Math.random() * 2000); });
    const timer = setInterval(load, 30000);
    return () => { gone = true; off(); clearInterval(timer); clearTimeout(soon); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, error];
}

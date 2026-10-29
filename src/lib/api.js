// The browser's calls to the api's processing routes. The analysis and its four Claude steps run on the api
// (Phase 6); what remains here is reading scanned pages with OCR when a document is attached.

export const NO_SERVER = 'Real documents need the analysis server, which isn’t available on this page. Use the sample documents here, or run the app on your server with an API key (npm run dev).';

// Which fund the next Claude calls are for (for the server's activity log), and whether the fund's
// client permits AI (the server refuses when not).
let aiCtx = { engagementId: null, fundName: null, aiAllowed: true, currency: 'GBP', umbrella: null };
export const setAiContext = ctx => { aiCtx = { ...aiCtx, ...ctx }; };

async function post(path, body) {
  body = { ...body, _ctx: { engagementId: aiCtx.engagementId, fundName: aiCtx.fundName }, aiAllowed: aiCtx.aiAllowed, currency: aiCtx.currency, umbrella: aiCtx.umbrella };
  let r;
  try { r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new Error(NO_SERVER); }
  const out = await r.json().catch(() => null);
  // A page with no analysis server answers "not found" or with a page instead of JSON.
  if (!out || [404, 405, 501].includes(r.status)) throw new Error(r.ok ? NO_SERVER : (out?.error?.message || out?.error || NO_SERVER));
  if (!r.ok) throw new Error(out.error?.message || out.error || `The server could not complete the request (${r.status}).`);
  return out;
}

export const apiPost = (path, body) => post(path, body); // OCR of scanned pages at upload

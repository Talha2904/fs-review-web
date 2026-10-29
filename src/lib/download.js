// Saves a file the app generated. On a published claude.ai page, plain downloads are blocked and
// files go through the page's downloads capability (the viewer confirms the save). Everywhere
// else (npm run dev, your own server) it is an ordinary browser download.
export async function saveFile(filename, blob) {
  let downloads = null;
  try { downloads = window.claude?.use ? await window.claude.use('downloads') : null; } catch { downloads = null; }
  if (downloads) {
    try { await downloads.save({ filename, data: blob }); return 'saved'; }
    catch (e) {
      if (e?.code === 'declined') return 'declined';
      if (e?.code === 'rate_limited') throw new Error('A save is already waiting for your answer. Finish that one, then try again.');
      throw new Error(e?.message || 'The file could not be saved here.');
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

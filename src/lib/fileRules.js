// Which file type each document slot accepts. Shared by the app (checks before attaching) and the
// server (checks again before sending anything to Claude), so the two can never disagree.
export const MAX_MB = 25;
export const SLOT_RULES = {
  cy: { type: 'pdf', label: 'PDF' },
  py: { type: 'pdf', label: 'PDF' },
  tb: { type: 'xlsx', label: 'Excel (.xlsx)' },
  is: { type: 'xlsx', label: 'Excel (.xlsx)' },
  sup: { type: 'pdf', label: 'PDF' }
};
export const ACCEPT = {
  pdf: '.pdf,application/pdf',
  xlsx: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
const EXT_NAMES = { pdf: 'a PDF', xlsx: 'an Excel (.xlsx) file', xls: 'an older Excel (.xls) file', csv: 'a CSV file', docx: 'a Word document', doc: 'a Word document', png: 'an image', jpg: 'an image', jpeg: 'an image' };
export const extOf = name => (String(name || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
export const describeExt = ext => EXT_NAMES[ext] || (ext ? `a .${ext} file` : 'a file with no extension');

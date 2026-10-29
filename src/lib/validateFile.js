import * as XLSX from 'xlsx';
import { SLOT_RULES, MAX_MB, extOf, describeExt } from './fileRules';

// Checks a file for a document slot: extension, size, and that the content really is that type
// (a renamed file is caught by its first bytes). Returns '' when it is fine, or a message saying why not.
export async function validateFile(slotId, file, slotName) {
  const rule = SLOT_RULES[slotId];
  if (!rule) return '';
  const ext = extOf(file.name), want = rule.type;
  if (ext !== want) {
    const hint = want === 'xlsx' && (ext === 'xls' || ext === 'csv') ? ' Open it in Excel and save it as .xlsx.' : '';
    return `${slotName} must be ${rule.label}. “${file.name}” is ${describeExt(ext)}.${hint}`;
  }
  if (!file.size) return `“${file.name}” is empty.`;
  if (file.size > MAX_MB * 1024 * 1024) return `“${file.name}” is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MB} MB.`;

  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d; // %PDF-
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;                     // PK..
  if (want === 'pdf') {
    if (!isPdf) return `“${file.name}” is named .pdf but is not a PDF. It may have been renamed; export it as a PDF and try again.`;
    const tail = await file.slice(Math.max(0, file.size - 2048)).text();
    if (!tail.includes('%%EOF')) return `“${file.name}” looks incomplete or damaged. Download or export it again.`;
    const sample = await file.slice(0, Math.min(file.size, 2_000_000)).text();
    if (/\/Encrypt\s/.test(sample)) return `“${file.name}” is password-protected. Remove the password and attach it again.`;
    return '';
  }
  if (!isZip) return `“${file.name}” is named .xlsx but is not an Excel workbook. It may have been renamed; save it from Excel as .xlsx.`;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { bookSheets: true });
    if (!wb.SheetNames?.length) return `“${file.name}” has no worksheets.`;
  } catch {
    return `“${file.name}” could not be opened as an Excel workbook. It may be password-protected or damaged.`;
  }
  return '';
}

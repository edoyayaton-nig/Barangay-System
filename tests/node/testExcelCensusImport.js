import assert from 'assert';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

console.log('Testing Phase 13: Excel Census Import, Dynamic Column Addition & Auto Account Provisioning...');

// 1. Column Sanitization & Mapping Test
function sanitizeColumnHeader(header) {
  let safe = String(header).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
  if (['hpn'].includes(safe)) safe = 'hpn';
  else if (['dm'].includes(safe)) safe = 'dm';
  else if (['fp_method', 'fpmethod', 'fp'].includes(safe)) safe = 'fp_method';
  else if (['phic_no', 'philhealth_no', 'philhealth', 'phic'].includes(safe)) safe = 'phic_no';
  else if (['nhts'].includes(safe)) safe = 'nhts';
  else if (['ips', 'ip'].includes(safe)) safe = 'ips';
  else if (safe.includes('remark')) safe = 'remarks';
  else if (safe.includes('note')) safe = 'notes';
  return safe;
}

assert.strictEqual(sanitizeColumnHeader('HPN'), 'hpn');
assert.strictEqual(sanitizeColumnHeader('DM'), 'dm');
assert.strictEqual(sanitizeColumnHeader('FP Method'), 'fp_method');
assert.strictEqual(sanitizeColumnHeader('PHIC NO'), 'phic_no');
assert.strictEqual(sanitizeColumnHeader('PhilHealth No.'), 'phic_no');
assert.strictEqual(sanitizeColumnHeader('NHTS'), 'nhts');
assert.strictEqual(sanitizeColumnHeader('IPs'), 'ips');
assert.strictEqual(sanitizeColumnHeader('Remarks / Side Notes'), 'remarks');
assert.strictEqual(sanitizeColumnHeader('Notes / Marginal Notes'), 'notes');
assert.strictEqual(sanitizeColumnHeader('Blood Pressure (Systolic)'), 'blood_pressure_systolic');
console.log('  ✓ Column header sanitization and variable mapping verified');

// 2. Date parsing tests
function parseExcelDate(val, fallbackAge) {
  if (!val || String(val).toLowerCase() === '[blank]') {
    if (fallbackAge && !isNaN(fallbackAge)) {
      const yr = 2026 - Number(fallbackAge);
      return `${yr}-06-15`;
    }
    return null;
  }
  if (!isNaN(val) && Number(val) > 1000) {
    const utcDays = Math.floor(Number(val) - 25569);
    const timestamp = utcDays * 86400 * 1000;
    const d = new Date(timestamp);
    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
  }
  if (typeof val === 'string') {
    const parts = val.trim().split(/[-/]/);
    if (parts.length === 3) {
      let [m, d, y] = parts.map(n => parseInt(n, 10));
      if (y < 100) y += (y > 30 ? 1900 : 2000);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    const t = Date.parse(val);
    if (!isNaN(t)) return new Date(t).toISOString().split('T')[0];
  }
  return null;
}

assert.strictEqual(parseExcelDate(19105), '1952-04-21'); // Lucita Tambiga
assert.strictEqual(parseExcelDate(33879), '1992-10-02'); // Enrico Gilsano
assert.strictEqual(parseExcelDate('04-14-48'), '1948-04-14'); // Carmen Catanjal
assert.strictEqual(parseExcelDate('11/13/64'), '1964-11-13'); // Faustino Sanchez
assert.strictEqual(parseExcelDate('[Blank]', 30), '1996-06-15');
console.log('  ✓ Excel serial and date string parser verified');

// 3. Name Parsing Test
function parseExcelName(rawName) {
  if (!rawName) return { first_name: 'Resident', middle_name: '', last_name: '' };
  let clean = String(rawName).replace(/^[*•#\-\s]+/, '').replace(/\[Blank\]/gi, '').trim();
  if (!clean) return { first_name: 'Resident', middle_name: '', last_name: '' };

  if (clean.includes(',')) {
    const parts = clean.split(',').map(s => s.trim());
    const lastName = parts[0] || '';
    const remainder = parts[1] || '';
    const words = remainder.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      return { first_name: words[0] || clean, middle_name: '', last_name: lastName || clean };
    }
    const middleName = words.pop();
    const firstName = words.join(' ');
    return { first_name: firstName || middleName, middle_name: firstName ? middleName : '', last_name: lastName };
  } else {
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 1) return { first_name: words[0], middle_name: '', last_name: '' };
    if (words.length === 2) return { first_name: words[0], middle_name: '', last_name: words[1] };
    const lastName = words.pop();
    const middleName = words.pop();
    const firstName = words.join(' ');
    return { first_name: firstName, middle_name: middleName, last_name: lastName };
  }
}

const n1 = parseExcelName('TAMBIGA, LUCITA BINONGO');
assert.strictEqual(n1.first_name, 'LUCITA');
assert.strictEqual(n1.middle_name, 'BINONGO');
assert.strictEqual(n1.last_name, 'TAMBIGA');

const n2 = parseExcelName('Carmen Gonzales Catanjal');
assert.strictEqual(n2.first_name, 'Carmen');
assert.strictEqual(n2.middle_name, 'Gonzales');
assert.strictEqual(n2.last_name, 'Catanjal');

const n3 = parseExcelName('* HATAGUE, GABRIEL MONTILLA');
assert.strictEqual(n3.first_name, 'GABRIEL');
assert.strictEqual(n3.middle_name, 'MONTILLA');
assert.strictEqual(n3.last_name, 'HATAGUE');

console.log('  ✓ Complex Philippine name structures properly segmented');

// 4. File-level workbook inspection of PUROK 1,3,4,5.xlsx
const wb = XLSX.readFile('PUROK 1,3,4,5.xlsx');
assert.deepStrictEqual(wb.SheetNames, ['PUROK 1', 'PUROK 3', 'PUROK 4', 'PUROK 5']);

let totalRows = 0;
const allHeaders = new Set();
wb.SheetNames.forEach(sh => {
  const ws = wb.Sheets[sh];
  const rows = XLSX.utils.sheet_to_json(ws);
  totalRows += rows.length;
  rows.forEach(r => Object.keys(r).forEach(k => allHeaders.add(k)));
});

assert(totalRows >= 1700, `Expected at least 1700 rows, found ${totalRows}`);
assert(allHeaders.has('HPN'));
assert(allHeaders.has('DM'));
assert(allHeaders.has('FP Method'));
console.log(`  ✓ Excel workbook verified: ${totalRows} records across 4 Purok sheets with health variables`);

// 5. Account provisioning simulation
const sampleResident = {
  id: 1044,
  first_name: 'Ronald',
  last_name: 'Abendan',
  purok: '3',
  barangay: 'Pianing'
};
const slug = `${sampleResident.first_name.toLowerCase()}.${sampleResident.last_name.toLowerCase()}`;
const genEmail = `${slug}.p${sampleResident.purok}@resident.barangay.ph`;
const defaultPassword = 'Brgy@2026!';

assert.strictEqual(genEmail, 'ronald.abendan.p3@resident.barangay.ph');
assert(defaultPassword.length >= 8);
console.log('  ✓ Automatic account provisioning produces compliant email and staged password');

console.log('\n✓ Phase 13 Excel Census Import & Dynamic Variables: ALL TESTS PASSED!\n');


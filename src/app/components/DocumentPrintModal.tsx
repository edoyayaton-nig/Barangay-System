import { useRef, useState, useEffect } from 'react';
import { Printer, Shield, X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { DocumentRequest, apiService } from '../../services/api';
import { PIANING_LOGO_BASE64, BUTUAN_LOGO_BASE64 } from './officialLogos';
import { toast } from 'sonner';

interface DocumentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentRequest | null;
  onStatusUpdated?: () => void;
}

function parseFields(doc: DocumentRequest): Record<string, string> {
  try {
    if (doc.extra_fields) {
      if (typeof doc.extra_fields === 'string') return JSON.parse(doc.extra_fields);
      if (typeof doc.extra_fields === 'object') return doc.extra_fields as Record<string, string>;
    }
  } catch { /* noop */ }
  return {};
}

function fDate(d?: string | null) {
  if (!d) return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  try { return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

function getOrdinalDay(date?: Date): string {
  const d = date ?? new Date();
  const day = d.getDate();
  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return day + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getMonthYear(date?: Date): { month: string; year: string } {
  const d = date ?? new Date();
  return {
    month: d.toLocaleDateString('en-US', { month: 'long' }),
    year: d.getFullYear().toString(),
  };
}

function cleanPurok(doc: DocumentRequest, f: Record<string, string>): string {
  const raw = (doc as any).resident_address || f['Purok / Location'] || f['Home Address'] || (doc as any).address || '';
  if (!raw) return '___';
  
  // If it contains "Purok X"
  const match = raw.match(/purok\s*([0-9A-Za-z_-]+)/i);
  if (match) {
    return match[1].trim(); // e.g. "1", "2"
  }
  
  // Otherwise take the first part before comma
  const firstPart = raw.split(',')[0].replace(/Barangay.*/i, '').replace(/^purok\s*/i, '').trim();
  return firstPart || '___';
}

function cleanPurpose(purposeStr?: string): string {
  if (!purposeStr) return 'loan application';
  // Strip any old concatenated extra fields formatted like "purpose — Applicant Name: ..." or " | Home Address: ..."
  let p = purposeStr.split(' — ')[0].split(' | ')[0].trim();
  p = p.replace(/^Purpose:\s*/i, '').trim();
  return p || 'loan application';
}

function cleanAge(doc: DocumentRequest, f: Record<string, string>): string {
  const raw = f['Age'] || (doc as any).resident_age || (doc as any).age || '';
  if (raw && !isNaN(Number(raw))) return `${raw} years old`;
  if (raw && typeof raw === 'string' && raw.includes('year')) return raw;
  if (raw) return `${raw}`;

  const dobStr = (doc as any).resident_birth_date || (doc as any).date_of_birth || f['Date of Birth'] || f['Birthday'] || '';
  if (dobStr) {
    try {
      const dob = new Date(dobStr);
      if (!isNaN(dob.getTime())) {
        const diff = Date.now() - dob.getTime();
        const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        if (!isNaN(age) && age >= 0) return `${age} years old`;
      }
    } catch {}
  }
  return 'legal age';
}

function cleanCivilStatus(doc: DocumentRequest, f: Record<string, string>): string {
  const raw = f['Civil Status'] || (doc as any).resident_civil_status || (doc as any).civil_status || '';
  if (!raw) return 'single/married/widow/er';
  const s = raw.toLowerCase().trim();
  if (s === 'single') return 'single';
  if (s === 'married') return 'married';
  if (s === 'widow' || s === 'widower' || s === 'widowed') return 'widow/er';
  return raw;
}

function cleanResidencyYears(f: Record<string, string>): string {
  const raw = f['Duration of Residence'] || f['Years of Residency'] || f['Residing Since'] || f['Duration'] || f['Residency Years'] || '';
  if (!raw) return 'for more than five (5) years';
  const clean = raw.trim();
  if (/^\d+$/.test(clean)) {
    const num = Number(clean);
    return `for ${num} year${num > 1 ? 's' : ''}`;
  }
  if (/^\d{4}$/.test(clean)) {
    return `since ${clean}`;
  }
  if (clean.toLowerCase().startsWith('for ') || clean.toLowerCase().startsWith('since ')) {
    return clean;
  }
  return `for ${clean}`;
}

function cleanGender(doc: DocumentRequest, f: Record<string, string>): 'Male' | 'Female' {
  const raw = f['Gender'] || (doc as any).resident_gender || (doc as any).gender || '';
  const g = String(raw).toLowerCase().trim();
  if (g === 'female' || g === 'f') return 'Female';
  return 'Male';
}

function cleanPronouns(doc: DocumentRequest, f: Record<string, string>) {
  const g = cleanGender(doc, f);
  const isFemale = g === 'Female';
  return {
    isFemale,
    genderLabel: isFemale ? 'female' : 'male',
    GenderLabel: isFemale ? 'Female' : 'Male',
    heShe: isFemale ? 'she' : 'he',
    HeShe: isFemale ? 'She' : 'He',
    hisHer: isFemale ? 'her' : 'his',
    HisHer: isFemale ? 'Her' : 'His',
    himHer: isFemale ? 'her' : 'him',
    HimHer: isFemale ? 'Her' : 'Him',
  };
}

function cleanBusinessName(f: Record<string, string>, purpose?: string): string {
  if (f['Business Name']) return f['Business Name'];
  if (f['Store Name']) return f['Store Name'];
  if (f['Business Type']) return f['Business Type'];
  if (f['Nature of Business']) return f['Nature of Business'];
  if (purpose && purpose.trim() && !purpose.toLowerCase().includes('clearance') && !purpose.toLowerCase().includes('personal')) {
    return purpose.trim();
  }
  return 'General Merchandise / Sari-Sari Store';
}

function cleanEmploymentDetails(f: Record<string, string>) {
  const position = f['Job Position'] || f['Position'] || f['Role'] || f['Designation'] || 'Barangay Worker';
  const employer = f['Employer'] || f['Company'] || f['Office'] || f['Establishment'] || 'Barangay Pianing';
  const period = f['Employment Period'] || f['Period'] || (f['Start Date'] && f['End Date'] ? `${f['Start Date']} to ${f['End Date']}` : 'January 2024 to Present');
  let startDate = f['Start Date'] || '';
  let endDate = f['End Date'] || '';
  if (!startDate && period.includes(' to ')) {
    const parts = period.split(' to ');
    startDate = parts[0].trim();
    endDate = parts[1].trim();
  } else if (!startDate) {
    startDate = period;
    endDate = 'Present';
  }
  return { position, employer, period, startDate, endDate };
}

function cleanLandDetails(f: Record<string, string>) {
  let rawArea = f['Land Area'] || f['Area'] || 'Nine Hundred Thirty-One (931)';
  // Strip trailing "square meters more or less" if present in input so it doesn't double
  rawArea = rawArea.replace(/\s*(?:square\s*meters?\s*(?:more\s*or\s*less)?|sqm|sq\.?\s*m\.?).*$/i, '').trim();
  if (!rawArea) rawArea = 'Nine Hundred Thirty-One (931)';

  const lotNumber = f['Lot Number'] || f['Lot #'] || f['Lot No.'] || '1005';
  const surveyInfo = f['Survey Info'] || f['Cadastral'] || f['Survey / PLS'] || 'PLS-74';
  
  let rawSince = f['Occupancy Since'] || f['Occupancy Period'] || f['Since Year'] || "1970's";
  rawSince = rawSince.replace(/^(?:since\s*(?:the\s*year\s*)?|the\s*year\s*)/i, '').trim();
  const yearStarted = rawSince || "1970's";

  return { landArea: rawArea, lotNumber, surveyInfo, yearStarted };
}

function getHonorificAndLastName(fullName: string, gender: string, civilStatus: string) {
  const isFemale = gender?.toLowerCase() === 'female';
  const isMarried = civilStatus?.toLowerCase() === 'married';
  const title = isFemale ? (isMarried ? 'Mrs.' : 'Ms.') : 'Mr.';
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : fullName;
  return { title, lastName };
}

// ── Exact Print CSS: Letter size (8.5in x 11in), Larger Logos, No Header Border, No Title Underline ──
const PRINT_CSS = `
  @page {
    size: letter portrait;
    margin: 0mm !important;
  }
  @page :left {
    margin: 0mm !important;
  }
  @page :right {
    margin: 0mm !important;
  }
  @page :first {
    margin: 0mm !important;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    width: 100%;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-wrapper {
    width: 100%;
    max-width: 8.5in;
    min-height: 11in;
    padding: 0.5in 0.8in 0.5in 0.8in;
    margin: 0 auto;
    font-family: Arial, Helvetica, sans-serif;
    page-break-inside: avoid;
    break-inside: avoid;
    box-sizing: border-box;
  }

  /* ── HEADER (ZOOMED-IN LARGE LOGOS) ── */
  .hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 2px;
    margin-bottom: 10px;
  }
  .hdr-logo-box {
    width: 1.45in;
    height: 1.45in;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .hdr-logo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.18);
    display: block;
  }
  .hdr-center {
    text-align: center;
    flex: 1;
    padding: 0 10px;
  }
  .hdr-center .rep {
    font-size: 11pt;
    margin-bottom: 2px;
    font-family: Arial, Helvetica, sans-serif;
  }
  .hdr-center .bold {
    font-size: 13pt;
    font-weight: bold;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    font-family: Arial, Helvetica, sans-serif;
  }
  .hdr-center .loc {
    font-size: 10.5pt;
    font-family: Arial, Helvetica, sans-serif;
  }

  /* ── TITLE (22pt BOLD, NO UNDERLINE) ── */
  .doc-title {
    text-align: center;
    font-size: 22pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 18px 0 18px 0;
    letter-spacing: 0.5px;
    font-family: Arial, Helvetica, sans-serif;
  }

  /* ── BODY (ARIAL 12pt) ── */
  .salute {
    font-size: 12pt;
    margin-bottom: 12px;
    font-weight: normal;
    font-family: Arial, Helvetica, sans-serif;
  }
  .para {
    text-align: justify;
    text-justify: inter-word;
    font-size: 12pt;
    line-height: 1.6;
    margin-bottom: 14px;
    font-family: Arial, Helvetica, sans-serif;
  }

  /* ── AFFIANT ── */
  .affiant-wrap {
    text-align: right;
    margin: 20px 0 14px 0;
    page-break-inside: avoid;
  }
  .affiant-line {
    display: inline-block;
    border-bottom: 1px solid #000;
    width: 240px;
    margin-bottom: 3px;
  }
  .affiant-label {
    font-size: 10.5pt;
    text-align: center;
    width: 240px;
    display: inline-block;
    font-family: Arial, Helvetica, sans-serif;
  }

  /* ── SIGNATURE ROW ── */
  .sig-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 55px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .sig-left {
    text-align: left;
  }
  .sig-right {
    text-align: left;
  }
  .sig-label {
    font-size: 11.5pt;
    margin-bottom: 55px;
    font-weight: normal;
    font-family: Arial, Helvetica, sans-serif;
  }
  .sig-name {
    font-size: 12pt;
    font-weight: bold;
    text-decoration: underline;
    text-transform: uppercase;
    margin-bottom: 2px;
    font-family: Arial, Helvetica, sans-serif;
  }
  .sig-title {
    font-size: 10.5pt;
    font-weight: normal;
    font-family: Arial, Helvetica, sans-serif;
  }
`;

// ── HTML generator for Letter size print window ──────────────────────────────
function getCertificateBody(doc: DocumentRequest): string {
  const f = parseFields(doc);
  const name = doc.resident_name ?? '';
  const purpose = cleanPurpose(doc.purpose);
  const purok = cleanPurok(doc, f);
  const civilStatus = cleanCivilStatus(doc, f);
  const now = new Date();
  const day = getOrdinalDay(now);
  const { month, year } = getMonthYear(now);

  const pronouns = cleanPronouns(doc, f);
  const emp = cleanEmploymentDetails(f);
  const bizName = cleanBusinessName(f, purpose);

  const logoHeaderPunong = `
    <div class="hdr">
      <div class="hdr-logo-box"><img src="${BUTUAN_LOGO_BASE64}" class="hdr-logo" alt="City of Butuan Seal" /></div>
      <div class="hdr-center">
        <p class="rep">Republic of the Philippines</p>
        <p class="bold">OFFICE OF THE PUNONG BARANGAY</p>
        <p class="loc">Pianing, Butuan City</p>
      </div>
      <div class="hdr-logo-box"><img src="${PIANING_LOGO_BASE64}" class="hdr-logo" alt="Barangay Pianing Seal" /></div>
    </div>`;

  const logoHeaderSangguniang = `
    <div class="hdr">
      <div class="hdr-logo-box"><img src="${BUTUAN_LOGO_BASE64}" class="hdr-logo" alt="City of Butuan Seal" /></div>
      <div class="hdr-center">
        <p class="rep">Republic of the Philippines</p>
        <p class="bold">OFFICE OF THE SANGGUNIANG BARANGAY</p>
        <p class="loc">Pianing, Butuan City</p>
      </div>
      <div class="hdr-logo-box"><img src="${PIANING_LOGO_BASE64}" class="hdr-logo" alt="Barangay Pianing Seal" /></div>
    </div>`;

  const logoHeader = logoHeaderPunong;

  // Signatures
  const attestedApproved = `
    <div class="sig-row">
      <div class="sig-left">
        <div class="sig-label">ATTESTED BY:</div>
        <div class="sig-name">TERESITA ROJO-ENTERO</div>
        <div class="sig-title">Barangay Secretary</div>
      </div>
      <div class="sig-right">
        <div class="sig-label">APPROVED BY:</div>
        <div class="sig-name">VIRGENIA S. GOLANDRINA</div>
        <div class="sig-title">Punong Barangay</div>
      </div>
    </div>`;

  const certifiedBy = `
    <div class="sig-row" style="justify-content: flex-end;">
      <div class="sig-right">
        <div class="sig-label">CERTIFIED BY:</div>
        <div class="sig-name">VIRGENIA S. GOLANDRINA</div>
        <div class="sig-title">Punong Barangay</div>
      </div>
    </div>`;

  const affiantLine = `
    <div class="affiant-wrap">
      <div class="affiant-line">&nbsp;</div><br/>
      <div class="affiant-label">Affiant's Signature</div>
    </div>`;

  switch (doc.document_type) {
    // ── BARANGAY CLEARANCE ───────────────────────────────────────────────────
    case 'Barangay Clearance':
      return `
        <div class="doc-wrapper">
          ${logoHeader}
          <div class="doc-title">BARANGAY CLEARANCE</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para">This is to certify that <strong>${name}</strong> of legal age,
            ${civilStatus} is a bona fide resident of Purok ${purok}, Pianing, Butuan City.</p>
          <p class="para"><strong>${pronouns.HeShe}</strong> is known to be a person of <strong>GOOD MORAL CHARACTER</strong>
            and is a law-abiding citizen. Our records show that ${pronouns.heShe} is not currently been charged
            of any crime against ${pronouns.hisHer} person, no pending case &nbsp; nor a member of any
            subversive organization in our community.</p>
          <p class="para">This clearance is being issued upon the request of ${name}
            for ${pronouns.hisHer} <strong>${purpose}</strong> and for whatever legal purposes it may serve
            best. This document is valid for six (6) months from the date of issuance.</p>
          <p class="para">This is being issued on the <strong>${day}</strong> day of
            <strong>${month}</strong>&nbsp;&nbsp;<strong>${year}</strong> at the Office of the
            Punong Barangay of Pianing, Butuan City, Agusan Del Norte, Philippines.</p>
          ${affiantLine}
          ${attestedApproved}
        </div>`;

    // ── CERTIFICATE OF GOOD MORAL ─────────────────────────────────────────────
    case 'Good Moral Clearance': {
      const { title: honorific } = getHonorificAndLastName(name, pronouns.genderLabel, civilStatus);
      // Salutation: "Mr." | "Ms." | "Mr./Ms." based on gender
      const salutation = pronouns.isFemale ? 'Ms.' : (pronouns.genderLabel === 'male' ? 'Mr.' : 'Mr./Ms.');
      // pronoun_slashed: he/she based on gender (no gender info → he/she)
      const pronounSlashed = pronouns.heShe;
      // possessive_slashed: his/her based on gender
      const possessiveSlashed = pronouns.hisHer;
      // full_name in ALL CAPS
      const fullNameCaps = name.toUpperCase();
      // full_address
      const rawAddr = (doc as any).resident_address || '';
      const fullAddress = rawAddr
        ? rawAddr
        : `${purok.startsWith('Purok') ? purok : `Purok ${purok}`}, Barangay Pianing, Butuan City`;
      return `
        <div class="doc-wrapper">
          ${logoHeaderPunong}
          <div class="doc-title" style="font-size: 20pt; letter-spacing: 0.5px; margin: 20px 0 16px 0;">Good Moral Clearance</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para" style="line-height: 1.65; margin-bottom: 14px;">This is to certify that <strong style="text-decoration: underline;">${salutation} ${fullNameCaps}</strong>, of legal age and a bonafide resident of ${fullAddress}.</p>
          <p class="para" style="line-height: 1.65; margin-bottom: 14px;">This further certifies that <strong>${salutation} ${fullNameCaps}</strong> as per records on file of this office, <strong>${pronounSlashed}</strong> has not been involved in any unlawful act or activities within the barangay and <strong>NOT in the BADAC list</strong>.</p>
          <p class="para" style="line-height: 1.65; margin-bottom: 22px;">This certification is being issued upon the request of the above-named person as a requirement for ${possessiveSlashed} <strong>${purpose}</strong>.</p>
          <p class="para" style="line-height: 1.65; margin-bottom: 22px;">Issued this <strong>${day}</strong> day of <strong>${month}</strong>, <strong>${year}</strong> at the Office of the Punong Barangay of Pianing, Butuan City, Philippines.</p>
          ${certifiedBy}
        </div>`;
    }

    // ── CERTIFICATE OF RESIDENCY ──────────────────────────────────────────────
    case 'Certificate of Residency':
      return `
        <div class="doc-wrapper">
          ${logoHeader}
          <div class="doc-title">CERTIFICATE OF RESIDENCY</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para">This is to certify that <strong>${name}</strong>, Filipino, is a bonafide <strong>resident</strong> of Purok ${purok}, Barangay Pianing, Butuan City together with ${pronouns.hisHer} entire family circle.</p>
          <p class="para">This certifies further that the above-mentioned resident has been permanently living and residing at Purok ${purok}, Barangay Pianing, Butuan City <strong>${cleanResidencyYears(f)}</strong>.</p>
          <p class="para">This certification is being issued upon the request of the concerned party for whatever legal purposes it may serve best.</p>
          <p class="para">This document is given this <strong>${day}</strong> day of <strong>${month}</strong>&nbsp;&nbsp;<strong>${year}</strong> at the Office of the Punong Barangay of Pianing, Butuan City, Philippines.</p>
          ${certifiedBy}
        </div>`;

    // ── CERTIFICATE OF INDIGENCY ──────────────────────────────────────────────
    case 'Certificate of Indigency':
      return `
        <div class="doc-wrapper">
          ${logoHeader}
          <div class="doc-title">CERTIFICATE OF INDIGENCY</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para">This is to certify that <strong>${name}</strong>, <strong>${cleanAge(doc, f)}</strong>, <strong>${pronouns.genderLabel}</strong> and a resident of P ${purok}, Barangay Pianing, Butuan City.</p>
          <p class="para">This certifies further that the above-mentioned-name and ${pronouns.hisHer} family is one of our identified <strong>INDIGENT</strong> constituents in the community and in need of <strong>${purpose}</strong> assistance.</p>
          <p class="para">This certification is being issued upon the request of the above mentioned-name for whatever legal purposes it may serve best.</p>
          <p class="para">Issued this <strong>${day}</strong> day of <strong>${month}</strong>&nbsp;&nbsp;<strong>${year}</strong> at Barangay Pianing, Butuan City, Philippines.</p>
          ${certifiedBy}
        </div>`;

    // ── BUSINESS CLEARANCE / BUSINESS CERTIFICATE / PERMIT ───────────────────
    case 'Barangay Business Clearance':
    case 'Business Clearance':
    case 'Business Permit':
    case 'Business Certificate':
      return `
        <div class="doc-wrapper">
          ${logoHeaderSangguniang}
          <div class="doc-title">BARANGAY BUSINESS CLEARANCE</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para">This is to certify that <strong>${name}</strong>, of legal age, bona-fide resident of ${purok.includes('Purok') ? purok : `Purok ${purok}`}, Barangay Pianing, Butuan City, Philippines, has a <strong>${bizName}</strong> store business located in its/own residence Based on the verification gathered.</p>
          <p class="para">This certification is issued upon the request of the above-named person for <strong>${purpose}</strong> and for whatever legal purpose it may serve.</p>
          <p class="para">Issued this <strong>${day}</strong> day of <strong>${month}</strong>&nbsp;&nbsp;<strong>${year}</strong> at Barangay <strong>Pianing</strong>, Butuan City, Philippines.</p>
          ${certifiedBy}
        </div>`;

    // ── CERTIFICATE OF EMPLOYMENT ─────────────────────────────────────────────
    case 'Certificate of Employment':
      return `
        <div class="doc-wrapper">
          ${logoHeaderPunong}
          <div class="doc-title">CERTIFICATION</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para">This is to certify that <strong>${name}</strong>, of legal age, ${civilStatus} is a <strong>bona fide resident</strong> of Purok ${purok}, Barangay Pianing, Butuan City together with ${pronouns.hisHer} entire family.</p>
          <p class="para">This certifies further that the above-mentioned person has worked as <strong>${emp.position}</strong> of <strong>${emp.employer}</strong> from <strong>${emp.startDate}</strong> to <strong>${emp.endDate}</strong>.</p>
          <p class="para">This certification is being issued upon the request of the party for whatever legal purposes it may serve best.</p>
          <p class="para">Issued this <strong>${day}</strong> day of <strong>${month}</strong>&nbsp;&nbsp;<strong>${year}</strong> at the Office of the Punong Barangay of Pianing, this City, Philippines.</p>
          ${certifiedBy}
        </div>`;

    // ── CERTIFICATE OF LAND OCCUPANCY / ACTUAL OCCUPANCY ──────────────────────
    case 'Certificate of Land Occupancy':
    case 'Land Occupancy':
    case 'Actual Occupancy':
    case 'Certificate of Actual Occupancy': {
      const land = cleanLandDetails(f);
      const formattedPurok = purok.startsWith('Purok') ? purok : `Purok ${purok}`;
      return `
        <div class="doc-wrapper">
          ${logoHeaderPunong}
          <div class="doc-title" style="font-size: 20pt; letter-spacing: 1px; margin: 22px 0 18px 0;">CERTIFICATE OF LAND OCCUPANCY</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para" style="line-height: 1.65; margin-bottom: 18px;">This is to certify that <strong style="text-decoration: underline;">${name.toUpperCase()}</strong>, Filipino, ${civilStatus.toLowerCase()}, a bona fide resident of ${formattedPurok} Pianing, Butuan City is the <strong style="text-decoration: underline;">ACTUAL OCCUPANT</strong> on a parcel of land with an area of <strong style="text-decoration: underline;">${land.landArea}</strong> square meters more or less, identified as Lot # ${land.lotNumber}, ${land.surveyInfo} <span style="text-decoration: underline;">since</span> the year ${land.yearStarted} until this document has been made.</p>
          <p class="para" style="line-height: 1.65; margin-bottom: 22px;">This certification is being issued upon the requesting party for whatever legal purposes it may serve best.</p>
          <p class="para" style="line-height: 1.65; margin-bottom: 24px;">Given this <strong>${day}</strong> day of <strong>${month}</strong>&nbsp;&nbsp;<strong>${year}</strong> at the Office of the Punong Barangay of Pianing, Butuan City, Philippines.</p>
          ${certifiedBy}
        </div>`;
    }

    // ── DEFAULT ───────────────────────────────────────────────────────────────
    default:
      return `
        <div class="doc-wrapper">
          ${logoHeader}
          <div class="doc-title">${doc.document_type?.toUpperCase()}</div>
          <p class="salute">TO WHOM IT MAY CONCERN:</p>
          <p class="para">This is to certify that <strong>${name}</strong>, of legal age,
            ${civilStatus}, Filipino citizen, and a bonafide resident of Purok ${purok},
            Pianing, Butuan City, Agusan Del Norte. This certification is issued for the purpose
            of <strong>${purpose}</strong> and for whatever legal purposes it may serve.</p>
          <p class="para">This document is issued on the <strong>${day}</strong> day of
            <strong>${month}</strong>, <strong>${year}</strong> at the Office of the Punong Barangay
            of Pianing, Butuan City, Agusan Del Norte, Philippines.</p>
          ${attestedApproved}
        </div>`;
  }
}

// ── React On-screen Preview ───────────────────────────────────────────────────
function CertificatePreview({ doc }: { doc: DocumentRequest }) {
  const f = parseFields(doc);
  const name = doc.resident_name ?? '';
  const purpose = cleanPurpose(doc.purpose);
  const purok = cleanPurok(doc, f);
  const civilStatus = cleanCivilStatus(doc, f);
  const now = new Date();
  const day = getOrdinalDay(now);
  const { month, year } = getMonthYear(now);

  const pronouns = cleanPronouns(doc, f);
  const emp = cleanEmploymentDetails(f);
  const bizName = cleanBusinessName(f, purpose);

  const OfficialHeader = ({ office = 'OFFICE OF THE PUNONG BARANGAY' }: { office?: string }) => (
    <div className="flex items-center justify-between pb-2 mb-3">
      <div style={{ width: '1.45in', height: '1.45in' }} className="flex-shrink-0 flex items-center justify-center overflow-hidden">
        <img src={BUTUAN_LOGO_BASE64} alt="City of Butuan Seal" className="w-full h-full object-cover scale-115" />
      </div>
      <div className="text-center flex-1 px-3 font-sans">
        <p className="text-[11pt] text-black">Republic of the Philippines</p>
        <p className="text-[13pt] font-bold text-black uppercase tracking-wide">{office}</p>
        <p className="text-[11pt] text-black">Pianing, Butuan City</p>
      </div>
      <div style={{ width: '1.45in', height: '1.45in' }} className="flex-shrink-0 flex items-center justify-center overflow-hidden">
        <img src={PIANING_LOGO_BASE64} alt="Barangay Pianing Seal" className="w-full h-full object-cover scale-115" />
      </div>
    </div>
  );

  const AttestedApprovedSig = () => (
    <div className="mt-12 flex justify-between font-sans">
      <div>
        <p className="font-normal mb-12 text-[11.5pt]">ATTESTED BY:</p>
        <p className="font-bold uppercase underline text-[12pt]">TERESITA ROJO-ENTERO</p>
        <p className="text-[10.5pt]">Barangay Secretary</p>
      </div>
      <div>
        <p className="font-normal mb-12 text-[11.5pt]">APPROVED BY:</p>
        <p className="font-bold uppercase underline text-[12pt]">VIRGENIA S. GOLANDRINA</p>
        <p className="text-[10.5pt]">Punong Barangay</p>
      </div>
    </div>
  );

  const CertifiedBySig = () => (
    <div className="mt-14 flex justify-end font-sans">
      <div>
        <p className="font-normal mb-12 text-[11.5pt]">CERTIFIED BY:</p>
        <p className="font-bold uppercase underline text-[12pt]">VIRGENIA S. GOLANDRINA</p>
        <p className="text-[10.5pt]">Punong Barangay</p>
      </div>
    </div>
  );

  const AffiantLine = () => (
    <div className="flex justify-end mt-5 mb-2 font-sans">
      <div className="text-center">
        <div className="border-b border-black w-56 mb-1">&nbsp;</div>
        <p className="text-[10.5pt]">Affiant's Signature</p>
      </div>
    </div>
  );

  const p = "text-[12pt] text-justify leading-relaxed mb-3.5 font-sans";
  const title = "text-center text-[22pt] font-bold uppercase tracking-wide my-4 font-sans";

  const renderBody = () => {
    switch (doc.document_type) {
      case 'Barangay Clearance':
        return (<>
          <OfficialHeader />
          <h2 className={title}>BARANGAY CLEARANCE</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong>{name}</strong> of legal age,
            {' '}{civilStatus} is a bona fide resident of Purok {purok}, Pianing, Butuan City.</p>
          <p className={p}><strong>{pronouns.HeShe}</strong> is known to be a person of <strong>GOOD MORAL CHARACTER</strong> and
            is a law-abiding citizen. Our records show that {pronouns.heShe} is not currently been charged of any
            crime against {pronouns.hisHer} person, no pending case &nbsp; nor a member of any subversive
            organization in our community.</p>
          <p className={p}>This clearance is being issued upon the request of {name} for {pronouns.hisHer}{' '}
            <strong>{purpose}</strong> and for whatever legal purposes it may serve best. This
            document is valid for six (6) months from the date of issuance.</p>
          <p className={p}>This is being issued on the <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>&nbsp;&nbsp;<strong>{year}</strong> at the Office of the Punong
            Barangay of Pianing, Butuan City, Agusan Del Norte, Philippines.</p>
          <AffiantLine />
          <AttestedApprovedSig />
        </>);

      case 'Good Moral Clearance': {
        const { title: honorific } = getHonorificAndLastName(name, pronouns.genderLabel, civilStatus);
        const salutation = pronouns.isFemale ? 'Ms.' : (pronouns.genderLabel === 'male' ? 'Mr.' : 'Mr./Ms.');
        const pronounSlashed = pronouns.heShe;
        const possessiveSlashed = pronouns.hisHer;
        const fullNameCaps = name.toUpperCase();
        const rawAddr = (doc as any).resident_address || '';
        const fullAddress = rawAddr
          ? rawAddr
          : `${purok.startsWith('Purok') ? purok : `Purok ${purok}`}, Barangay Pianing, Butuan City`;
        return (<>
          <OfficialHeader office="OFFICE OF THE PUNONG BARANGAY" />
          <h2 className={title}>Good Moral Clearance</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong className="underline">{salutation} {fullNameCaps}</strong>, of legal age and a bonafide resident of {fullAddress}.</p>
          <p className={p}>This further certifies that <strong>{salutation} {fullNameCaps}</strong> as per records on file of this office, <strong>{pronounSlashed}</strong> has not been involved in any unlawful act or activities within the barangay and <strong>NOT in the BADAC list</strong>.</p>
          <p className={p}>This certification is being issued upon the request of the above-named person as a requirement for {possessiveSlashed} <strong>{purpose}</strong>.</p>
          <p className={p}>Issued this <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>, <strong>{year}</strong> at the Office of the Punong Barangay of Pianing, Butuan City, Philippines.</p>
          <CertifiedBySig />
        </>);
      }

      case 'Certificate of Residency':
        return (<>
          <OfficialHeader />
          <h2 className={title}>CERTIFICATE OF RESIDENCY</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong>{name}</strong>, Filipino, is a bonafide <strong>resident</strong> of Purok {purok}, Barangay Pianing, Butuan City together with {pronouns.hisHer} entire family circle.</p>
          <p className={p}>This certifies further that the above-mentioned resident has been permanently living and residing at Purok {purok}, Barangay Pianing, Butuan City <strong>{cleanResidencyYears(f)}</strong>.</p>
          <p className={p}>This certification is being issued upon the request of the concerned party for whatever legal purposes it may serve best.</p>
          <p className={p}>This document is given this <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>&nbsp;&nbsp;<strong>{year}</strong> at the Office of the Punong Barangay of Pianing, Butuan City, Philippines.</p>
          <CertifiedBySig />
        </>);

      case 'Certificate of Indigency':
        return (<>
          <OfficialHeader />
          <h2 className={title}>CERTIFICATE OF INDIGENCY</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong>{name}</strong>, <strong>{cleanAge(doc, f)}</strong>, <strong>{pronouns.genderLabel}</strong> and a resident of P {purok}, Barangay Pianing, Butuan City.</p>
          <p className={p}>This certifies further that the above-mentioned-name and {pronouns.hisHer} family is one of our identified <strong>INDIGENT</strong> constituents in the community and in need of <strong>{purpose}</strong> assistance.</p>
          <p className={p}>This certification is being issued upon the request of the above mentioned-name for whatever legal purposes it may serve best.</p>
          <p className={p}>Issued this <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>&nbsp;&nbsp;<strong>{year}</strong> at Barangay Pianing, Butuan City, Philippines.</p>
          <CertifiedBySig />
        </>);

      case 'Barangay Business Clearance':
      case 'Business Clearance':
      case 'Business Permit':
      case 'Business Certificate':
        return (<>
          <OfficialHeader office="OFFICE OF THE SANGGUNIANG BARANGAY" />
          <h2 className={title}>BARANGAY BUSINESS CLEARANCE</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong>{name}</strong>, of legal age, bona-fide resident of {purok.includes('Purok') ? purok : `Purok ${purok}`}, Barangay Pianing, Butuan City, Philippines, has a <strong>{bizName}</strong> store business located in its/own residence Based on the verification gathered.</p>
          <p className={p}>This certification is issued upon the request of the above-named person for <strong>{purpose}</strong> and for whatever legal purpose it may serve.</p>
          <p className={p}>Issued this <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>&nbsp;&nbsp;<strong>{year}</strong> at Barangay <strong>Pianing</strong>, Butuan City, Philippines.</p>
          <CertifiedBySig />
        </>);

      case 'Certificate of Employment':
        return (<>
          <OfficialHeader office="OFFICE OF THE PUNONG BARANGAY" />
          <h2 className={title}>CERTIFICATION</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong>{name}</strong>, of legal age, {civilStatus} is a <strong>bona fide resident</strong> of Purok {purok}, Barangay Pianing, Butuan City together with {pronouns.hisHer} entire family.</p>
          <p className={p}>This certifies further that the above-mentioned person has worked as <strong>{emp.position}</strong> of <strong>{emp.employer}</strong> from <strong>{emp.startDate}</strong> to <strong>{emp.endDate}</strong>.</p>
          <p className={p}>This certification is being issued upon the request of the party for whatever legal purposes it may serve best.</p>
          <p className={p}>Issued this <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>&nbsp;&nbsp;<strong>{year}</strong> at the Office of the Punong Barangay of Pianing, this City, Philippines.</p>
          <CertifiedBySig />
        </>);

      case 'Certificate of Land Occupancy':
      case 'Land Occupancy':
      case 'Actual Occupancy':
      case 'Certificate of Actual Occupancy': {
        const land = cleanLandDetails(f);
        const formattedPurok = purok.startsWith('Purok') ? purok : `Purok ${purok}`;
        return (<>
          <OfficialHeader office="OFFICE OF THE PUNONG BARANGAY" />
          <h2 className={title}>CERTIFICATE OF LAND OCCUPANCY</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong className="underline uppercase">{name}</strong>, Filipino, {civilStatus.toLowerCase()}, a bona fide resident of {formattedPurok} Pianing, Butuan City is the <strong className="underline">ACTUAL OCCUPANT</strong> on a parcel of land with an area of <strong className="underline">{land.landArea}</strong> square meters more or less, identified as Lot # {land.lotNumber}, {land.surveyInfo} <span className="underline">since</span> the year {land.yearStarted} until this document has been made.</p>
          <p className={p}>This certification is being issued upon the requesting party for whatever legal purposes it may serve best.</p>
          <p className={p}>Given this <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>&nbsp;&nbsp;<strong>{year}</strong> at the Office of the Punong Barangay of Pianing, Butuan City, Philippines.</p>
          <CertifiedBySig />
        </>);
      }

      default:
        return (<>
          <OfficialHeader />
          <h2 className={title}>{doc.document_type?.toUpperCase()}</h2>
          <p className="text-[12pt] font-normal mb-3 font-sans">TO WHOM IT MAY CONCERN:</p>
          <p className={p}>This is to certify that <strong>{name}</strong>, of legal age,
            {' '}{civilStatus}, Filipino citizen, and a bonafide resident of Purok {purok},
            Pianing, Butuan City, Agusan Del Norte. This certification is issued for the purpose
            of <strong>{purpose}</strong> and for whatever legal purposes it may serve.</p>
          <p className={p}>This document is issued on the <strong>{day}</strong> day of{' '}
            <strong>{month}</strong>, <strong>{year}</strong> at the Office of the Punong Barangay
            of Pianing, Butuan City, Agusan Del Norte, Philippines.</p>
          <AttestedApprovedSig />
        </>);
    }
  };

  return (
    <div className="font-sans">
      <div>{renderBody()}</div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function DocumentPrintModal({ isOpen, onClose, document: docItem, onStatusUpdated }: DocumentPrintModalProps) {
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!docItem) return;
    setDownloading(true);
    try {
      const fileName = `${(docItem.document_type || 'document').replace(/\s+/g, '_')}_${docItem.request_code || docItem.id}.pdf`;
      await apiService.downloadDocumentPdf(docItem.id, fileName);
      toast.success('Official PDF downloaded successfully');
      if (onStatusUpdated) onStatusUpdated();
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    try {
      const oldIframe = window.document.getElementById('print-doc-iframe');
      if (oldIframe) oldIframe.remove();
      document.body.style.pointerEvents = 'auto';
      window.focus();
    } catch {}
    if (onStatusUpdated) onStatusUpdated();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !docItem) return null;

  const handlePrint = () => {
    if (!docItem) return;
    const originalTitle = window.document.title;
    window.document.title = `${docItem.document_type || 'Document'} - ${docItem.resident_name || ''}`;

    // Remove any previous print iframe
    const oldIframe = window.document.getElementById('print-doc-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = window.document.createElement('iframe');
    iframe.id = 'print-doc-iframe';
    iframe.setAttribute('style', 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none;');
    window.document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc) return;

    frameDoc.open();
    frameDoc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${docItem.document_type || 'Official Document'}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 0mm !important;
    }
    ${PRINT_CSS}
  </style>
</head>
<body>
  ${getCertificateBody(docItem)}
</body>
</html>`);
    frameDoc.close();

    const cleanup = () => {
      try {
        window.document.title = originalTitle;
        document.body.style.pointerEvents = 'auto';
        const f = window.document.getElementById('print-doc-iframe');
        if (f) f.remove();
        window.focus();
      } catch {}
      if (onStatusUpdated) onStatusUpdated();
    };

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print trigger error:', err);
      }
      iframe.contentWindow?.addEventListener('afterprint', cleanup);
      window.addEventListener('afterprint', cleanup, { once: true });
      window.addEventListener('focus', cleanup, { once: true });
      setTimeout(cleanup, 2000);
    }, 350);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-slate-100 dark:bg-slate-900"
          role="dialog"
          aria-modal="true"
          aria-label="Document Print Preview"
        >
          {/* Sticky Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
            <div className="flex items-center gap-2.5">
              <Shield className="text-indigo-600 shrink-0" size={20} />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Official Barangay Document Preview &amp; Print
                </h2>
                <p className="text-[11px] text-slate-500">
                  Office of the Punong Barangay — Pianing, Butuan City &bull; {docItem.document_type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                  className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="px-2 py-0.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono text-[11px] transition-colors cursor-pointer"
                  title="Reset Zoom"
                >
                  {zoomLevel}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(140, prev + 10))}
                  className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
              </div>

                <Button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 h-9 shadow-sm cursor-pointer"
                >
                  <Download size={15} className={downloading ? 'animate-bounce' : ''} />
                  {downloading ? 'Downloading...' : 'Download PDF'}
                </Button>

                <Button
                  onClick={handlePrint}
                  size="sm"
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 h-9 shadow-sm cursor-pointer"
                >
                  <Printer size={15} /> Print Document
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="text-xs h-9 px-3 gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                  title="Close and return to dashboard"
                >
                  <X size={15} /> Close Preview
                </Button>
            </div>
          </div>

          {/* Print Tip Banner */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 px-5 py-2 text-xs flex items-center gap-2 shrink-0">
            <span>
              💡 <strong>Print Tip:</strong> In the browser print dialog, expand <em>&ldquo;More settings&rdquo;</em> and <strong>uncheck &ldquo;Headers and footers&rdquo;</strong> for a clean official printout.
            </span>
          </div>

          {/* Scrollable Document Body with Near Full-Screen High-Legibility Layout */}
          <div className="flex-1 overflow-y-auto py-8 px-4 flex justify-center items-start">
            <div
              className="bg-white text-black shadow-2xl border border-slate-300 rounded-sm transition-transform duration-150"
              style={{
                width: '100%',
                maxWidth: '890px',
                minHeight: '1120px',
                padding: '60px 72px',
                boxSizing: 'border-box',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '12pt',
                lineHeight: '1.75',
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <CertificatePreview doc={docItem} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

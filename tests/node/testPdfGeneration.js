import { jsPDF } from 'jspdf';
import fs from 'fs';

function generateDocumentPdf(doc) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 215.9mm
  const margin = 20;
  const contentWidth = pageWidth - margin * 2; // 175.9mm

  // Letterhead
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  pdf.text('Republic of the Philippines', pageWidth / 2, 22, { align: 'center' });
  pdf.text('Province of Agusan del Norte', pageWidth / 2, 26.5, { align: 'center' });
  pdf.text('City of Butuan', pageWidth / 2, 31, { align: 'center' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  const brgy = (doc.barangay || 'Pianing').toUpperCase();
  pdf.text(`BARANGAY ${brgy}`, pageWidth / 2, 36.5, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text('OFFICE OF THE PUNONG BARANGAY', pageWidth / 2, 41.5, { align: 'center' });

  // Divider line
  pdf.setDrawColor(40, 70, 140);
  pdf.setLineWidth(0.8);
  pdf.line(margin, 45, pageWidth - margin, 45);

  pdf.setDrawColor(160, 160, 160);
  pdf.setLineWidth(0.3);
  pdf.line(margin, 46.5, pageWidth - margin, 46.5);

  // Document Title
  let docTitle = (doc.document_type || 'CERTIFICATE').toUpperCase();
  if (docTitle === 'BUSINESS CLEARANCE') docTitle = 'BARANGAY BUSINESS CLEARANCE';
  if (docTitle.includes('LAND OCCUPANCY')) docTitle = 'CERTIFICATE OF LAND OCCUPANCY';
  if (docTitle.includes('RESIDENCY')) docTitle = 'CERTIFICATE OF RESIDENCY';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(docTitle, pageWidth / 2, 60, { align: 'center' });

  // Tracking info
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 100, 100);
  const refCode = doc.request_code || `REQ-${doc.id || Date.now()}`;
  pdf.text(`Control / Reference No.: ${refCode}`, margin, 70);
  const dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  pdf.text(`Date Issued: ${dateStr}`, pageWidth - margin, 70, { align: 'right' });

  // Salutation
  let y = 84;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  pdf.text('TO WHOM IT MAY CONCERN:', margin, y);

  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(30, 30, 30);

  // Parse extra fields
  let extra = {};
  try {
    if (doc.extra_fields) {
      extra = typeof doc.extra_fields === 'string' ? JSON.parse(doc.extra_fields) : doc.extra_fields;
    }
  } catch (e) {}

  const residentName = (doc.resident_name || 'Resident').toUpperCase();
  const address = doc.resident_address || doc.address || `Barangay ${doc.barangay || 'Pianing'}, Butuan City`;
  const civilStatus = doc.resident_civil_status || doc.civil_status || 'Single';
  const purpose = doc.purpose || 'Official requirement';

  let bodyParagraphs = [];

  if (docTitle === 'CERTIFICATE OF RESIDENCY') {
    bodyParagraphs.push(
      `This is to certify that ${residentName}, Filipino, of legal age, ${civilStatus}, is a bonafide resident of ${address}.`,
      `Based on the official census and civil records of this Barangay, the above-mentioned individual has been residing within our jurisdiction in good moral standing without any pending complaints, derogatory background, or civil disputes filed against them.`,
      `This certification is issued upon the request of ${residentName} for the purpose of: ${purpose.toUpperCase()} and for whatever legal intents it may serve.`
    );
  } else if (docTitle === 'BARANGAY BUSINESS CLEARANCE') {
    const bizName = (extra['Business Name'] || extra['business_name'] || 'COMMERCIAL ESTABLISHMENT').toUpperCase();
    const bizNature = extra['Nature of Business'] || extra['business_type'] || 'General Merchandise';
    const bizLoc = extra['Business Address'] || extra['business_location'] || address;

    bodyParagraphs.push(
      `This is to certify that Barangay Business Clearance is hereby granted to:`,
      `Business Name: ${bizName}\nNature / Line of Business: ${bizNature}\nOperating Address: ${bizLoc}\nOwner / Operator: ${residentName}`,
      `This clearance is issued pursuant to the provisions of Section 152 of Republic Act No. 7160 (The Local Government Code of 1991), following satisfactory evaluation and compliance with all pertinent Barangay health, environmental, and public safety regulations.`,
      `Purpose: ${purpose.toUpperCase()}`
    );
  } else if (docTitle === 'CERTIFICATE OF LAND OCCUPANCY') {
    const lotNum = extra['Lot Number'] || extra['lot_number'] || 'N/A';
    const landArea = extra['Approximate Land Area'] || extra['land_area'] || 'N/A';
    const surveyInfo = extra['Survey / Cadastral Info'] || extra['survey_info'] || 'N/A';
    const occSince = extra['Occupancy Since'] || extra['occupancy_since'] || 'N/A';
    const landLocation = extra['Land / Property Location'] || extra['land_location'] || address;

    bodyParagraphs.push(
      `This is to certify that ${residentName}, Filipino citizen, of legal age, ${civilStatus}, residing at ${address}, is the actual and physical occupant of a parcel of land situated at:`,
      `Location of Property: ${landLocation}\nLot Number: ${lotNum}\nApproximate Land Area: ${landArea}\nCadastral / Survey Information: ${surveyInfo}\nOccupancy Duration: ${occSince}`,
      `This certifies further that, to the best knowledge and available records of this office, the subject parcel of land has been peacefully, openly, and continuously occupied and possessed by the aforementioned occupant without active boundary dispute or adverse claimant registered with the Lupong Tagapamayapa of this Barangay.`,
      `This certification is issued upon the request of the interested party for the purpose of: ${purpose.toUpperCase()} and for whatever legal intent it may serve.`
    );
  } else {
    bodyParagraphs.push(
      `This is to certify that ${residentName}, of legal age, ${civilStatus}, Filipino citizen, residing at ${address}, is an established resident in good standing of Barangay ${doc.barangay || 'Pianing'}, Butuan City.`,
      `The records of this office show that said individual maintains good moral character and has no derogatory record or ongoing community grievance on file.`,
      `This official clearance is issued upon personal request for: ${purpose.toUpperCase()}.`
    );
  }

  for (const para of bodyParagraphs) {
    const lines = pdf.splitTextToSize(para, contentWidth);
    pdf.text(lines, margin, y);
    y += lines.length * 5.8 + 4;
  }

  y += 4;
  const issuanceText = `Issued this ${new Date().getDate()}th day of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} at Barangay ${doc.barangay || 'Pianing'}, Butuan City, Agusan del Norte, Philippines.`;
  const issLines = pdf.splitTextToSize(issuanceText, contentWidth);
  pdf.text(issLines, margin, y);

  y += 24;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Applicant Signature:', margin, y);
  pdf.line(margin, y + 10, margin + 50, y + 10);

  const sigRightX = pageWidth - margin - 55;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('HON. JUAN DELA CRUZ', sigRightX + 27, y + 6, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text('Punong Barangay', sigRightX + 27, y + 11, { align: 'center' });
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text('(Not valid without dry seal)', sigRightX + 27, y + 16, { align: 'center' });

  return Buffer.from(pdf.output('arraybuffer'));
}

const sampleDoc = {
  id: 101,
  request_code: 'DOC-2026-9912',
  resident_name: 'Esidore Ayaton',
  document_type: 'Certificate of Land Occupancy',
  purpose: 'Bank Loan Collateral & Titling Requirement',
  barangay: 'Pianing',
  resident_address: 'Purok 3, Barangay Pianing, Butuan City',
  resident_civil_status: 'Single',
  extra_fields: JSON.stringify({
    'Land / Property Location': 'Purok 3, Sitio Riverside, Barangay Pianing',
    'Lot Number': 'Lot 451-B, Cad. 84',
    'Approximate Land Area': '450 sq. meters',
    'Survey / Cadastral Info': 'Cadastral Survey No. B-201',
    'Occupancy Since': 'Since 2012 (14 years continuous)'
  })
};

const buf = generateDocumentPdf(sampleDoc);
console.log('✅ PDF Generated successfully! Size:', buf.length, 'bytes');

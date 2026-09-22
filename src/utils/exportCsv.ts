/**
 * Exports JSON array data into downloadable CSV format
 */
export function exportToCsv(filename: string, rows: object[]) {
  if (!rows || !rows.length) {
    alert('No data available to export');
    return;
  }

  const separator = ',';
  const keys = Object.keys(rows[0]);
  
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map(row => {
        return keys
          .map(k => {
            let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : (row as any)[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import html2pdf from 'html2pdf.js';
import { jsPDF } from 'jspdf';
import { PIANING_LOGO_BASE64, BUTUAN_LOGO_BASE64 } from '../app/components/officialLogos';

export interface OfficialReportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  colWidths?: number[];
}

export interface OfficialReportOptions {
  title: string;
  subtitle: string;
  department?: string;
  preparedBy?: string;
  preparedByTitle?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  barangay?: string;
  stats?: { label: string; value: string | number; color?: string }[];
  tables?: OfficialReportTable[];
}

/**
 * Computes calibrated width percentages for table columns.
 * Specifically handles Resident Demographics with exact ratios:
 * ID: 5%, First Name: 12%, Last Name: 15%, Gender: 8%, Address: 25%, Phone: 15%, Email: 20%
 */
export function getColumnWidthPercentages(headers: string[], customWidths?: number[]): number[] {
  if (customWidths && customWidths.length === headers.length) {
    const sum = customWidths.reduce((a, b) => a + b, 0);
    return customWidths.map(w => (w / sum) * 100);
  }

  const normHeaders = headers.map(h => h.toLowerCase().trim());
  const hasId = normHeaders.includes('id');
  const hasFirst = normHeaders.some(h => h.includes('first'));
  const hasLast = normHeaders.some(h => h.includes('last'));
  const hasAddress = normHeaders.some(h => h.includes('address'));
  const hasPhone = normHeaders.some(h => h.includes('phone') || h.includes('contact'));
  const hasEmail = normHeaders.some(h => h.includes('email'));

  if (hasId && hasFirst && hasLast && hasAddress && hasPhone && hasEmail) {
    return headers.map(h => {
      const lower = h.toLowerCase().trim();
      if (lower === 'id') return 5;
      if (lower.includes('first')) return 12;
      if (lower.includes('last')) return 15;
      if (lower.includes('gender') || lower.includes('sex')) return 8;
      if (lower.includes('address')) return 25;
      if (lower.includes('phone') || lower.includes('contact')) return 15;
      if (lower.includes('email')) return 20;
      return 10;
    });
  }

  // Universal heuristic fallback for other administrative tables
  const weights = headers.map(h => {
    const lower = h.toLowerCase().trim();
    if (lower === 'id' || lower === '#') return 5;
    if (lower.includes('code') || lower.includes('dose') || lower.includes('unit')) return 10;
    if (lower.includes('gender') || lower.includes('sex') || lower.includes('age') || lower.includes('bp') || lower.includes('risk')) return 8;
    if (lower.includes('address')) return 25;
    if (lower.includes('email')) return 20;
    if (lower.includes('phone') || lower.includes('contact')) return 15;
    if (lower.includes('name') || lower.includes('patient') || lower.includes('mother') || lower.includes('child')) return 16;
    if (lower.includes('date') || lower.includes('status') || lower.includes('category') || lower.includes('vaccine') || lower.includes('program')) return 13;
    return 12;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => (w / total) * 100);
}

/**
 * Builds the inner HTML body for the official Barangay report
 */
export function buildReportBodyHtml(options: OfficialReportOptions): string {
  const {
    title,
    subtitle,
    department = 'Office of the Punong Barangay',
    preparedBy = 'Admin Juan Dela Cruz',
    preparedByTitle = 'Barangay Administrator',
    stats = [],
    tables = []
  } = options;
  const brgyName = options.barangay || 'Pianing';
  const brgyUpper = brgyName.toUpperCase();
  let statsHtml = '';
  if (stats.length > 0) {
    const rows: { left: typeof stats[0]; right?: typeof stats[0] }[] = [];
    for (let i = 0; i < stats.length; i += 2) {
      rows.push({
        left: stats[i],
        right: stats[i + 1]
      });
    }

    statsHtml = `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 9.5pt; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px;">
          I. Executive Demographic &amp; Statistical Summary
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="width: 25%; padding: 5px 8px; background: #f8fafc; border: 1px solid #cbd5e1; font-weight: 600; color: #334155;">${r.left.label}</td>
                <td style="width: 25%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; text-align: right;">${r.left.value}</td>
                ${r.right ? `
                  <td style="width: 25%; padding: 5px 8px; background: #f8fafc; border: 1px solid #cbd5e1; font-weight: 600; color: #334155;">${r.right.label}</td>
                  <td style="width: 25%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; text-align: right;">${r.right.value}</td>
                ` : `
                  <td style="width: 25%; padding: 5px 8px; background: #f8fafc; border: 1px solid #cbd5e1;"></td>
                  <td style="width: 25%; padding: 5px 8px; border: 1px solid #cbd5e1;"></td>
                `}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const tablesHtml = tables.map((t, index) => {
    const romanNumeral = stats.length > 0 ? (index === 0 ? 'II' : 'III') : (index === 0 ? 'I' : 'II');
    const colPercentages = getColumnWidthPercentages(t.headers, (t as any).colWidths);

    return `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 9.5pt; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px;">
          ${romanNumeral}. ${t.title}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: left; table-layout: fixed;">
          <thead>
            <tr style="background: #f1f5f9;">
              ${t.headers.map((h, hIdx) => {
                const widthPct = colPercentages[hIdx].toFixed(1);
                return `<th style="width: ${widthPct}%; padding: 6px 8px; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 7.5pt; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; vertical-align: middle;">${h}</th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${t.rows.length === 0 ? `
              <tr><td colspan="${t.headers.length}" style="text-align: center; padding: 12px; color: #64748b; border: 1px solid #cbd5e1;">No records found.</td></tr>
            ` : t.rows.map((row, i) => `
              <tr style="background: ${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                ${row.map((cell, cIdx) => {
                  const widthPct = colPercentages[cIdx].toFixed(1);
                  const hLower = (t.headers[cIdx] || '').toLowerCase();
                  const isBreakAll = hLower.includes('email') || hLower.includes('address');
                  const wordBreakStyle = isBreakAll ? 'word-break: break-all; word-wrap: break-word; overflow-wrap: break-word;' : 'word-wrap: break-word; overflow-wrap: break-word;';
                  return `<td style="width: ${widthPct}%; padding: 5px 8px; color: #1e293b; border: 1px solid #cbd5e1; ${wordBreakStyle} vertical-align: top; line-height: 1.35;">${cell ?? ''}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const nowFormatted = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div class="hdr-container">
      <div class="hdr-logo-box"><img src="${BUTUAN_LOGO_BASE64}" class="hdr-logo" alt="City of Butuan Seal" /></div>
      <div class="header-text">
        <h4>Republic of the Philippines</h4>
        <h3>Province of Agusan del Norte • City of Butuan</h3>
        <h2>BARANGAY ${brgyUpper}</h2>
        <h1>${department}</h1>
        <p>${brgyName}, Butuan City, Agusan del Norte 8600, Philippines</p>
      </div>
      <div class="hdr-logo-box"><img src="${PIANING_LOGO_BASE64}" class="hdr-logo" alt="Barangay ${brgyName} Seal" /></div>
    </div>
    <div class="hdr-divider"></div>

    <div class="title-section">
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>

    <div class="report-meta-bar">
      <div><strong>DATE GENERATED:</strong> ${nowFormatted}</div>
    </div>

    ${statsHtml}
    ${tablesHtml}

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-label">Prepared By:</div>
        <div class="sig-line">${preparedBy}</div>
        <div class="sig-title">${preparedByTitle}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Approved By:</div>
        <div class="sig-line">HON. VIRGENIA S. GOLANDRINA</div>
        <div class="sig-title">Punong Barangay</div>
      </div>
    </div>
  `;
}

/**
 * Generates the standardized, formal Philippine LGU report HTML for window preview
 */
export function buildReportHtml(options: OfficialReportOptions, isPrintMode = false): string {
  const orientation = options.orientation || 'landscape';
  const bodyHtml = buildReportBodyHtml({ ...options, orientation });
  const brgyName = options.barangay || 'Pianing';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${options.title} - Barangay ${brgyName}, Butuan City</title>
        <style>
          @page { size: A4 ${orientation}; margin: ${orientation === 'landscape' ? '8mm 10mm' : '12mm 15mm'}; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: ${isPrintMode ? '16px' : '0'};
            background: #ffffff;
            line-height: 1.4;
          }
          .hdr-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 8px;
          }
          .hdr-logo-box {
            width: 72px;
            height: 72px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .hdr-logo {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .header-text {
            text-align: center;
            flex: 1;
            padding: 0 12px;
          }
          .header-text h4 {
            margin: 0;
            font-size: 9.5pt;
            text-transform: uppercase;
            font-weight: normal;
            color: #475569;
            letter-spacing: 0.5px;
          }
          .header-text h3 {
            margin: 2px 0;
            font-size: 10pt;
            font-weight: 600;
            color: #334155;
          }
          .header-text h2 {
            margin: 3px 0 2px 0;
            font-size: 13pt;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-text h1 {
            margin: 2px 0 0 0;
            font-size: 13.5pt;
            font-weight: 900;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #1e3a8a;
          }
          .header-text p {
            margin: 2px 0 0 0;
            font-size: 8pt;
            color: #64748b;
          }
          .hdr-divider {
            border-top: 2px solid #0f172a;
            border-bottom: 1px solid #0f172a;
            height: 3px;
            margin: 8px 0 16px 0;
          }
          .title-section {
            text-align: center;
            margin-bottom: 16px;
          }
          .title-section h2 {
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
            color: #0f172a;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .title-section p {
            font-size: 9.5pt;
            color: #475569;
            margin: 4px 0 0 0;
            font-style: italic;
          }
          .report-meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8.5pt;
            color: #334155;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 6px 12px;
            margin-bottom: 18px;
          }
          .signatures {
            margin-top: 36px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            page-break-inside: avoid;
          }
          .sig-block {
            text-align: center;
            width: 220px;
          }
          .sig-label {
            margin-bottom: 35px;
            font-weight: bold;
            font-size: 8.5pt;
            text-align: left;
            color: #334155;
            text-transform: uppercase;
          }
          .sig-line {
            border-top: 1px solid #0f172a;
            padding-top: 4px;
            font-weight: bold;
            font-size: 9.5pt;
            text-transform: uppercase;
            color: #0f172a;
          }
          .sig-title {
            font-size: 8.5pt;
            color: #475569;
          }
          .seal-circle {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 2px double #1e3a8a;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 6pt;
            font-weight: bold;
            color: #1e3a8a;
            margin: 0 auto;
            text-transform: uppercase;
            line-height: 1.2;
          }
          .print-toolbar {
            position: sticky;
            top: 0;
            background: #0f172a;
            color: #ffffff;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: -16px -16px 16px -16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          @media print {
            .print-toolbar { display: none !important; }
            body { padding: 0 !important; }
          }
        </style>
      </head>
      <body>
        ${isPrintMode ? `
          <div class="print-toolbar">
            <span style="font-size: 9.5pt; font-weight: 600;">Official Barangay Document Preview</span>
            <div style="display: flex; gap: 8px;">
              <button onclick="window.print()" style="background: #2563eb; color: #ffffff; border: none; padding: 6px 14px; font-size: 9pt; font-weight: 600; border-radius: 4px; cursor: pointer;">
                Print Document
              </button>
              <button onclick="window.close()" style="background: #334155; color: #ffffff; border: none; padding: 6px 12px; font-size: 9pt; border-radius: 4px; cursor: pointer;">
                Close
              </button>
            </div>
          </div>
        ` : ''}

        ${bodyHtml}
      </body>
    </html>
  `;
}

/**
 * Directly downloads the official report as a client-side .pdf file using high-precision vector rendering
 */
export async function downloadOfficialPdf(options: OfficialReportOptions): Promise<void> {
  const cleanFilename = options.filename
    ? (options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`)
    : `${options.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

  const orientation = options.orientation || 'landscape';

  try {
    generateDirectJsPdfReport(options, orientation, cleanFilename);
  } catch (err) {
    console.error('Failed to generate direct jsPDF report:', err);
    throw err;
  } finally {
    try {
      document.body.style.pointerEvents = 'auto';
    } catch {}
  }
}

export function generateDirectJsPdfReport(options: OfficialReportOptions, orientation: 'portrait' | 'landscape', filename: string): void {
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2);
  let y = 14;

  const brgyName = (options.barangay || 'Pianing').toUpperCase();
  const dept = options.department || 'OFFICE OF THE PUNONG BARANGAY';

  // Letterhead
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REPUBLIC OF THE PHILIPPINES', pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.text('PROVINCE OF AGUSAN DEL NORTE • CITY OF BUTUAN', pageWidth / 2, y, { align: 'center' });
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`BARANGAY ${brgyName}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text(dept.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${options.barangay || 'Pianing'}, Butuan City, Agusan del Norte 8600, Philippines`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  // Double divider line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 1;
  doc.setLineWidth(0.2);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  // Title Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(options.title.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(options.subtitle, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Meta Bar
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginX, y, contentWidth, 7, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const nowStr = new Date().toLocaleString('en-PH');
  doc.text(`DATE GENERATED: ${nowStr}`, marginX + 3, y + 4.8);
  y += 11;

  // Summary Stats
  if (options.stats && options.stats.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('I. EXECUTIVE DEMOGRAPHIC & STATISTICAL SUMMARY', marginX, y);
    y += 4.5;

    const colWidth = contentWidth / 2;
    for (let i = 0; i < options.stats.length; i += 2) {
      const left = options.stats[i];
      const right = options.stats[i + 1];

      // Left box
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, colWidth * 0.6, 6, 'FD');
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX + (colWidth * 0.6), y, colWidth * 0.4, 6, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(left.label, marginX + 2, y + 4.2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(left.value), marginX + (colWidth * 0.6) + (colWidth * 0.4) - 2, y + 4.2, { align: 'right' });

      // Right box if exists
      if (right) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX + colWidth, y, colWidth * 0.6, 6, 'FD');
        doc.setFillColor(255, 255, 255);
        doc.rect(marginX + colWidth + (colWidth * 0.6), y, colWidth * 0.4, 6, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.text(right.label, marginX + colWidth + 2, y + 4.2);
        doc.setFont('helvetica', 'bold');
        doc.text(String(right.value), marginX + colWidth + (colWidth * 0.6) + (colWidth * 0.4) - 2, y + 4.2, { align: 'right' });
      }

      y += 6;
    }
    y += 5;
  }

  // Tables
  if (options.tables && options.tables.length > 0) {
    options.tables.forEach((table, tIdx) => {
      if (y > pageHeight - 45) {
        doc.addPage();
        y = 15;
      }

      const roman = (options.stats && options.stats.length > 0) ? (tIdx === 0 ? 'II' : 'III') : (tIdx === 0 ? 'I' : 'II');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`${roman}. ${table.title.toUpperCase()}`, marginX, y);
      y += 4.5;

      const numCols = table.headers.length || 1;
      const colPercentages = getColumnWidthPercentages(table.headers, table.colWidths);
      const colWidths = colPercentages.map(pct => (pct / 100) * contentWidth);

      // Precalculate exact column X offsets
      const colXPositions: number[] = [];
      let currentX = marginX;
      for (let c = 0; c < numCols; c++) {
        colXPositions.push(currentX);
        currentX += colWidths[c];
      }

      const headerHeight = 6.5;

      // Table header background
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(marginX, y, contentWidth, headerHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      
      table.headers.forEach((h, hIdx) => {
        const cX = colXPositions[hIdx];
        if (hIdx > 0) {
          doc.line(cX, y, cX, y + headerHeight);
        }
        const hText = String(h);
        doc.text(hText, cX + 2.5, y + 4.5);
      });
      y += headerHeight;

      // Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      if (table.rows.length === 0) {
        const emptyHeight = 6;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.rect(marginX, y, contentWidth, emptyHeight, 'FD');
        doc.setTextColor(148, 163, 184);
        doc.text('No records found.', pageWidth / 2, y + 4, { align: 'center' });
        y += emptyHeight;
      } else {
        table.rows.forEach((row, rIdx) => {
          // Pre-wrap text for each cell and determine dynamic row height
          const cellLinesList: string[][] = row.map((cell, cIdx) => {
            const usableWidth = colWidths[cIdx] - 4; // 2mm padding on left & right
            const rawText = String(cell ?? '');
            return doc.splitTextToSize(rawText, Math.max(usableWidth, 8));
          });

          const maxLines = Math.max(...cellLinesList.map(lines => lines.length), 1);
          const dynamicRowHeight = Math.max(5.8, 3.2 + (maxLines * 3.0));

          if (y + dynamicRowHeight > pageHeight - 25) {
            doc.addPage();
            y = 15;

            // Re-render table header on page split
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.rect(marginX, y, contentWidth, headerHeight, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(15, 23, 42);
            table.headers.forEach((h, hIdx) => {
              const cX = colXPositions[hIdx];
              if (hIdx > 0) doc.line(cX, y, cX, y + headerHeight);
              doc.text(String(h), cX + 2.5, y + 4.5);
            });
            y += headerHeight;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
          }

          if (rIdx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
          } else {
            doc.setFillColor(255, 255, 255);
          }
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.2);
          doc.rect(marginX, y, contentWidth, dynamicRowHeight, 'FD');
          doc.setTextColor(30, 41, 59);

          // Draw distinct column boundaries and wrapped text
          row.forEach((_, cIdx) => {
            const cX = colXPositions[cIdx];
            if (cIdx > 0) {
              doc.line(cX, y, cX, y + dynamicRowHeight);
            }
            const lines = cellLinesList[cIdx];
            lines.forEach((lineText: string, lIdx: number) => {
              doc.text(lineText, cX + 2.5, y + 3.8 + (lIdx * 3.0));
            });
          });

          y += dynamicRowHeight;
        });
      }
      y += 5;
    });
  }

  // Signatures
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 20;
  } else {
    y = Math.max(y + 6, pageHeight - 35);
  }

  const sigWidth = 55;
  const leftSigX = marginX + 10;
  const rightSigX = pageWidth - marginX - sigWidth - 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('PREPARED BY:', leftSigX, y);
  doc.text('APPROVED BY:', rightSigX, y);
  y += 12;

  doc.setLineWidth(0.4);
  doc.setDrawColor(15, 23, 42);
  doc.line(leftSigX, y, leftSigX + sigWidth, y);
  doc.line(rightSigX, y, rightSigX + sigWidth, y);
  y += 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text((options.preparedBy || 'Barangay Administrator').toUpperCase(), leftSigX + (sigWidth / 2), y, { align: 'center' });
  doc.text('HON. VIRGENIA S. GOLANDRINA', rightSigX + (sigWidth / 2), y, { align: 'center' });
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(options.preparedByTitle || 'Barangay Administrator', leftSigX + (sigWidth / 2), y, { align: 'center' });
  doc.text('Punong Barangay', rightSigX + (sigWidth / 2), y, { align: 'center' });

  // Save the PDF file directly to downloads!
  doc.save(filename);
}

/**
 * Opens a print-preview window with clean toolbar
 */
export function printOfficialReport(options: OfficialReportOptions) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open the official document preview.');
    return;
  }

  const orientation = options.orientation || 'landscape';
  const html = buildReportHtml({ ...options, orientation }, true);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

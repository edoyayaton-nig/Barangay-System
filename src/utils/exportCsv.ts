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
import { PIANING_LOGO_BASE64, BUTUAN_LOGO_BASE64 } from '../app/components/officialLogos';

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
  tables?: { title: string; headers: string[]; rows: (string | number)[][] }[];
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
    return `
      <div style="margin-bottom: 20px;">
        <div style="font-size: 9.5pt; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px;">
          ${romanNumeral}. ${t.title}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8pt; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9;">
              ${t.headers.map(h => `<th style="padding: 5px 7px; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 7.5pt;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${t.rows.length === 0 ? `
              <tr><td colspan="${t.headers.length}" style="text-align: center; padding: 12px; color: #64748b; border: 1px solid #cbd5e1;">No records found.</td></tr>
            ` : t.rows.map((row, i) => `
              <tr style="background: ${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                ${row.map(cell => `<td style="padding: 4px 7px; color: #1e293b; border: 1px solid #e2e8f0;">${cell}</td>`).join('')}
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
 * Directly downloads the official report as a client-side .pdf file
 */
export async function downloadOfficialPdf(options: OfficialReportOptions): Promise<void> {
  const bodyHtml = buildReportBodyHtml(options);

  // Clean container without negative coordinates so html2canvas renders the full document
  const element = document.createElement('div');
  element.className = 'official-pdf-download-root';
  element.innerHTML = `
    <style>
      .official-pdf-download-root {
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        color: #1e293b;
        background: #ffffff;
        line-height: 1.4;
        padding: 16px;
        box-sizing: border-box;
      }
      .official-pdf-download-root * {
        box-sizing: border-box;
      }
      .hdr-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
      }
      .hdr-logo-box {
        width: 70px;
        height: 70px;
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
        font-size: 9pt;
        text-transform: uppercase;
        font-weight: normal;
        color: #475569;
        letter-spacing: 0.5px;
      }
      .header-text h3 {
        margin: 2px 0;
        font-size: 9.5pt;
        font-weight: 600;
        color: #334155;
      }
      .header-text h2 {
        margin: 2px 0;
        font-size: 12pt;
        font-weight: 800;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .header-text h1 {
        margin: 2px 0 0 0;
        font-size: 13pt;
        font-weight: 900;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #1e3a8a;
      }
      .header-text p {
        margin: 2px 0 0 0;
        font-size: 7.5pt;
        color: #64748b;
      }
      .hdr-divider {
        border-top: 2px solid #0f172a;
        border-bottom: 1px solid #0f172a;
        height: 3px;
        margin: 8px 0 14px 0;
      }
      .title-section {
        text-align: center;
        margin-bottom: 14px;
      }
      .title-section h2 {
        font-size: 13pt;
        font-weight: bold;
        text-transform: uppercase;
        color: #0f172a;
        margin: 0;
        letter-spacing: 0.5px;
      }
      .title-section p {
        font-size: 9pt;
        color: #475569;
        margin: 3px 0 0 0;
        font-style: italic;
      }
      .report-meta-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 8pt;
        color: #334155;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        padding: 6px 12px;
        margin-bottom: 16px;
      }
      .signatures {
        margin-top: 30px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        page-break-inside: avoid;
      }
      .sig-block {
        text-align: center;
        width: 200px;
      }
      .sig-label {
        margin-bottom: 30px;
        font-weight: bold;
        font-size: 8pt;
        text-align: left;
        color: #334155;
        text-transform: uppercase;
      }
      .sig-line {
        border-top: 1px solid #0f172a;
        padding-top: 4px;
        font-weight: bold;
        font-size: 9pt;
        text-transform: uppercase;
        color: #0f172a;
      }
      .sig-title {
        font-size: 8pt;
        color: #475569;
      }
      .seal-circle {
        width: 75px;
        height: 75px;
        border-radius: 50%;
        border: 2px double #1e3a8a;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 5.5pt;
        font-weight: bold;
        color: #1e3a8a;
        margin: 0 auto;
        text-transform: uppercase;
        line-height: 1.2;
      }
    </style>
    ${bodyHtml}
  `;

  const cleanFilename = options.filename
    ? (options.filename.endsWith('.pdf') ? options.filename : `${options.filename}.pdf`)
    : `${options.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

  const orientation = options.orientation || 'landscape';
  const widthPx = orientation === 'landscape' ? 1122 : 794;

  // Render container on screen top-left with high z-index and white background
  const container = document.createElement('div');
  container.className = 'official-pdf-download-root';
  container.id = `official-pdf-render-${Date.now()}`;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = `${widthPx}px`;
  container.style.maxWidth = `${widthPx}px`;
  container.style.minHeight = '600px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '9999999';
  container.style.pointerEvents = 'none';
  container.style.overflow = 'visible';
  container.innerHTML = `
    <style>
      .official-pdf-download-root {
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        color: #1e293b;
        background: #ffffff;
        line-height: 1.4;
        padding: 24px;
        box-sizing: border-box;
      }
      .official-pdf-download-root * {
        box-sizing: border-box;
      }
      .hdr-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
      }
      .hdr-logo-box {
        width: 75px;
        height: 75px;
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
        padding: 0 16px;
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
        margin: 2px 0;
        font-size: 13pt;
        font-weight: 800;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .header-text h1 {
        margin: 2px 0 0 0;
        font-size: 14pt;
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
        border-top: 2.5px solid #0f172a;
        border-bottom: 1px solid #0f172a;
        height: 4px;
        margin: 10px 0 16px 0;
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
    </style>
    ${bodyHtml}
  `;

  document.body.appendChild(container);

  // Allow browser layout and decoding
  await new Promise(resolve => setTimeout(resolve, 150));

  const pdfOpt = {
    margin: orientation === 'landscape' ? [6, 8, 6, 8] : [8, 8, 8, 8],
    filename: cleanFilename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      x: 0,
      y: 0,
      windowWidth: widthPx,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: orientation
    }
  };

  try {
    // @ts-ignore
    await html2pdf().set(pdfOpt).from(container).save();
  } catch (err) {
    console.error('HTML2PDF error:', err);
    // Fallback: Open print dialog in new window so user still gets the PDF without fail
    printOfficialReport({ ...options, orientation });
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
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

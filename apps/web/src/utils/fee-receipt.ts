import type {
  FeeReceiptPayload,
  FeeReceiptTemplateRecord,
  SchoolBrandingRecord,
  SchoolSettingsRecord,
} from './api';
import { resolveAssetUrl } from './api';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function addressLines(receipt: FeeReceiptPayload) {
  const address = receipt.school.address;

  return [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(', ') || null,
    [address.country, address.postalCode].filter(Boolean).join(' - ') || null,
  ].filter((line): line is string => Boolean(line));
}

function normalizePdfText(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: string) {
  return normalizePdfText(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function wrapPdfText(value: string, maxChars: number) {
  const input = normalizePdfText(value);

  if (!input) {
    return [];
  }

  const words = input.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function formatPdfCurrency(value: number) {
  return `Rs ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function hexToPdfRgb(value: string | null | undefined, fallback: string) {
  const hex = (value ?? fallback).replace('#', '');
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : hex.padEnd(6, '0').slice(0, 6);

  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;

  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`;
}

function buildPdfFile(commands: string[]) {
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function receiptClassLabel(receipt: FeeReceiptPayload) {
  return [receipt.student.className, receipt.student.sectionName].filter(Boolean).join(' - ') || '-';
}

function receiptStudentRows(receipt: FeeReceiptPayload): Array<[string, string]> {
  return [
    ['Name', receipt.student.name],
    ['Student Code', receipt.student.studentCode],
    ['Class', receiptClassLabel(receipt)],
    ['Session', receipt.fee.session?.name || '-'],
  ];
}

function receiptPaymentRows(
  receipt: FeeReceiptPayload,
  currencyFormatter = formatCurrency,
): Array<[string, string]> {
  return [
    ['Fee Head', receipt.fee.name],
    ['Fee Code', receipt.fee.feeCode],
    ['Amount Paid', currencyFormatter(receipt.amount)],
    ['Reference', receipt.reference || '-'],
  ];
}

function receiptNoteBlocks(receipt: FeeReceiptPayload): Array<[string, string]> {
  return [
    ['Message', receipt.template.headerNote],
    ['Terms & Conditions', receipt.template.termsAndConditions],
    ['Footer Note', receipt.template.footerNote],
  ];
}

function buildReceiptMetaHtml(rows: ReadonlyArray<readonly [string, string]>) {
  return rows
    .map(
      ([label, value]) =>
        `<div class="meta-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join('');
}

function estimatePdfTextWidth(text: string, fontSize: number) {
  return normalizePdfText(text).length * fontSize * 0.52;
}

function pdfText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  options?: {
    font?: 'F1' | 'F2';
    fontSize?: number;
    color?: string;
    align?: 'left' | 'right' | 'center';
    width?: number;
  },
) {
  const sanitized = escapePdfText(text);
  if (!sanitized) {
    return;
  }

  const font = options?.font ?? 'F1';
  const fontSize = options?.fontSize ?? 10;
  const color = options?.color ?? '0 0 0';
  const align = options?.align ?? 'left';
  const width = options?.width ?? 0;
  const textWidth = estimatePdfTextWidth(text, fontSize);
  let adjustedX = x;

  if (align === 'right') {
    adjustedX = x + Math.max(width - textWidth, 0);
  } else if (align === 'center') {
    adjustedX = x + Math.max((width - textWidth) / 2, 0);
  }

  commands.push(`${color} rg`);
  commands.push(`BT /${font} ${fontSize} Tf ${adjustedX.toFixed(2)} ${y.toFixed(2)} Td (${sanitized}) Tj ET`);
}

function pdfRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  options?: {
    fillColor?: string;
    strokeColor?: string;
    lineWidth?: number;
  },
) {
  if (options?.lineWidth) {
    commands.push(`${options.lineWidth} w`);
  }
  if (options?.fillColor) {
    commands.push(`${options.fillColor} rg`);
  }
  if (options?.strokeColor) {
    commands.push(`${options.strokeColor} RG`);
  }

  if (options?.fillColor && options?.strokeColor) {
    commands.push(`${x} ${y} ${width} ${height} re B`);
    return;
  }

  if (options?.fillColor) {
    commands.push(`${x} ${y} ${width} ${height} re f`);
    return;
  }

  commands.push(`${x} ${y} ${width} ${height} re S`);
}

function pdfLine(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth = 1,
) {
  commands.push(`${lineWidth} w`);
  commands.push(`${color} RG`);
  commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function pdfWrappedText(
  commands: string[],
  text: string,
  x: number,
  startY: number,
  maxChars: number,
  lineHeight: number,
  options?: {
    font?: 'F1' | 'F2';
    fontSize?: number;
    color?: string;
    maxLines?: number;
  },
) {
  const lines = wrapPdfText(text, maxChars).slice(0, options?.maxLines ?? Number.POSITIVE_INFINITY);

  lines.forEach((line, index) => {
    pdfText(commands, line, x, startY - index * lineHeight, options);
  });

  return startY - lines.length * lineHeight;
}

function buildFeeReceiptPdf(receipt: FeeReceiptPayload) {
  const primaryColor = hexToPdfRgb(receipt.school.branding.primaryColor, '#0f766e');
  const secondaryColor = hexToPdfRgb(receipt.school.branding.secondaryColor, '#102033');
  const borderColor = '0.839 0.878 0.918';
  const surfaceColor = '0.969 0.980 0.992';
  const whiteColor = '1 1 1';
  const mutedColor = '0.373 0.435 0.510';
  const pageX = 30;
  const pageWidth = 535;
  const commands: string[] = ['1 J', '1 j', '0.8 w'];
  const studentRows = receiptStudentRows(receipt);
  const paymentRows = receiptPaymentRows(receipt, formatPdfCurrency);
  const noteBlocks = receiptNoteBlocks(receipt);
  const customFields = receipt.template.customFields.filter(
    (field) => field.label.trim() || field.value.trim(),
  );

  pdfRect(commands, 20, 20, 555, 802, {
    fillColor: whiteColor,
    strokeColor: borderColor,
    lineWidth: 1,
  });

  pdfRect(commands, pageX, 632, pageWidth, 160, {
    fillColor: surfaceColor,
    strokeColor: borderColor,
    lineWidth: 1,
  });

  if (receipt.template.showLogo) {
    pdfRect(commands, pageX + 18, 705, 58, 58, {
      fillColor: whiteColor,
      strokeColor: borderColor,
      lineWidth: 1,
    });
    pdfText(
      commands,
      receipt.school.schoolCode || receipt.school.name.slice(0, 3).toUpperCase(),
      pageX + 18,
      734,
      {
        color: primaryColor,
        font: 'F2',
        fontSize: 13,
        align: 'center',
        width: 58,
      },
    );
  }

  const brandX = receipt.template.showLogo ? pageX + 90 : pageX + 28;
  pdfText(commands, receipt.receiptNo, brandX, 758, {
    color: mutedColor,
    fontSize: 12,
  });
  pdfText(commands, receipt.school.name, brandX, 732, {
    color: secondaryColor,
    font: 'F2',
    fontSize: 28,
  });
  pdfText(commands, receipt.template.receiptTitle, brandX, 706, {
    color: mutedColor,
    fontSize: 14,
  });
  pdfText(commands, receipt.template.receiptSubtitle, brandX, 688, {
    color: mutedColor,
    fontSize: 10,
  });

  let addressY = 668;
  addressLines(receipt).forEach((line) => {
    pdfText(commands, line, brandX, addressY, {
      color: secondaryColor,
      font: 'F2',
      fontSize: 11,
    });
    addressY -= 16;
  });

  pdfRect(commands, pageX + 380, 690, 150, 78, {
    fillColor: whiteColor,
    strokeColor: borderColor,
    lineWidth: 1,
  });
  pdfText(commands, 'RECEIPT DATE', pageX + 398, 742, {
    color: mutedColor,
    font: 'F2',
    fontSize: 10,
  });
  pdfText(commands, formatDate(receipt.receiptDate), pageX + 398, 714, {
    color: primaryColor,
    font: 'F2',
    fontSize: 18,
  });
  pdfText(commands, `Mode: ${receipt.paymentMethod}`, pageX + 398, 690, {
    color: mutedColor,
    fontSize: 10,
  });

  const panelY = 456;
  const panelWidth = 235;
  const panelHeight = 120;

  pdfRect(commands, pageX + 16, panelY, panelWidth, panelHeight, {
    fillColor: whiteColor,
    strokeColor: borderColor,
    lineWidth: 1,
  });
  pdfRect(commands, pageX + 267, panelY, panelWidth, panelHeight, {
    fillColor: whiteColor,
    strokeColor: borderColor,
    lineWidth: 1,
  });

  pdfText(commands, 'Student Details', pageX + 32, 552, {
    color: secondaryColor,
    font: 'F2',
    fontSize: 12,
  });
  pdfText(commands, 'Payment Details', pageX + 283, 552, {
    color: secondaryColor,
    font: 'F2',
    fontSize: 12,
  });

  let leftRowY = 520;
  studentRows.forEach(([label, value], index) => {
    pdfText(commands, label, pageX + 32, leftRowY, {
      color: mutedColor,
      fontSize: 9,
    });
    pdfText(commands, value, pageX + 120, leftRowY, {
      color: secondaryColor,
      font: 'F2',
      fontSize: 9,
      align: 'right',
      width: 110,
    });
    if (index < studentRows.length - 1) {
      pdfLine(commands, pageX + 30, leftRowY - 8, pageX + 234, leftRowY - 8, borderColor, 0.6);
    }
    leftRowY -= 24;
  });

  let rightRowY = 520;
  paymentRows.forEach(([label, value], index) => {
    pdfText(commands, label, pageX + 283, rightRowY, {
      color: mutedColor,
      fontSize: 9,
    });
    pdfText(commands, value, pageX + 368, rightRowY, {
      color: secondaryColor,
      font: 'F2',
      fontSize: 9,
      align: 'right',
      width: 118,
    });
    if (index < paymentRows.length - 1) {
      pdfLine(commands, pageX + 281, rightRowY - 8, pageX + 485, rightRowY - 8, borderColor, 0.6);
    }
    rightRowY -= 24;
  });

  let currentY = 440;
  if (customFields.length) {
    const visibleFields = customFields.slice(0, 6);
    const chipRows = Math.ceil(visibleFields.length / 3);
    const chipHeight = 34;
    const sectionHeight = chipRows * (chipHeight + 10) - 10;
    const chipWidth = 156;

    visibleFields.forEach((field, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = pageX + 16 + column * (chipWidth + 10);
      const y = currentY - row * (chipHeight + 10) - chipHeight;

      pdfRect(commands, x, y, chipWidth, chipHeight, {
        fillColor: whiteColor,
        strokeColor: borderColor,
        lineWidth: 0.8,
      });
      pdfText(commands, field.label, x + 10, y + 20, {
        color: mutedColor,
        fontSize: 8,
      });
      pdfText(commands, field.value, x + 10, y + 8, {
        color: secondaryColor,
        font: 'F2',
        fontSize: 9,
      });
    });

    currentY -= sectionHeight + 24;
  }

  const tableTop = currentY;
  const tableHeaderHeight = 32;
  const tableRowHeight = 50;
  const tableBottom = tableTop - tableHeaderHeight - tableRowHeight;
  const columnWidths = [150, 68, 68, 68, 68, 64];
  const headers = ['Description', 'Assigned', 'Concession', 'Paid Before', 'Paid Now', 'Balance'];

  pdfRect(commands, pageX + 16, tableTop - tableHeaderHeight, 486, tableHeaderHeight, {
    fillColor: surfaceColor,
    strokeColor: borderColor,
    lineWidth: 1,
  });
  pdfRect(commands, pageX + 16, tableBottom, 486, tableRowHeight, {
    fillColor: whiteColor,
    strokeColor: borderColor,
    lineWidth: 1,
  });

  let columnX = pageX + 26;
  headers.forEach((header, index) => {
    pdfText(commands, header, columnX, tableTop - 20, {
      color: mutedColor,
      font: 'F2',
      fontSize: 9,
    });
    columnX += columnWidths[index];
  });

  pdfText(commands, receipt.fee.name, pageX + 26, tableTop - 54, {
    color: secondaryColor,
    font: 'F2',
    fontSize: 11,
  });
  pdfText(commands, receipt.fee.category, pageX + 26, tableTop - 72, {
    color: mutedColor,
    fontSize: 9,
  });

  const values = [
    formatPdfCurrency(receipt.fee.assignedAmount),
    formatPdfCurrency(receipt.fee.concessionAmount),
    formatPdfCurrency(receipt.fee.paidBeforeThisReceipt),
    formatPdfCurrency(receipt.amount),
    formatPdfCurrency(receipt.fee.dueAfterThisReceipt),
  ];
  let valueX = pageX + 212;
  const valueWidths = columnWidths.slice(1);
  values.forEach((value, index) => {
    pdfText(commands, value, valueX, tableTop - 62, {
      color: secondaryColor,
      font: 'F2',
      fontSize: 10,
      align: 'right',
      width: valueWidths[index] - 14,
    });
    valueX += valueWidths[index];
  });

  currentY = tableBottom - 20;
  noteBlocks.forEach(([heading, content]) => {
    const wrapped = wrapPdfText(content, 92).slice(0, 4);
    const noteHeight = Math.max(58, 26 + wrapped.length * 12);
    const noteY = currentY - noteHeight;

    pdfRect(commands, pageX + 16, noteY, 486, noteHeight, {
      fillColor: whiteColor,
      strokeColor: borderColor,
      lineWidth: 1,
    });
    pdfText(commands, heading, pageX + 30, noteY + noteHeight - 18, {
      color: secondaryColor,
      font: 'F2',
      fontSize: 12,
    });
    pdfWrappedText(commands, content, pageX + 30, noteY + noteHeight - 40, 92, 12, {
      color: mutedColor,
      fontSize: 9,
      maxLines: 4,
    });
    currentY = noteY - 14;
  });

  pdfText(commands, `Generated by ${receipt.school.name}`, pageX + 16, Math.max(currentY, 64), {
    color: mutedColor,
    fontSize: 9,
  });
  pdfText(
    commands,
    receipt.school.branding.supportEmail || receipt.school.contactEmail || '',
    pageX + 16,
    Math.max(currentY, 64) - 16,
    {
      color: mutedColor,
      fontSize: 9,
    },
  );

  if (receipt.template.showSignature) {
    pdfLine(commands, pageX + 332, Math.max(currentY, 64) + 4, pageX + 500, Math.max(currentY, 64) + 4, secondaryColor, 1);
    pdfText(commands, receipt.template.signatureLabel, pageX + 332, Math.max(currentY, 64) - 14, {
      color: mutedColor,
      fontSize: 9,
      align: 'center',
      width: 168,
    });
  }

  return buildPdfFile(commands);
}

export function buildFeeReceiptHtml(receipt: FeeReceiptPayload) {
  const primaryColor = receipt.school.branding.primaryColor || '#0f766e';
  const secondaryColor = receipt.school.branding.secondaryColor || '#102033';
  const logoUrl = resolveAssetUrl(receipt.school.branding.logoUrl);
  const customFields = receipt.template.customFields
    .filter((field) => field.label.trim() || field.value.trim())
    .map(
      (field) => `
        <div class="meta-chip">
          <span>${escapeHtml(field.label)}</span>
          <strong>${escapeHtml(field.value)}</strong>
        </div>
      `,
    )
    .join('');
  const address = addressLines(receipt)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');
  const studentRows = buildReceiptMetaHtml(receiptStudentRows(receipt));
  const paymentRows = buildReceiptMetaHtml(receiptPaymentRows(receipt));
  const noteBlocks = receiptNoteBlocks(receipt)
    .map(
      ([heading, content]) => `
        <div class="note-box">
          <h3>${escapeHtml(heading)}</h3>
          <p>${escapeHtml(content)}</p>
        </div>
      `,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(receipt.receiptNo)} - ${escapeHtml(receipt.school.name)}</title>
    <style>
      :root {
        color-scheme: light;
        --primary: ${escapeHtml(primaryColor)};
        --secondary: ${escapeHtml(secondaryColor)};
        --muted: #5f6f82;
        --border: #d6e0ea;
        --surface: #f7fafc;
      }
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      * { box-sizing: border-box; }
      html {
        background: white;
      }
      body {
        margin: 0;
        padding: 24px;
        font-family: "Plus Jakarta Sans", Arial, sans-serif;
        background: linear-gradient(180deg, #f8fbff, #eef5fb);
        color: #112132;
      }
      .receipt {
        max-width: 920px;
        margin: 0 auto;
        background: white;
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
      }
      .header {
        padding: 28px 32px 22px;
        background:
          radial-gradient(circle at top right, rgba(15, 118, 110, 0.16), transparent 28%),
          linear-gradient(135deg, rgba(15, 118, 110, 0.08), rgba(37, 99, 235, 0.05));
        border-bottom: 1px solid var(--border);
      }
      .header-top {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
      }
      .brand {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }
      .logo {
        width: 68px;
        height: 68px;
        border-radius: 16px;
        object-fit: cover;
        border: 1px solid rgba(15, 118, 110, 0.18);
        background: white;
      }
      h1, h2, h3, p { margin: 0; }
      .brand-copy h1 {
        color: var(--secondary);
        font-size: 1.9rem;
        line-height: 1.05;
        letter-spacing: -0.04em;
      }
      .address {
        display: grid;
        gap: 2px;
        margin-top: 8px;
      }
      .brand-copy p,
      .meta,
      .subtle {
        color: var(--muted);
      }
      .receipt-card {
        display: grid;
        gap: 6px;
        min-width: 220px;
        padding: 18px;
        border-radius: 16px;
        background: white;
        border: 1px solid var(--border);
      }
      .receipt-card span {
        color: var(--muted);
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }
      .receipt-card strong {
        color: var(--primary);
        font-size: 1.4rem;
      }
      .body {
        display: grid;
        gap: 22px;
        padding: 28px 32px 32px;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .meta-panel {
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        padding: 16px 18px;
      }
      .meta-panel h3 {
        font-size: 0.95rem;
        margin-bottom: 10px;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 5px 0;
        border-bottom: 1px dashed rgba(148, 163, 184, 0.36);
      }
      .meta-row:last-child { border-bottom: 0; }
      .meta-row span { color: var(--muted); }
      .meta-row strong { text-align: right; }
      .line-items {
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f4f8fb;
        color: var(--muted);
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      tbody tr:last-child td { border-bottom: 0; }
      .notes {
        display: grid;
        gap: 14px;
      }
      .note-box {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px 18px;
        background: #fff;
      }
      .note-box h3 {
        margin-bottom: 8px;
        font-size: 0.95rem;
      }
      .note-box p {
        color: var(--muted);
        line-height: 1.6;
        white-space: pre-wrap;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .meta-chip {
        min-width: 160px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 14px;
        background: #fff;
      }
      .meta-chip span {
        display: block;
        color: var(--muted);
        font-size: 0.78rem;
        margin-bottom: 6px;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-end;
      }
      .signature {
        min-width: 240px;
        text-align: right;
      }
      .signature-line {
        margin-top: 38px;
        border-top: 1px solid var(--secondary);
        padding-top: 8px;
        color: var(--muted);
      }
      @media print {
        html {
          background: white;
        }
        body {
          padding: 0;
          background: white;
        }
        .receipt {
          max-width: none;
          width: 100%;
          box-shadow: none;
          border-radius: 0;
          border: 0;
        }
      }
    </style>
  </head>
  <body>
    <article class="receipt">
      <header class="header">
        <div class="header-top">
          <div class="brand">
            ${
              receipt.template.showLogo && logoUrl
                ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(receipt.school.name)} logo" />`
                : ''
            }
            <div class="brand-copy">
              <p>${escapeHtml(receipt.receiptNo)}</p>
              <h1>${escapeHtml(receipt.school.name)}</h1>
              <p>${escapeHtml(receipt.template.receiptTitle)}</p>
              <p class="subtle">${escapeHtml(receipt.template.receiptSubtitle)}</p>
              <div class="subtle address">${address}</div>
            </div>
          </div>
          <div class="receipt-card">
            <span>Receipt Date</span>
            <strong>${escapeHtml(formatDate(receipt.receiptDate))}</strong>
            <p class="meta">Mode: ${escapeHtml(receipt.paymentMethod)}</p>
          </div>
        </div>
      </header>

      <section class="body">
        <div class="meta-grid">
          <section class="meta-panel">
            <h3>Student Details</h3>
            ${studentRows}
          </section>
          <section class="meta-panel">
            <h3>Payment Details</h3>
            ${paymentRows}
          </section>
        </div>

        ${
          customFields
            ? `<section class="chips">${customFields}</section>`
            : ''
        }

        <section class="line-items">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Assigned</th>
                <th>Concession</th>
                <th>Paid Before</th>
                <th>Paid Now</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>${escapeHtml(receipt.fee.name)}</strong>
                  <div class="subtle">${escapeHtml(receipt.fee.category)}</div>
                </td>
                <td>${escapeHtml(formatCurrency(receipt.fee.assignedAmount))}</td>
                <td>${escapeHtml(formatCurrency(receipt.fee.concessionAmount))}</td>
                <td>${escapeHtml(formatCurrency(receipt.fee.paidBeforeThisReceipt))}</td>
                <td>${escapeHtml(formatCurrency(receipt.amount))}</td>
                <td>${escapeHtml(formatCurrency(receipt.fee.dueAfterThisReceipt))}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="notes">
          ${noteBlocks}
        </section>

        <footer class="footer">
          <div class="subtle">
            <div>Generated by ${escapeHtml(receipt.school.name)}</div>
            <div>${escapeHtml(receipt.school.branding.supportEmail || receipt.school.contactEmail || '')}</div>
          </div>
          ${
            receipt.template.showSignature
              ? `<div class="signature">
                   <div class="signature-line">${escapeHtml(receipt.template.signatureLabel)}</div>
                 </div>`
              : ''
          }
        </footer>
      </section>
    </article>
  </body>
</html>`;
}

interface FeeReceiptPreviewOptions {
  template: FeeReceiptTemplateRecord;
  schoolSettings: SchoolSettingsRecord;
  branding: SchoolBrandingRecord;
}

export function buildFeeReceiptPreviewHtml({
  template,
  schoolSettings,
  branding,
}: FeeReceiptPreviewOptions) {
  const previewPayload: FeeReceiptPayload = {
    paymentId: 'preview-payment',
    receiptId: 'preview-receipt',
    receiptNo: 'RCPT-PREVIEW-001',
    receiptDate: new Date().toISOString(),
    amount: 4500,
    paymentMethod: 'CASH',
    reference: 'PREVIEW-REF-01',
    remarks: 'This is a live preview of the school receipt template.',
    downloadFileName: 'fee-receipt-preview.pdf',
    school: {
      id: schoolSettings.schoolId,
      schoolCode: schoolSettings.schoolCode,
      name: schoolSettings.name,
      contactEmail: schoolSettings.contactEmail,
      contactPhone: schoolSettings.contactPhone,
      address: {
        line1: schoolSettings.address.line1 ?? null,
        line2: schoolSettings.address.line2 ?? null,
        city: schoolSettings.address.city ?? null,
        state: schoolSettings.address.state ?? null,
        country: schoolSettings.address.country ?? null,
        postalCode: schoolSettings.address.postalCode ?? null,
      },
      branding: {
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        website: branding.website,
        supportEmail: branding.supportEmail,
      },
    },
    student: {
      id: 'preview-student',
      name: 'Aarav Sharma',
      studentCode: 'STU-PREVIEW-104',
      className: 'Class 8',
      classCode: 'CLS-08',
      sectionName: 'A',
    },
    fee: {
      id: 'preview-fee',
      name: 'Tuition Fee - April',
      feeCode: 'FEE-PREVIEW-04',
      category: 'TUITION',
      session: {
        id: 'preview-session',
        name: schoolSettings.academicSessionLabel || 'Academic Session 2026-27',
        isCurrent: true,
      },
      assignedAmount: 7500,
      concessionAmount: 500,
      netAmount: 7000,
      paidBeforeThisReceipt: 2500,
      paidAfterThisReceipt: 7000,
      dueAfterThisReceipt: 0,
    },
    receivedBy: {
      id: 'preview-cashier',
      name: schoolSettings.principalName || 'School Cashier',
    },
    template,
  };

  return buildFeeReceiptHtml(previewPayload);
}

export function downloadFeeReceipt(receipt: FeeReceiptPayload) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  frame.setAttribute('aria-hidden', 'true');

  const cleanup = () => {
    frame.remove();
  };

  frame.onload = () => {
    const printWindow = frame.contentWindow;

    if (!printWindow) {
      cleanup();
      return;
    }

    printWindow.addEventListener(
      'afterprint',
      () => {
        window.setTimeout(cleanup, 100);
      },
      { once: true },
    );

    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        cleanup();
      }
    }, 150);
  };

  document.body.append(frame);
  frame.srcdoc = buildFeeReceiptHtml(receipt);
}

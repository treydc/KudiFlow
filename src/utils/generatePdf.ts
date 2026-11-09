import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface BusinessProfile {
  name: string;
  email: string;
  address: string;
  logoUrl?: string;
  defaultCurrency?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}

export function cleanBrandName(val?: string): string {
  if (!val) return 'KudiFlow';
  const lowered = val.toLowerCase();
  if (
    lowered.includes('kudiflow') ||
    lowered.includes('codiflow') ||
    lowered.includes('technologies ltd') ||
    lowered.includes('solutions nigeria') ||
    lowered.includes('solutions')
  ) {
    return 'KudiFlow';
  }
  return val;
}

export function getStoredBusinessProfile(): BusinessProfile {
  const defaultProfile: BusinessProfile = {
    name: 'KudiFlow',
    email: 'billing@kudiflow.app',
    address: 'Plot 12, Commercial Corridor, Victoria Island, Lagos, Nigeria',
    logoUrl: '',
    defaultCurrency: 'NGN',
    bankName: 'Zenith Bank PLC',
    accountName: 'KudiFlow',
    accountNumber: '1018892341',
  };

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('kudiflow_business_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name) parsed.name = cleanBrandName(parsed.name);
        if (parsed.accountName) parsed.accountName = cleanBrandName(parsed.accountName);
        return { ...defaultProfile, ...parsed };
      } catch (e) {
        console.warn('Error reading saved business profile:', e);
      }
    }
  }

  return defaultProfile;
}

export function saveStoredBusinessProfile(profile: Partial<BusinessProfile>): void {
  if (typeof window !== 'undefined') {
    const current = getStoredBusinessProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem('kudiflow_business_profile', JSON.stringify(updated));
  }
}

export interface InvoicePdfData {
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  currency: string;
  amount: number;
  client_name: string;
  client_email?: string;
  client_address?: string | null;
  payment_link?: string | null;
  paid_at?: string | null;
  items?: {
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  business?: Partial<BusinessProfile>;
}

/**
 * Draws a pixel-perfect vector Nigerian Naira (₦) glyph.
 * Guarantees razor-sharp rendering on print and screen with zero font encoding bugs.
 */
function drawNairaSymbol(
  doc: jsPDF,
  x: number,
  y: number,
  fontSize: number,
  color: [number, number, number] = [15, 23, 42]
): number {
  const fontHeightMm = fontSize * 0.3528 * 0.72;
  const prevFont = doc.getFont();
  const prevSize = doc.getFontSize();
  const prevColor = doc.getTextColor();
  const prevLineWidth = doc.getLineWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(color[0], color[1], color[2]);

  const nWidth = doc.getTextWidth('N');
  doc.text('N', x, y);

  doc.setDrawColor(color[0], color[1], color[2]);
  const strokeW = Math.max(0.18, fontSize * 0.022);
  doc.setLineWidth(strokeW);
  const overhang = nWidth * 0.12;
  const x1 = x - overhang;
  const x2 = x + nWidth + overhang;
  const y1 = y - fontHeightMm * 0.58;
  const y2 = y - fontHeightMm * 0.40;

  doc.line(x1, y1, x2, y1);
  doc.line(x1, y2, x2, y2);

  doc.setFont(prevFont.fontName, prevFont.fontStyle);
  doc.setFontSize(prevSize);
  doc.setTextColor(prevColor);
  doc.setLineWidth(prevLineWidth);

  return nWidth;
}

/**
 * Draws a monetary amount using only the ₦ currency symbol with consistent tabular spacing.
 */
function drawNairaAmount(
  doc: jsPDF,
  amountNum: number,
  x: number,
  y: number,
  options: {
    fontSize?: number;
    fontStyle?: 'normal' | 'bold';
    align?: 'left' | 'right';
    color?: [number, number, number];
    symbolColor?: [number, number, number];
  } = {}
): number {
  const fontSize = options.fontSize || 10;
  const fontStyle = options.fontStyle || 'normal';
  const align = options.align || 'left';
  const color = options.color || [15, 23, 42];
  const symbolColor = options.symbolColor || color;

  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSize);

  const formattedNum = amountNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const nWidth = doc.getTextWidth('N');
  const spaceWidth = doc.getTextWidth(' ');
  const gap = spaceWidth * 0.45;
  const numWidth = doc.getTextWidth(formattedNum);
  const totalWidth = nWidth + gap + numWidth;

  let startX = x;
  if (align === 'right') {
    startX = x - totalWidth;
  }

  drawNairaSymbol(doc, startX, y, fontSize, symbolColor);

  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(formattedNum, startX + nWidth + gap, y);

  return totalWidth;
}

/**
 * Draws the status badge with the exact color requirements:
 * Draft: gray, Sent: blue, Paid: green, Overdue: red
 */
function drawStatusBadge(doc: jsPDF, status: string, rightX: number, y: number): number {
  const st = (status || 'DRAFT').toUpperCase();
  let fill: [number, number, number];
  let border: [number, number, number];
  let textColor: [number, number, number];
  let dotColor: [number, number, number];

  if (st === 'PAID') {
    // Paid green
    fill = [236, 253, 245]; // #ecfdf5
    border = [167, 243, 208]; // #a7f3d0
    textColor = [4, 120, 87]; // #047857 Dark green
    dotColor = [5, 150, 105]; // #059669
  } else if (st === 'SENT') {
    // Sent blue
    fill = [239, 246, 255]; // #eff6ff
    border = [191, 219, 254]; // #bfdbfe
    textColor = [29, 78, 216]; // #1d4ed8 Blue
    dotColor = [37, 99, 235]; // #2563eb
  } else if (st === 'OVERDUE') {
    // Overdue red
    fill = [254, 242, 242]; // #fef2f2
    border = [254, 202, 202]; // #fecaca
    textColor = [185, 28, 28]; // #b91c1c Red
    dotColor = [220, 38, 38]; // #dc2626
  } else {
    // Draft gray
    fill = [241, 245, 249]; // #f1f5f9
    border = [203, 213, 225]; // #cbd5e1 Gray
    textColor = [71, 85, 105]; // #475569
    dotColor = [100, 116, 139]; // #64748b
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const textWidth = doc.getTextWidth(st);
  const badgeWidth = textWidth + 9;
  const badgeHeight = 5.6;
  const badgeX = rightX - badgeWidth;

  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(badgeX, y, badgeWidth, badgeHeight, 1.4, 1.4, 'FD');

  // Status dot
  doc.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
  doc.circle(badgeX + 2.8, y + badgeHeight / 2, 0.75, 'F');

  // Status text
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(st, badgeX + 4.8, y + 3.9);

  return badgeWidth;
}

/**
 * Premium, clean, print-friendly invoice PDF generator.
 * White page, dark green accents, no gradients.
 */
export function generateInvoicePdf(data: InvoicePdfData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - 2 * margin; // 174mm
  const rightX = pageWidth - margin;

  const storedBiz = getStoredBusinessProfile();
  const businessName = cleanBrandName(data.business?.name || storedBiz.name);
  const businessEmail = data.business?.email || storedBiz.email || 'billing@kudiflow.app';
  const businessAddress = data.business?.address || storedBiz.address || 'Victoria Island, Lagos, Nigeria';
  const customLogo = data.business?.logoUrl || storedBiz.logoUrl;
  const bankName = data.business?.bankName || storedBiz.bankName || 'Zenith Bank PLC';
  const accountName = cleanBrandName(data.business?.accountName || storedBiz.accountName);
  const accountNumber = data.business?.accountNumber || storedBiz.accountNumber || '1018892341';
  const isPaid = (data.status || '').toLowerCase() === 'paid';

  // 1. Header (Logo & KudiFlow on the left, Status badge on the right)
  const headerY = 18;
  let logoDrawn = false;
  const logoSize = 13;
  const logoX = margin;

  if (customLogo && customLogo.startsWith('data:image/')) {
    try {
      const formatMatch = customLogo.match(/^data:image\/([a-zA-Z+]+);/);
      const imgFormat = (formatMatch?.[1]?.toUpperCase().replace('JPEG', 'JPG') || 'PNG') as any;
      doc.addImage(customLogo, imgFormat, logoX, headerY, logoSize, logoSize, undefined, 'FAST');
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    // Clean, crisp monogram mark with dark green accent
    doc.setFillColor(15, 23, 42); // #0f172a Obsidian
    doc.roundedRect(logoX, headerY, logoSize, logoSize, 2.5, 2.5, 'F');

    // Subtle dark green accent dot
    doc.setFillColor(4, 120, 87); // #047857 Dark green
    doc.circle(logoX + logoSize - 2.5, headerY + 2.5, 0.75, 'F');

    // Letter 'K'
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(4, 120, 87);
    doc.text('K', logoX + 3.6, headerY + 9.2);
  }

  // App Name: KudiFlow
  const brandTextX = logoX + logoSize + 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('KudiFlow', brandTextX, headerY + 8.8);

  // Status Badge on the right
  drawStatusBadge(doc, data.status, rightX, headerY + 4);

  // Subtle Header Divider Line
  const dividerY = 36;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, dividerY, rightX, dividerY);

  // 2. Below Header: Two Columns
  // Left Column: Invoice number, issue date and due date + From section (business name, address, email from Settings)
  // Right Column: Bill To (client name, email, address)
  const metaY = 44;
  const col2X = 114;

  // Left Column - Section 1: Invoice Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('INVOICE DETAILS', margin, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.invoice_number, margin, metaY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Issue Date:', margin, metaY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.issue_date, margin + 22, metaY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Due Date:', margin, metaY + 15.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87); // Dark green accent on due date
  doc.text(data.due_date, margin + 22, metaY + 15.5);

  // Left Column - Section 2: From (business name, address, email from Settings)
  const fromY = metaY + 23;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('FROM', margin, fromY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(businessName, margin, fromY + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  let fromCurrentY = fromY + 9.5;
  if (businessAddress) {
    const splitBizAddr = doc.splitTextToSize(businessAddress, 80);
    doc.text(splitBizAddr, margin, fromCurrentY);
    fromCurrentY += splitBizAddr.length * 3.6;
  }
  doc.setTextColor(100, 116, 139);
  doc.text(businessEmail, margin, fromCurrentY);
  fromCurrentY += 4;

  // Right Column: Bill To (client name, email, address)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('BILL TO', col2X, metaY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.client_name, col2X, metaY + 5.5);

  let billCurrentY = metaY + 10.5;
  if (data.client_email) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(data.client_email, col2X, billCurrentY);
    billCurrentY += 4.5;
  }

  if (data.client_address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const splitClientAddr = doc.splitTextToSize(data.client_address, 74);
    doc.text(splitClientAddr, col2X, billCurrentY);
    billCurrentY += splitClientAddr.length * 3.8;
  }

  const tableStartY = Math.max(fromCurrentY, billCurrentY) + 7;

  // 3. Line Items Table
  // Columns: #, Description, Qty, Unit Price, Amount
  // Fixed widths, light gray header row, thin row dividers, right-aligned number columns
  const items = data.items && data.items.length > 0
    ? data.items
    : [{ description: 'Professional Services', quantity: 1, unit_price: data.amount }];

  const tableBody = items.map((item, index) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unit_price) || 0;
    const total = qty * price;
    return [
      String(index + 1).padStart(2, '0'),
      item.description,
      qty.toString(),
      price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['#', 'Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableBody,
    theme: 'plain',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [248, 250, 252], // Light gray header row
      textColor: [71, 85, 105],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: { top: 3.8, bottom: 3.8, left: 3, right: 3 },
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8.5,
      cellPadding: { top: 4.2, bottom: 4.2, left: 3, right: 3 },
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', textColor: [148, 163, 184] },
      1: { cellWidth: 86, halign: 'left', textColor: [15, 23, 42] },
      2: { cellWidth: 18, halign: 'right', textColor: [71, 85, 105] },
      3: { cellWidth: 28, halign: 'right', textColor: [71, 85, 105] },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    didDrawCell: (hookData) => {
      // Thin row dividers
      if (hookData.section === 'body') {
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(
          hookData.cell.x,
          hookData.cell.y + hookData.cell.height,
          hookData.cell.x + hookData.cell.width,
          hookData.cell.y + hookData.cell.height
        );

        // Vector ₦ glyph drawn in front of Unit Price and Amount
        if (hookData.column.index === 3 || hookData.column.index === 4) {
          const cell = hookData.cell;
          const text = cell.text[0] || '';
          if (text) {
            doc.setFont('helvetica', hookData.column.index === 4 ? 'bold' : 'normal');
            doc.setFontSize(8.5);
            const numWidth = doc.getTextWidth(text);
            const cellRightX = cell.x + cell.width - cell.padding('right');
            const textStartXPos = cellRightX - numWidth;
            const nWidth = doc.getTextWidth('N');
            const spaceWidth = doc.getTextWidth(' ');
            const nX = textStartXPos - nWidth - (spaceWidth * 0.45);
            const textY = cell.y + cell.height / 2 + (8.5 * 0.3528 * 0.35);
            const color: [number, number, number] = hookData.column.index === 4 ? [15, 23, 42] : [71, 85, 105];
            drawNairaSymbol(doc, nX, textY, 8.5, color);
          }
        }
      }
    },
  });

  // Calculate table end position
  let finalY = (doc as any).lastAutoTable?.finalY || 130;

  // Multi-page protection: Ensure summary and payment instructions fit without overlap
  if (finalY + 54 > pageHeight - 20) {
    doc.addPage();
    finalY = 20;
  }

  // 4. Lower Section: Totals Box on Right, Payment Instructions / Paid Banner on Left
  const blockY = finalY + 8;

  // Helper to format payment date nicely
  const formatPaidDate = (paidAt?: string | null, fallbackDate?: string): string => {
    if (paidAt) {
      try {
        const d = new Date(paidAt);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }
        return paidAt;
      } catch {
        return paidAt;
      }
    }
    return fallbackDate || '';
  };

  // Left Side: Payment Instructions (if unpaid) OR Green Banner (if paid)
  const paymentWidth = 94;
  const paymentHeight = isPaid ? 38 : (data.payment_link ? 43 : 38);

  if (isPaid) {
    // Green Banner: "Payment received on [date]" with payment reference
    doc.setFillColor(236, 253, 245); // Soft green #ecfdf5
    doc.setDrawColor(167, 243, 208); // #a7f3d0
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, blockY, paymentWidth, paymentHeight, 2, 2, 'FD');

    // Dark green accent stripe on left edge
    doc.setFillColor(4, 120, 87); // #047857 Dark green
    doc.roundedRect(margin, blockY, 2.2, paymentHeight, 0.8, 0.8, 'F');

    // Checkmark circular badge
    doc.setFillColor(5, 150, 105);
    doc.circle(margin + 7.5, blockY + 9, 2.4, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.45);
    doc.line(margin + 6.3, blockY + 9, margin + 7.3, blockY + 10.1);
    doc.line(margin + 7.3, blockY + 10.1, margin + 8.8, blockY + 7.8);

    // Green banner title: "Payment received on [paid_at]"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(4, 120, 87);
    const paymentDate = formatPaidDate(data.paid_at, data.due_date || data.issue_date);
    doc.text(`Payment received on ${paymentDate}`, margin + 12.5, blockY + 9.8);

    // Payment Reference line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105);
    doc.text(`Payment Reference: ${data.invoice_number}`, margin + 6, blockY + 19);

    // Confirmation note
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('This invoice has been settled in full. Thank you for your payment.', margin + 6, blockY + 26);
  } else {
    // Unpaid: Payment Instructions from Settings (each field on its own line with no overlapping text)
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, blockY, paymentWidth, paymentHeight, 2, 2, 'FD');

    // Dark green accent stripe
    doc.setFillColor(4, 120, 87);
    doc.roundedRect(margin, blockY, 2.2, paymentHeight, 0.8, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('PAYMENT INSTRUCTIONS', margin + 6, blockY + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Please transfer to the following account or pay online:', margin + 6, blockY + 11);

    // Each field clearly on its own line with generous spacing
    const labelX = margin + 6;
    const valueX = margin + 32;

    // Line 1: Bank Name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Bank Name:', labelX, blockY + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(bankName, valueX, blockY + 17);

    // Line 2: Account Name
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Account Name:', labelX, blockY + 22.5);
    doc.setTextColor(30, 41, 59);
    doc.text(accountName, valueX, blockY + 22.5);

    // Line 3: Account Number
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Account Number:', labelX, blockY + 28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(accountNumber, valueX, blockY + 28);

    // Line 4: Payment Reference
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Payment Reference:', labelX, blockY + 33.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87); // Dark green reference
    doc.text(data.invoice_number, valueX, blockY + 33.5);

    // Line 5 (if payment_link exists): Pay online link
    if (data.payment_link) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Pay online:', labelX, blockY + 38.8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87); // #047857 Dark green
      const linkLabel = 'Pay online now';
      doc.textWithLink(linkLabel, valueX, blockY + 38.8, { url: data.payment_link });
      const linkW = doc.getTextWidth(linkLabel);
      doc.setDrawColor(4, 120, 87);
      doc.setLineWidth(0.2);
      doc.line(valueX, blockY + 39.5, valueX + linkW, blockY + 39.5);
    }
  }

  // Right Side: Totals Box with Subtotal and larger bold Total
  const summaryX = 120;
  const subtotal = data.amount;

  // Subtotal row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal', summaryX, blockY + 7);
  drawNairaAmount(doc, subtotal, rightX, blockY + 7, {
    align: 'right',
    fontSize: 8.5,
    color: [30, 41, 59],
  });

  // Thin divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(summaryX, blockY + 14, rightX, blockY + 14);

  // Larger Total with bold value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Total', summaryX, blockY + 24);

  drawNairaAmount(doc, data.amount, rightX, blockY + 24, {
    align: 'right',
    fontSize: 14, // Larger Total
    fontStyle: 'bold', // Total value in bold
    color: [15, 23, 42],
    symbolColor: [4, 120, 87], // Dark green accent on ₦ glyph
  });

  // 5. Footer with the business name, email and invoice number
  const totalPages = (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 14;

    // Thin understated divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, footerY - 4, rightX, footerY - 4);

    // Business name & email on left
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${businessName}  ·  ${businessEmail}`, margin, footerY);

    // Invoice number on right
    doc.text(`Invoice #${data.invoice_number}`, rightX, footerY, { align: 'right' });
  }

  // Save PDF file
  const fileName = `Invoice_${data.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(fileName);
}

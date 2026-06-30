// src/lib/invoicePdf.js
// Cadi — client-side PDF generator for invoice attachments.
//
// Builds a UK-compliant invoice PDF using jsPDF + autotable.
// Designed for attachment to the send-invoice email (returns base64).
//
// UK invoice requirements covered when fields are present:
//   - Unique invoice number, issue date, supply/tax point date
//   - Seller name + address + (for Ltd) registered number + registered office
//   - Buyer name + address
//   - Description, qty, unit price, line total per item
//   - Net total, VAT rate, VAT amount, gross total (when VAT registered)
//   - VAT registration number (when VAT registered)
//   - Payment terms + due date + bank details + payment reference
//   - Privacy / T&Cs links

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND = '#010a4f';
const MUTED = '#888888';
const LINE  = '#e6e6ec';

const fmt2 = (n) => `GBP ${(+n).toFixed(2)}`;
const fmtDate = (s) => {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0,2),16), parseInt(m.slice(2,4),16), parseInt(m.slice(4,6),16)];
}

function calcTotals(lines, vatRegistered) {
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0), 0);
  const vatAmount = vatRegistered ? subtotal * 0.20 : 0;
  const total = subtotal + vatAmount;
  return { subtotal, vatAmount, total };
}

/**
 * Generate an invoice PDF and return it as a base64 string (no data URI prefix).
 *
 * @param {object} invoice  — { num, date, dueDate, customer, lines, notes, bankName, sortCode, accountNum, terms }
 * @param {object} business — { name, address, email, phone, vatNumber, companyNum, entityType, registeredOffice, privacyUrl, termsUrl }
 * @param {object} accounts — { vatRegistered }
 * @returns {{ base64: string, filename: string }}
 */
export function generateInvoicePdf(invoice, business, accounts = {}) {
  const vatRegistered = !!accounts.vatRegistered;
  const { subtotal, vatAmount, total } = calcTotals(invoice.lines || [], vatRegistered);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40; // page margin

  const [br, bg, bb] = hexToRgb(BRAND);

  // ─── Brand bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pageW, 6, 'F');

  // ─── Header: business (left) + INVOICE block (right) ────────────────────────
  let y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(br, bg, bb);
  doc.text(business.name || 'Your business', M, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let yL = y + 14;
  if (business.address) {
    const addressLines = String(business.address).split(/\n|,\s*/).filter(Boolean);
    addressLines.forEach(line => { doc.text(line, M, yL); yL += 11; });
  }
  if (business.email) { doc.text(business.email, M, yL); yL += 11; }
  if (business.phone) { doc.text(business.phone, M, yL); yL += 11; }
  if (vatRegistered && business.vatNumber) {
    doc.text(`VAT registration: ${business.vatNumber}`, M, yL); yL += 11;
  }
  if (business.companyNum) {
    doc.text(`Company no.: ${business.companyNum}`, M, yL); yL += 11;
  }

  // INVOICE block (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(br, bg, bb);
  doc.text('INVOICE', pageW - M, y, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(invoice.num || '', pageW - M, y + 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const metaLines = [
    invoice.date ? ['Issue date', fmtDate(invoice.date)] : null,
    invoice.dueDate ? ['Due date', fmtDate(invoice.dueDate)] : null,
    invoice.terms != null ? ['Terms', typeof invoice.terms === 'number' ? (invoice.terms === 0 ? 'Due on receipt' : `Net ${invoice.terms}`) : String(invoice.terms)] : null,
  ].filter(Boolean);
  let ym = y + 30;
  metaLines.forEach(([label, val]) => {
    doc.setTextColor(120, 120, 120);
    doc.text(label, pageW - M - 110, ym, { align: 'left' });
    doc.setTextColor(40, 40, 40);
    doc.text(val, pageW - M, ym, { align: 'right' });
    ym += 12;
  });

  // ─── Bill to ────────────────────────────────────────────────────────────────
  y = Math.max(yL, ym) + 14;
  doc.setDrawColor(...hexToRgb(LINE));
  doc.line(M, y, pageW - M, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('BILL TO', M, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  y += 14;
  doc.text(invoice.customer?.name || '', M, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  if (invoice.customer?.address) {
    const cLines = String(invoice.customer.address).split(/\n|,\s*/).filter(Boolean);
    cLines.forEach(line => { y += 12; doc.text(line, M, y); });
  }
  if (invoice.customer?.email) { y += 12; doc.text(invoice.customer.email, M, y); }

  // ─── Line items ─────────────────────────────────────────────────────────────
  y += 24;
  const rows = (invoice.lines || [])
    .filter(l => l.desc && parseFloat(l.rate) > 0)
    .map(l => {
      const qty = parseFloat(l.qty) || 1;
      const rate = parseFloat(l.rate) || 0;
      const supplyDate = l.serviceDate ? fmtDate(l.serviceDate) : '';
      const desc = supplyDate ? `${l.desc}\nSupply date: ${supplyDate}` : l.desc;
      return [desc, String(qty), fmt2(rate), fmt2(qty * rate)];
    });

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit price', 'Amount']],
    body: rows,
    theme: 'plain',
    margin: { left: M, right: M },
    headStyles: {
      fillColor: [br, bg, bb],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: [40, 40, 40],
      cellPadding: { top: 8, right: 8, bottom: 8, left: 8 },
      lineColor: [230, 230, 236],
      lineWidth: { bottom: 0.5 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 80, halign: 'right' },
      3: { cellWidth: 80, halign: 'right', fontStyle: 'bold' },
    },
  });

  let afterTable = doc.lastAutoTable.finalY + 12;

  // ─── Totals (right-aligned block) ───────────────────────────────────────────
  const totalsX = pageW - M - 200;
  const totalsW = 200;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);

  if (vatRegistered) {
    doc.text('Net total', totalsX, afterTable);
    doc.setTextColor(40, 40, 40);
    doc.text(fmt2(subtotal), totalsX + totalsW, afterTable, { align: 'right' });
    afterTable += 14;

    doc.setTextColor(110, 110, 110);
    doc.text('VAT (20%)', totalsX, afterTable);
    doc.setTextColor(40, 40, 40);
    doc.text(fmt2(vatAmount), totalsX + totalsW, afterTable, { align: 'right' });
    afterTable += 14;
  }

  // Total bar
  afterTable += 4;
  doc.setFillColor(br, bg, bb);
  doc.rect(totalsX - 8, afterTable - 12, totalsW + 16, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Total due', totalsX, afterTable + 5);
  doc.setFontSize(13);
  doc.text(fmt2(total), totalsX + totalsW, afterTable + 5, { align: 'right' });
  afterTable += 32;

  // ─── Payment details ────────────────────────────────────────────────────────
  const bankName = invoice.bankName || business.bankName;
  const sortCode = invoice.sortCode || business.sortCode;
  const accountNum = invoice.accountNum || business.accountNum;

  if (bankName || sortCode || accountNum) {
    afterTable += 14;
    doc.setDrawColor(...hexToRgb(LINE));
    doc.setFillColor(248, 249, 252);
    doc.rect(M, afterTable, pageW - 2 * M, 70, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('PAYMENT DETAILS', M + 12, afterTable + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);

    let py = afterTable + 32;
    const payRows = [
      bankName   ? ['Bank',      bankName]   : null,
      sortCode   ? ['Sort code', sortCode]   : null,
      accountNum ? ['Account',   accountNum] : null,
      ['Reference', invoice.num || ''],
    ].filter(Boolean);

    payRows.forEach(([label, val]) => {
      doc.setTextColor(120, 120, 120);
      doc.text(label, M + 12, py);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text(String(val), M + 80, py);
      doc.setFont('helvetica', 'normal');
      py += 11;
    });

    afterTable += 80;
  }

  // ─── Notes ──────────────────────────────────────────────────────────────────
  if (invoice.notes) {
    afterTable += 14;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    const wrapped = doc.splitTextToSize(invoice.notes, pageW - 2 * M);
    doc.text(wrapped, M, afterTable);
    afterTable += wrapped.length * 11;
  }

  // ─── Footer (legal + links) ─────────────────────────────────────────────────
  // Pinned to bottom of the page.
  const footerY = pageH - 50;
  doc.setDrawColor(...hexToRgb(LINE));
  doc.line(M, footerY - 6, pageW - M, footerY - 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);

  const legalBits = [];
  if (business.entityType === 'limited_company') {
    legalBits.push(`${business.name} — registered in England & Wales`);
    if (business.companyNum) legalBits.push(`Company no. ${business.companyNum}`);
    if (business.registeredOffice) legalBits.push(`Registered office: ${business.registeredOffice}`);
  } else if (business.name) {
    legalBits.push(business.name);
    if (business.address) legalBits.push(business.address.replace(/\n/g, ', '));
  }
  if (vatRegistered && business.vatNumber) {
    legalBits.push(`VAT no. ${business.vatNumber}`);
  }

  const legalLine = legalBits.join(' · ');
  const wrappedLegal = doc.splitTextToSize(legalLine, pageW - 2 * M);
  doc.text(wrappedLegal, pageW / 2, footerY, { align: 'center' });

  // Privacy / T&Cs links
  const linkY = footerY + wrappedLegal.length * 9 + 4;
  // Default to the marketing-site .html paths — cadi.cleaning is the static
  // marketing host (privacy.html / terms.html), not the React app. The bare
  // /privacy and /terms URLs only resolve on app.cadi.cleaning, where the
  // recipient (the cleaner's customer) won't have an account.
  const privacyUrl = business.privacyUrl || 'https://cadi.cleaning/privacy.html';
  const termsUrl   = business.termsUrl   || 'https://cadi.cleaning/terms.html';

  doc.setTextColor(br, bg, bb);
  const linkText = `Privacy Policy   ·   Terms & Conditions`;
  doc.text(linkText, pageW / 2, linkY, { align: 'center' });
  // Approximate clickable rectangles for the two link strings.
  // jsPDF measures in pt; using textWidth helps position links accurately.
  const half = doc.getTextWidth('Privacy Policy   ·   ') / 2;
  const ppW  = doc.getTextWidth('Privacy Policy');
  const tcW  = doc.getTextWidth('Terms & Conditions');
  const centerX = pageW / 2;
  doc.link(centerX - half - ppW / 2, linkY - 8, ppW, 10, { url: privacyUrl });
  doc.link(centerX + half - tcW / 2, linkY - 8, tcW, 10, { url: termsUrl });

  // ─── Output ─────────────────────────────────────────────────────────────────
  // datauristring → 'data:application/pdf;filename=...;base64,JVBE...'
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1] || '';

  const safeNum = String(invoice.num || 'invoice').replace(/[^A-Za-z0-9_\-]/g, '_');
  return { base64, filename: `${safeNum}.pdf` };
}

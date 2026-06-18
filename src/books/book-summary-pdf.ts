import PDFDocument from 'pdfkit';

const PAGE = {
  width: 595.28,
  height: 841.89,
};

const COLORS = {
  background: '#0f1014',
  title: '#f5f0e8',
  accent: '#c9a962',
  muted: '#9a958c',
  body: '#d8d2c8',
  divider: '#2a2b32',
};

export interface BookSummaryPdfInput {
  bookTitle: string;
  writerName: string;
  summary: string;
}

export function buildSummaryPdfFilename(username: string, bookTitle: string): string {
  const sanitize = (value: string) =>
    value
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'item';

  return `${sanitize(username)}-${sanitize(bookTitle)}-summary.pdf`;
}

export function generateBookSummaryPdf(input: BookSummaryPdfInput): Promise<Buffer> {
  const { bookTitle, writerName, summary } = input;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 52, right: 52 },
      info: {
        Title: `${bookTitle} — Reading Summary`,
        Author: writerName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const footerText = 'Generated from your reading reflections in Elevate.';
    const drawFooter = () => {
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(footerText, 52, PAGE.height - 48, {
          width: PAGE.width - 104,
          align: 'center',
          lineBreak: false,
        });
    };

    doc.on('pageAdded', () => {
      doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.background);
    });

    doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.background);

    const contentWidth = PAGE.width - 104;
    let y = 72;

    doc
      .fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('ELEVATE', 52, y, { characterSpacing: 2 });

    y += 36;

    doc
      .fillColor(COLORS.title)
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(bookTitle, 52, y, { width: contentWidth, lineGap: 4 });

    y = doc.y + 18;

    doc
      .moveTo(52, y)
      .lineTo(52 + 72, y)
      .strokeColor(COLORS.accent)
      .lineWidth(2)
      .stroke();

    y += 22;

    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(11)
      .text('Personal reading summary', 52, y);

    y += 22;

    doc
      .fillColor(COLORS.title)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(`Written by ${writerName}`, 52, y);

    y += 32;

    doc
      .moveTo(52, y)
      .lineTo(PAGE.width - 52, y)
      .strokeColor(COLORS.divider)
      .lineWidth(1)
      .stroke();

    y += 28;

    doc
      .fillColor(COLORS.body)
      .font('Helvetica')
      .fontSize(12)
      .text(summary.trim(), 52, y, {
        width: contentWidth,
        align: 'left',
        lineGap: 7,
      });

    drawFooter();

    doc.end();
  });
}

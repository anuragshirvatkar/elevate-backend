import PDFDocument from 'pdfkit';

const PAGE = {
  width: 595.28,
  height: 841.89,
};

const MARGIN = { top: 56, bottom: 64, left: 52, right: 52 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const MAX_Y = PAGE.height - MARGIN.bottom;

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

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string };

/**
 * Turns the AI/markdown summary into clean, styled blocks. We strip markdown
 * markers (###, **, *, -) so they never render literally in the PDF, and treat
 * lines that look like headings (markdown # or short "Title:"-style lines) as
 * section headings.
 */
function parseSummaryBlocks(summary: string): Block[] {
  const blocks: Block[] = [];
  const stripInline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/[*_`]/g, '')
      .trim();

  const rawBlocks = summary
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const raw of rawBlocks) {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
      if (headingMatch) {
        blocks.push({ kind: 'heading', text: stripInline(headingMatch[1]) });
        continue;
      }
      // A standalone short bold line is also treated as a heading.
      const boldOnly = line.match(/^\*\*(.+?)\*\*:?\s*$/);
      if (boldOnly) {
        blocks.push({ kind: 'heading', text: stripInline(boldOnly[1]) });
        continue;
      }
      blocks.push({ kind: 'paragraph', text: stripInline(line) });
    }
  }

  return blocks;
}

export function generateBookSummaryPdf(input: BookSummaryPdfInput): Promise<Buffer> {
  const { bookTitle, writerName, summary } = input;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: MARGIN,
      bufferPages: true,
      info: {
        Title: `${bookTitle} — Reading Summary`,
        Author: writerName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const paintBackground = () => {
      doc.save();
      doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.background);
      doc.restore();
    };

    doc.on('pageAdded', paintBackground);
    paintBackground();

    // ── Header ──
    let y = MARGIN.top + 16;

    doc
      .fillColor(COLORS.accent)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('ELEVATE', MARGIN.left, y, { characterSpacing: 2 });

    y += 34;

    doc
      .fillColor(COLORS.title)
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(bookTitle, MARGIN.left, y, { width: CONTENT_WIDTH, lineGap: 4 });

    y = doc.y + 16;

    doc
      .moveTo(MARGIN.left, y)
      .lineTo(MARGIN.left + 72, y)
      .strokeColor(COLORS.accent)
      .lineWidth(2)
      .stroke();

    y += 20;

    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(11)
      .text('Personal reading summary', MARGIN.left, y);

    y = doc.y + 6;

    doc
      .fillColor(COLORS.title)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(`Written by ${writerName}`, MARGIN.left, y);

    y = doc.y + 18;

    doc
      .moveTo(MARGIN.left, y)
      .lineTo(PAGE.width - MARGIN.right, y)
      .strokeColor(COLORS.divider)
      .lineWidth(1)
      .stroke();

    y += 26;
    doc.y = y;

    // ── Body ──
    const blocks = parseSummaryBlocks(summary);

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > MAX_Y) {
        doc.addPage();
        doc.y = MARGIN.top;
      }
    };

    blocks.forEach((block, idx) => {
      if (block.kind === 'heading') {
        // Keep a heading from being orphaned at the very bottom of a page.
        ensureSpace(60);
        if (idx > 0) doc.y += 8;
        doc
          .fillColor(COLORS.accent)
          .font('Helvetica-Bold')
          .fontSize(15)
          .text(block.text, MARGIN.left, doc.y, { width: CONTENT_WIDTH, lineGap: 2 });
        doc.y += 8;
      } else {
        ensureSpace(28);
        doc
          .fillColor(COLORS.body)
          .font('Helvetica')
          .fontSize(12)
          .text(block.text, MARGIN.left, doc.y, {
            width: CONTENT_WIDTH,
            align: 'left',
            lineGap: 6,
          });
        doc.y += 10;
      }
    });

    // ── Footer on every page (drawn after layout so it never adds pages) ──
    const footerText = 'Generated from your reading reflections in Elevate.';
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Temporarily drop the bottom margin so writing into the footer zone does
      // not make PDFKit auto-insert a blank page.
      const prevBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(footerText, MARGIN.left, PAGE.height - 40, {
          width: CONTENT_WIDTH,
          align: 'center',
          lineBreak: false,
        });
      doc.page.margins.bottom = prevBottom;
    }

    doc.flushPages();
    doc.end();
  });
}

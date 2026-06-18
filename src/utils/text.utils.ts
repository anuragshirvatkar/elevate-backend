const DEFAULT_MAX_CHARS_PER_LINE = 72;

export function truncateToThreeLines(
  text: string,
  maxCharsPerLine = DEFAULT_MAX_CHARS_PER_LINE,
): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const rawLines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);

  let lines: string[];
  if (rawLines.length > 1) {
    lines = rawLines;
  } else {
    lines = wrapText(rawLines[0], maxCharsPerLine);
  }

  if (lines.length <= 3) {
    return lines.join('\n');
  }

  const truncated = lines.slice(0, 3);
  const lastIndex = truncated.length - 1;
  truncated[lastIndex] = appendEllipsis(truncated[lastIndex], maxCharsPerLine);
  return truncated.join('\n');
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine - 3) + '...' : word;
  }

  if (current) lines.push(current);
  return lines;
}

function appendEllipsis(line: string, maxCharsPerLine: number): string {
  if (line.endsWith('...')) return line;
  if (line.length <= maxCharsPerLine - 3) return `${line}...`;
  return `${line.slice(0, maxCharsPerLine - 3)}...`;
}

export function secondsUntilEndOfLocalDay(timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? 0);
  const elapsed = hour * 3600 + minute * 60 + second;

  return Math.max(60, 86400 - elapsed);
}

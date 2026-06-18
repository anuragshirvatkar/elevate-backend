export interface PurityRelapseRecord {
  description: string | null;
}

const MIN_RELAPSE_RECORDS = 3;

export function buildPurityInsightNote(records: PurityRelapseRecord[]): string | null {
  if (records.length < MIN_RELAPSE_RECORDS) {
    return null;
  }

  const reasons = getTopReasons(records, 3);
  if (reasons.length === 0) {
    return null;
  }

  return `Your common reasons are ${formatReasons(reasons)}.`;
}

export function expandPurityRelapseRecords(
  rows: Array<{
    relapse_count: number | null;
    description: string | null;
    reason_if_no: string | null;
  }>,
): PurityRelapseRecord[] {
  const records: PurityRelapseRecord[] = [];

  for (const row of rows) {
    const count = row.relapse_count ?? 0;
    if (count <= 0) continue;

    const reason = row.description?.trim() || row.reason_if_no?.trim() || null;
    for (let i = 0; i < count; i++) {
      records.push({ description: reason });
    }
  }

  return records;
}

function getTopReasons(records: PurityRelapseRecord[], limit: number): string[] {
  const frequency = new Map<string, { count: number; display: string }>();

  for (const record of records) {
    if (!record.description) continue;

    const display = record.description.trim();
    if (!display) continue;

    const key = display.toLowerCase();
    const existing = frequency.get(key);
    if (existing) {
      existing.count++;
    } else {
      frequency.set(key, { count: 1, display });
    }
  }

  return [...frequency.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.display);
}

function formatReasons(reasons: string[]): string {
  const quoted = reasons.map((reason) => `"${reason}"`);

  if (quoted.length === 1) {
    return quoted[0];
  }

  if (quoted.length === 2) {
    return `${quoted[0]} and ${quoted[1]}`;
  }

  return `${quoted.slice(0, -1).join(', ')}, and ${quoted[quoted.length - 1]}`;
}

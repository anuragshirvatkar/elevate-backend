const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// ─── Generic timezone-aware helpers ──────────────────────────────────────────

export function getLocalDateString(timezone: string): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: timezone });
}

export function getLocalToday(timezone: string): Date {
  return new Date(`${getLocalDateString(timezone)}T00:00:00.000Z`);
}

export function getLocalWeekMonday(timezone: string): Date {
  const today = getLocalToday(timezone);
  const day = today.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + offset);
  return monday;
}

export function getLocalMinuteOfDay(timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ─── IST convenience wrappers (kept for backward compat) ─────────────────────

/**
 * Returns the current IST date as a YYYY-MM-DD string.
 * Uses the Intl API — works correctly on any server timezone.
 */
export function getIstDateString(): string {
  return getLocalDateString('Asia/Kolkata');
}

/**
 * Returns UTC midnight for the current IST calendar day.
 *
 * Activities are stored at UTC midnight keyed to the user's local IST date
 * (the frontend sends YYYY-MM-DD, so new Date("2026-06-05") = June 5 00:00 UTC).
 * This is the correct "start of today" boundary for IST-based range queries.
 */
export function getIstToday(): Date {
  return getLocalToday('Asia/Kolkata');
}

/**
 * Returns UTC midnight for the most recent Monday in the IST calendar.
 */
export function getIstWeekMonday(): Date {
  return getLocalWeekMonday('Asia/Kolkata');
}

/**
 * Returns the current IST minute-of-day (0–1439).
 * Does NOT depend on process.env.TZ — safe on any server timezone.
 *
 * At 08:30 IST → 510. At 00:00 IST → 0. At 23:30 IST → 1410.
 */
export function getIstMinuteOfDay(): number {
  return Math.floor(((Date.now() + IST_OFFSET_MS) % 86_400_000) / 60_000);
}

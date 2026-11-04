// Turkey has been on fixed UTC+3 since 2016.
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Rows without a published window (backfilled history) fall back to the
// classic morning handover.
const FALLBACK_HANDOVER_HOUR = 8;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date in Turkey, `YYYY-MM-DD`. */
export function turkeyDate(now: Date): string {
    return new Date(now.getTime() + TURKEY_OFFSET_MS)
        .toISOString()
        .slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
    return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS)
        .toISOString()
        .slice(0, 10);
}

/** The fallback handover instant (08:00 Turkey time) on a date. */
export function fallbackHandover(isoDate: string): Date {
    return new Date(
        Date.parse(`${isoDate}T00:00:00Z`) +
            FALLBACK_HANDOVER_HOUR * 60 * 60 * 1000 -
            TURKEY_OFFSET_MS
    );
}

export function isIsoDate(value: string): boolean {
    if (!ISO_DATE.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

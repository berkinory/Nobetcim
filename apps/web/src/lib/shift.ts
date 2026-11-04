import type { DutyPharmacy } from '@nobetcim/contract';
import { useEffect, useState } from 'react';

export type ShiftState = 'open' | 'upcoming' | 'ended' | 'unknown';

/** Where a pharmacy's published shift stands at `nowMs`. */
export function shiftState(pharmacy: DutyPharmacy, nowMs: number): ShiftState {
    if (!pharmacy.startsAt || !pharmacy.endsAt) return 'unknown';
    if (nowMs < Date.parse(pharmacy.startsAt)) return 'upcoming';
    if (nowMs < Date.parse(pharmacy.endsAt)) return 'open';
    return 'ended';
}

/**
 * Sort rank without a location: on duty now first. 'unknown' is older data
 * without a published window, which was always shown as on duty.
 */
export const SHIFT_RANK: Record<ShiftState, number> = {
    open: 0,
    unknown: 0,
    upcoming: 1,
    ended: 2,
};

/**
 * With a location, a pharmacy that has not opened yet counts as this much
 * farther away: an open one wins unless it is a lot farther.
 */
export const UPCOMING_PENALTY_KM = 10;

const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
});
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
});

const time = (iso: string) => timeFormatter.format(new Date(iso));
const day = (ms: number) => dayFormatter.format(new Date(ms));

/**
 * Short status line, e.g. "Şu an açık · bitiş 09:00". Phrased without case
 * suffixes, which in Turkish depend on how the time is read aloud.
 */
export function shiftLabel(
    pharmacy: DutyPharmacy,
    state: ShiftState,
    nowMs: number
): string | null {
    if (!pharmacy.startsAt || !pharmacy.endsAt) return null;
    if (state === 'open') return `Şu an açık · bitiş ${time(pharmacy.endsAt)}`;
    if (state === 'upcoming') {
        const tomorrow = day(Date.parse(pharmacy.startsAt)) !== day(nowMs);
        return `${tomorrow ? 'Yarın başlangıç' : 'Başlangıç'} ${time(pharmacy.startsAt)}`;
    }
    if (state === 'ended') return `Nöbet bitti · ${time(pharmacy.endsAt)}`;
    return null;
}

/** "19:00 – 09:00" plus whether the shift runs past midnight. */
export function shiftWindow(pharmacy: DutyPharmacy): string | null {
    if (!pharmacy.startsAt || !pharmacy.endsAt) return null;
    const overnight =
        day(Date.parse(pharmacy.startsAt)) !== day(Date.parse(pharmacy.endsAt));
    return `${time(pharmacy.startsAt)} – ${time(pharmacy.endsAt)}${overnight ? ' (ertesi gün)' : ''}`;
}

/**
 * Current time, ticking every minute and when the tab becomes visible again,
 * so ended shifts drop off without a reload.
 */
export function useNow(intervalMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const tick = () => setNow(Date.now());
        const id = window.setInterval(tick, intervalMs);
        const onVisible = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [intervalMs]);
    return now;
}

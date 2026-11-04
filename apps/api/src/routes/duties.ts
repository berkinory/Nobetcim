import type {
    ApiError,
    DutiesResponse,
    DutyDateSummary,
    DutyPharmacy,
} from '@nobetcim/contract';
import { and, asc, count, desc, eq, isNull, ne, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { etag } from 'hono/etag';

import { db } from '../db/client';
import { city, cityScrape, duty, pharmacy } from '../db/schema';
import {
    addDays,
    fallbackHandover,
    isIsoDate,
    turkeyDate,
} from '../lib/duty-date';
import { TtlCache } from '../lib/ttl-cache';

interface DateList {
    pharmacies: DutyPharmacy[];
    missingCities: string[];
}

const listCache = new TtlCache<DateList>(60_000);
const datesCache = new TtlCache<DutyDateSummary[]>(60_000);

// Today's shifts are listed as "upcoming" once they are this close, so the
// evening list shows up during the day but not at 3 a.m.
const UPCOMING_HORIZON_MS = 12 * 60 * 60 * 1000;

// Five decimals is ~1 m: plenty for a map pin, and it trims the payload that
// every visitor downloads by a third.
function roundCoordinate(value: number | null): number | null {
    return value === null ? null : Math.round(value * 1e5) / 1e5;
}

/** "2026-11-04T15:00Z": still valid ISO 8601, minus the noise. */
function compactIso(value: Date | null): string | null {
    return value ? value.toISOString().replace(':00.000Z', 'Z') : null;
}

async function loadDateList(date: string): Promise<DateList> {
    const [rows, missing] = await Promise.all([
        db
            .select({
                id: pharmacy.id,
                name: pharmacy.name,
                district: pharmacy.district,
                city: city.name,
                address: pharmacy.address,
                phone: pharmacy.phone,
                lat: pharmacy.lat,
                lng: pharmacy.lng,
                startsAt: duty.startsAt,
                endsAt: duty.endsAt,
            })
            .from(duty)
            .innerJoin(pharmacy, eq(pharmacy.id, duty.pharmacyId))
            .innerJoin(city, eq(city.plateCode, pharmacy.plateCode))
            .where(eq(duty.dutyDate, date))
            .orderBy(asc(pharmacy.plateCode), asc(pharmacy.district)),
        db
            .select({ name: city.name })
            .from(city)
            .leftJoin(
                cityScrape,
                and(
                    eq(cityScrape.plateCode, city.plateCode),
                    eq(cityScrape.dutyDate, date)
                )
            )
            // Missing unless the latest scrape returned rows; never-scraped
            // cities have no city_scrape row at all.
            .where(or(isNull(cityScrape.status), ne(cityScrape.status, 'ok'))),
    ]);

    return {
        pharmacies: rows.map((row) => ({
            ...row,
            lat: roundCoordinate(row.lat),
            lng: roundCoordinate(row.lng),
            startsAt: compactIso(row.startsAt),
            endsAt: compactIso(row.endsAt),
        })),
        missingCities: missing
            .map((row) => row.name)
            .toSorted((a, b) => a.localeCompare(b, 'tr')),
    };
}

const getDateList = (date: string) =>
    listCache.getOrLoad(date, () => loadDateList(date));

/**
 * Pharmacies on duty now or starting soon, by each one's published shift:
 * last night's shifts that have not ended yet (handover runs from 08:00 to
 * 09:00 depending on the pharmacy) plus today's that start within the horizon.
 */
async function loadActive(now: Date): Promise<DutiesResponse> {
    const today = turkeyDate(now);
    const yesterday = addDays(today, -1);
    const [previous, current] = await Promise.all([
        getDateList(yesterday),
        getDateList(today),
    ]);
    const nowMs = now.getTime();
    const todayFallbackStart = fallbackHandover(today).getTime();

    const stillRunning = previous.pharmacies.filter((p) =>
        p.endsAt ? Date.parse(p.endsAt) > nowMs : nowMs < todayFallbackStart
    );
    const startingSoon = current.pharmacies.filter((p) =>
        p.startsAt && p.endsAt
            ? Date.parse(p.startsAt) - nowMs <= UPCOMING_HORIZON_MS &&
              Date.parse(p.endsAt) > nowMs
            : nowMs >= todayFallbackStart
    );

    // A pharmacy on duty two nights running appears in both lists; keep the
    // shift that is running now.
    const byId = new Map(stillRunning.map((p) => [p.id, p]));
    for (const p of startingSoon) {
        if (!byId.has(p.id)) byId.set(p.id, p);
    }

    const primaryIsToday = startingSoon.length > 0;
    return {
        date: primaryIsToday ? today : yesterday,
        pharmacies: [...byId.values()],
        missingCities: (primaryIsToday ? current : previous).missingCities,
        generatedAt: now.toISOString(),
    };
}

export const dutyRoutes = new Hono()
    .use(etag())
    .get('/duties', async (c) => {
        const requested = c.req.query('date');
        if (requested !== undefined && !isIsoDate(requested)) {
            return c.json<ApiError>({ error: 'date must be YYYY-MM-DD' }, 400);
        }

        // Minute resolution keeps the body (and its ETag) stable per minute.
        const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);
        if (requested === undefined) {
            c.header(
                'Cache-Control',
                'public, max-age=60, stale-while-revalidate=300'
            );
            return c.json(await loadActive(now));
        }

        const list = await getDateList(requested);
        // Past lists never change; current and future ones are re-scraped.
        c.header(
            'Cache-Control',
            requested < addDays(turkeyDate(now), -1)
                ? 'public, max-age=86400, immutable'
                : 'public, max-age=60, stale-while-revalidate=600'
        );
        return c.json({
            date: requested,
            ...list,
            generatedAt: now.toISOString(),
        } satisfies DutiesResponse);
    })
    .get('/dates', async (c) => {
        const dates = await datesCache.getOrLoad('recent', () =>
            db
                .select({ date: duty.dutyDate, pharmacyCount: count() })
                .from(duty)
                .groupBy(duty.dutyDate)
                .orderBy(desc(duty.dutyDate))
                .limit(90)
        );
        c.header('Cache-Control', 'public, max-age=300');
        return c.json(dates);
    });

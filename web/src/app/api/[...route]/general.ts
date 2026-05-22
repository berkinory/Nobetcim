import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { db } from '@/db';
import { pharmacies } from '@/db/schema';

import { createResponse } from './utils';

export const generalRoutes = new Hono();

interface PharmacyData {
    city: string;
    district: string;
    name: string;
    phone: string;
    address: string;
    lat: number;
    long: number;
}

generalRoutes.get('/pharmacy', async () => {
    try {
        const dateKey = getCurrentActiveDate();
        const pharmacyData = await getPharmacyData(dateKey);

        if (!pharmacyData.length) {
            return createResponse(
                false,
                `No pharmacy data found for ${dateKey}`
            );
        }

        const response = createResponse(true, pharmacyData);

        response.headers.set(
            'Cache-Control',
            'public, s-maxage=3600, stale-while-revalidate=3600'
        );

        return response;
    } catch (error) {
        console.error('Pharmacy API error:', error);
        return createResponse(
            false,
            'Internal server error',
            'Failed to fetch pharmacy data'
        );
    }
});

function getCurrentActiveDate(): string {
    const now = new Date();

    const utcPlus3 = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const today = new Date(
        utcPlus3.getFullYear(),
        utcPlus3.getMonth(),
        utcPlus3.getDate()
    );

    const cutoffTime = new Date(today);
    cutoffTime.setHours(8, 30, 0, 0);

    const targetDate =
        utcPlus3 < cutoffTime
            ? new Date(today.getTime() - 24 * 60 * 60 * 1000)
            : today;

    const day = targetDate.getDate().toString().padStart(2, '0');
    const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const year = targetDate.getFullYear();

    return `${day}/${month}/${year}`;
}

function parseDisplayDate(dateKey: string): string {
    const [day, month, year] = dateKey.split('/');
    return `${year}-${month}-${day}`;
}

async function getPharmacyData(dateKey: string): Promise<PharmacyData[]> {
    const dutyDate = parseDisplayDate(dateKey);

    const rows = await db
        .select({
            city: pharmacies.city,
            district: pharmacies.district,
            name: pharmacies.name,
            phone: pharmacies.phone,
            address: pharmacies.address,
            lat: pharmacies.lat,
            long: pharmacies.long,
        })
        .from(pharmacies)
        .where(eq(pharmacies.dutyDate, dutyDate));

    return rows.map((row) => ({
        city: row.city,
        district: row.district,
        name: row.name,
        phone: row.phone,
        address: row.address,
        lat: row.lat ?? 0,
        long: row.long ?? 0,
    }));
}

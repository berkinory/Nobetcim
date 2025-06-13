import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { Redis } from '@upstash/redis';
import { createResponse } from './utils';

export const generalRoutes = new Hono();

generalRoutes.use(compress());

interface PharmacyData {
    city: string;
    district: string;
    name: string;
    phone: string;
    address: string;
    lat: number;
    long: number;
}

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

generalRoutes.get('/pharmacy', async (c) => {
    try {
        const requestedDate = c.req.query('date');

        const dateKey = requestedDate || getCurrentActiveDate();

        if (!isValidDateFormat(dateKey)) {
            return createResponse(false, 'Invalid date format.');
        }

        const pharmacyData = await getPharmacyData(dateKey);

        if (!pharmacyData) {
            return createResponse(
                false,
                `No pharmacy data found for ${dateKey}`
            );
        }

        const response = createResponse(true, pharmacyData);

        response.headers.set(
            'Cache-Control',
            'public, s-maxage=7200, stale-while-revalidate=7200'
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

function isValidDateFormat(dateStr: string): boolean {
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateStr)) return false;

    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

async function getPharmacyData(
    dateKey: string
): Promise<PharmacyData[] | null> {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        throw new Error(
            'Missing Redis environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required'
        );
    }

    try {
        const data = await redis.get<PharmacyData[]>(dateKey);
        return data || null;
    } catch (error) {
        console.error('Redis error:', error);
        throw new Error('Failed to fetch data from Redis');
    }
}

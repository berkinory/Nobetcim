import { Hono } from 'hono';
import { Redis } from '@upstash/redis';
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

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

generalRoutes.get('/pharmacy', async () => {
    try {
        const dateKey = getCurrentActiveDate();

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

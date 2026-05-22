export const MAP_CONFIG = {
    ZOOM: {
        MIN: 8,
        MAX: 17,
        INITIAL: 12,
        TARGET: 14,
        DEFAULT: 12,
    },

    ANIMATION: {
        INITIAL_ZOOM_DELAY: 300,
        ZOOM_DURATION: 1500,
        FLY_DURATION: 1500,
        ZOOM_CONTROL_DURATION: 300,
    },

    LOCATION: {
        UPDATE_THROTTLE_MS: 3000,
        CHANGE_THRESHOLD_METERS: 10,
        BOUNDS_UPDATE_METERS: 2000,
        MAX_CLOSEST_PHARMACIES: 100,
        DISTANCE_WARNING_KM: 40,
        BUFFER_KM: 75,
        DEFAULT_FALLBACK: { latitude: 39.9334, longitude: 32.8597 },
    },

    GEOLOCATION_OPTIONS: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
    },
} as const;

export interface PharmacyData {
    city: string;
    district: string;
    name: string;
    phone: string;
    address: string;
    lat: number;
    long: number;
}

export interface PharmacyWithDistance {
    pharmacy: PharmacyData;
    distance: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

export function calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

export function hasMovedMeters(
    oldLocation: { latitude: number; longitude: number } | null,
    newLocation: { latitude: number; longitude: number },
    thresholdMeters: number
): boolean {
    if (!oldLocation) return true;

    const latDiff =
        (newLocation.latitude - oldLocation.latitude) * 111_320;
    const lonDiff =
        (newLocation.longitude - oldLocation.longitude) *
        111_320 *
        Math.cos(toRadians((oldLocation.latitude + newLocation.latitude) / 2));

    return Math.hypot(latDiff, lonDiff) > thresholdMeters;
}

export function findClosestPharmacies(
    pharmacies: PharmacyData[],
    userLocation: { latitude: number; longitude: number },
    limit: number
): PharmacyWithDistance[] {
    const closest: PharmacyWithDistance[] = [];

    for (const pharmacy of pharmacies) {
        const distance = calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            pharmacy.lat,
            pharmacy.long
        );

        if (closest.length < limit) {
            closest.push({ pharmacy, distance });
            if (closest.length === limit) {
                closest.sort((a, b) => b.distance - a.distance);
            }
            continue;
        }

        if (distance < closest[0].distance) {
            closest[0] = { pharmacy, distance };
            closest.sort((a, b) => b.distance - a.distance);
        }
    }

    closest.sort((a, b) => a.distance - b.distance);
    return closest;
}

export function calculateBoundsFromLocation(
    latitude: number,
    longitude: number,
    bufferKm: number
): [[number, number], [number, number]] {
    const latBuffer = bufferKm / 111.32;
    const lonBuffer =
        bufferKm / (111.32 * Math.cos(toRadians(latitude)));

    return [
        [longitude - lonBuffer, latitude - latBuffer],
        [longitude + lonBuffer, latitude + latBuffer],
    ];
}

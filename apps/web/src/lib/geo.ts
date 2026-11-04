import type { DutyPharmacy } from '@nobetcim/contract';

export interface LatLng {
    latitude: number;
    longitude: number;
}

/** A pharmacy with usable coordinates. */
export type MappedPharmacy = DutyPharmacy & { lat: number; lng: number };

export interface NearbyPharmacy {
    pharmacy: MappedPharmacy;
    distanceKm: number;
}

/** [west, south, east, north] with a margin around Turkey's land borders. */
export const TURKEY_BOUNDS: [number, number, number, number] = [
    25.0, 35.4, 45.4, 42.5,
];

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(a.latitude)) *
            Math.cos(toRadians(b.latitude)) *
            Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function isInTurkey({ latitude, longitude }: LatLng): boolean {
    const [west, south, east, north] = TURKEY_BOUNDS;
    return (
        latitude >= south &&
        latitude <= north &&
        longitude >= west &&
        longitude <= east
    );
}

export function hasCoordinates(
    pharmacy: DutyPharmacy
): pharmacy is MappedPharmacy {
    return pharmacy.lat !== null && pharmacy.lng !== null;
}

/** All pharmacies sorted by distance. ~1-2k items: a full sort is < 1 ms. */
export function sortByDistance(
    pharmacies: readonly MappedPharmacy[],
    origin: LatLng
): NearbyPharmacy[] {
    return pharmacies
        .map((pharmacy) => ({
            pharmacy,
            distanceKm: distanceKm(origin, {
                latitude: pharmacy.lat,
                longitude: pharmacy.lng,
            }),
        }))
        .toSorted((a, b) => a.distanceKm - b.distanceKm);
}

import type { LatLng } from './geo';

const KEY = 'nobetcim:last-location';

// Lets a returning visitor start at their area instead of the whole country,
// before the (slower) GPS fix arrives. Storage may be unavailable; ignore it.
export function readLastLocation(): LatLng | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<LatLng>;
        return typeof value.latitude === 'number' &&
            typeof value.longitude === 'number'
            ? { latitude: value.latitude, longitude: value.longitude }
            : null;
    } catch {
        return null;
    }
}

export function writeLastLocation(location: LatLng) {
    try {
        localStorage.setItem(KEY, JSON.stringify(location));
    } catch {
        // private mode or storage disabled
    }
}

import type { Feature, Polygon } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

import type { Fix } from '@/lib/use-geolocation';

const ACCURACY_SOURCE = 'user-accuracy';
const BLUE_500 = '#3b82f6';
const EARTH_RADIUS_M = 6_371_000;
const CIRCLE_STEPS = 48;

/**
 * The pulsing "you are here" dot. A single DOM marker is fine; only its
 * transform/opacity animate, which stays on the compositor.
 */
export function createUserLocationElement(): HTMLElement {
    const root = document.createElement('div');
    root.className =
        'pointer-events-none relative transition-opacity duration-500';
    root.setAttribute('aria-label', 'Konumunuz');
    const ripple =
        'absolute top-1/2 left-1/2 h-10 w-10 rounded-full border-2 border-blue-500 will-change-transform';
    root.innerHTML = `
        <div class="${ripple} animate-location-ripple"></div>
        <div class="${ripple} animate-location-ripple-delayed"></div>
        <div class="relative z-10 h-5 w-5 rounded-full border-[3px] border-white bg-blue-600 shadow-lg transition-colors duration-500"></div>
    `;
    return root;
}

// Kept as literals so Tailwind generates them.
const STALE_CLASSES = [
    'grayscale',
    'opacity-60',
    '[&_.animate-location-ripple]:hidden',
    '[&_.animate-location-ripple-delayed]:hidden',
];

/** Greys the dot out (and stops the ripple) while the fix is old. */
export function setUserLocationStale(
    element: HTMLElement | undefined,
    stale: boolean
) {
    if (!element) return;
    for (const name of STALE_CLASSES) element.classList.toggle(name, stale);
}

/** Geodesic circle around the fix with the reported accuracy as radius. */
function accuracyCircle(fix: Fix | null): Feature<Polygon> {
    const ring: [number, number][] = [];
    if (fix) {
        const lat = (fix.latitude * Math.PI) / 180;
        const lng = (fix.longitude * Math.PI) / 180;
        const angular = fix.accuracy / EARTH_RADIUS_M;
        for (let i = 0; i <= CIRCLE_STEPS; i++) {
            const bearing = (i / CIRCLE_STEPS) * 2 * Math.PI;
            const pointLat = Math.asin(
                Math.sin(lat) * Math.cos(angular) +
                    Math.cos(lat) * Math.sin(angular) * Math.cos(bearing)
            );
            const pointLng =
                lng +
                Math.atan2(
                    Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
                    Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat)
                );
            ring.push([(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI]);
        }
    }
    return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: ring.length ? [ring] : [] },
        properties: {},
    };
}

/** Adds the accuracy circle below the pharmacy layers. Safe after style loads. */
export function installAccuracyLayer(
    map: MapLibreMap,
    fix: Fix | null,
    beforeLayer: string
) {
    if (!map.getSource(ACCURACY_SOURCE)) {
        map.addSource(ACCURACY_SOURCE, {
            type: 'geojson',
            data: accuracyCircle(fix),
        });
    }
    map.addLayer(
        {
            id: 'user-accuracy-fill',
            type: 'fill',
            source: ACCURACY_SOURCE,
            paint: { 'fill-color': BLUE_500, 'fill-opacity': 0.12 },
        },
        beforeLayer
    );
    map.addLayer(
        {
            id: 'user-accuracy-line',
            type: 'line',
            source: ACCURACY_SOURCE,
            paint: {
                'line-color': BLUE_500,
                'line-opacity': 0.45,
                'line-width': 1,
            },
        },
        beforeLayer
    );
}

export function setAccuracy(map: MapLibreMap, fix: Fix | null) {
    map.getSource<GeoJSONSource>(ACCURACY_SOURCE)?.setData(accuracyCircle(fix));
}

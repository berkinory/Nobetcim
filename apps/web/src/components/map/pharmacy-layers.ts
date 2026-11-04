import type { FeatureCollection, Point } from 'geojson';
import type {
    FilterSpecification,
    GeoJSONSource,
    Map as MapLibreMap,
} from 'maplibre-gl';

import type { MappedPharmacy } from '@/lib/geo';

export const PHARMACY_SOURCE = 'pharmacies';
const SELECTED_LAYER = 'pharmacy-selected';
const HALO_LAYER = 'pharmacy-halo';
const RIPPLE_LAYER = 'pharmacy-ripple';

// Open and not-yet-started shifts get separate layers with constant opacity:
// MapLibre cannot animate data-driven paint values, and the reveal fade below
// needs plain numbers.
const GROUPS = [
    { key: 'open', upcoming: false, opacity: 1 },
    { key: 'upcoming', upcoming: true, opacity: 0.45 },
] as const;
const dotLayer = (key: string) => `pharmacy-dot-${key}`;
const iconLayer = (key: string) => `pharmacy-icon-${key}`;

/** The lowest pharmacy layer; other overlays are inserted below it. */
export const BASE_LAYER = dotLayer('open');
export const INTERACTIVE_LAYERS = [
    ...GROUPS.flatMap((g) => [dotLayer(g.key), iconLayer(g.key)]),
    SELECTED_LAYER,
];

const REVEAL_MS = 600;
const RIPPLE_MS = 750;

// Below this zoom pharmacies are plain dots: thousands of them stay legible
// and cost the GPU next to nothing.
const ICON_MIN_ZOOM = 11;

const RED_400 = '#f87171';
const RED_500 = '#ef4444';
// lucide "moon", the original marker glyph (24x24 viewBox).
const MOON_PATH = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z';
const ICON_PIXEL_RATIO = 2;

/** `upcoming`: the shift has not started yet; drawn faded. */
export type PharmacyProperties = { id: number; upcoming: boolean };

function drawPin(fill: string, selected: boolean): ImageData {
    const cssSize = selected ? 40 : 32;
    const size = cssSize * ICON_PIXEL_RATIO;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas unavailable');

    const center = size / 2;
    const radius = center - 3 * ICON_PIXEL_RATIO;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 4 * ICON_PIXEL_RATIO;
    ctx.shadowOffsetY = 1 * ICON_PIXEL_RATIO;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (selected) {
        ctx.lineWidth = 3 * ICON_PIXEL_RATIO;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }

    const glyph = 16 * ICON_PIXEL_RATIO;
    ctx.translate(center - glyph / 2, center - glyph / 2);
    ctx.scale(glyph / 24, glyph / 24);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.stroke(new Path2D(MOON_PATH));
    return ctx.getImageData(0, 0, size, size);
}

let pinImages: { pin: ImageData; selected: ImageData } | null = null;

export function toFeatureCollection(
    pharmacies: readonly MappedPharmacy[],
    upcomingIds: ReadonlySet<number>
): FeatureCollection<Point, PharmacyProperties> {
    return {
        type: 'FeatureCollection',
        features: pharmacies.map((pharmacy) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [pharmacy.lng, pharmacy.lat],
            },
            properties: {
                id: pharmacy.id,
                upcoming: upcomingIds.has(pharmacy.id),
            },
        })),
    };
}

/** Adds the source, images and layers. Safe to call after every style load. */
export function installPharmacyLayers(
    map: MapLibreMap,
    data: FeatureCollection<Point, PharmacyProperties>,
    selectedId: number | null
) {
    pinImages ??= {
        pin: drawPin(RED_400, false),
        selected: drawPin(RED_500, true),
    };
    if (!map.hasImage('pharmacy-pin')) {
        map.addImage('pharmacy-pin', pinImages.pin, {
            pixelRatio: ICON_PIXEL_RATIO,
        });
        map.addImage('pharmacy-pin-selected', pinImages.selected, {
            pixelRatio: ICON_PIXEL_RATIO,
        });
    }

    if (!map.getSource(PHARMACY_SOURCE)) {
        map.addSource(PHARMACY_SOURCE, { type: 'geojson', data });
    }

    const reveal = { duration: REVEAL_MS, delay: 0 };
    for (const group of GROUPS) {
        const filter: FilterSpecification = [
            '==',
            ['get', 'upcoming'],
            group.upcoming,
        ];
        // Pins start transparent and fade to `group.opacity` once the layer
        // exists (see revealPharmacies), so they settle in instead of popping.
        map.addLayer({
            id: dotLayer(group.key),
            type: 'circle',
            source: PHARMACY_SOURCE,
            maxzoom: ICON_MIN_ZOOM,
            filter,
            paint: {
                'circle-color': RED_400,
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    5,
                    3,
                    8,
                    4.5,
                    ICON_MIN_ZOOM,
                    6.5,
                ],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1,
                'circle-opacity': 0,
                'circle-stroke-opacity': 0,
                'circle-opacity-transition': reveal,
                'circle-stroke-opacity-transition': reveal,
            },
        });
        map.addLayer({
            id: iconLayer(group.key),
            type: 'symbol',
            source: PHARMACY_SOURCE,
            minzoom: ICON_MIN_ZOOM,
            filter,
            layout: {
                'icon-image': 'pharmacy-pin',
                'icon-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    ICON_MIN_ZOOM,
                    0.7,
                    14,
                    1,
                ],
                // Every pharmacy must stay visible, and skipping collision
                // detection is also what keeps symbol placement cheap.
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
            },
            paint: { 'icon-opacity': 0, 'icon-opacity-transition': reveal },
        });
    }

    const selected = selectedFilter(selectedId);
    map.addLayer({
        id: HALO_LAYER,
        type: 'circle',
        source: PHARMACY_SOURCE,
        filter: selected,
        paint: {
            'circle-color': RED_500,
            'circle-radius': 26,
            'circle-opacity': 0.18,
            'circle-blur': 0.4,
        },
    });
    map.addLayer({
        id: RIPPLE_LAYER,
        type: 'circle',
        source: PHARMACY_SOURCE,
        filter: selected,
        paint: {
            'circle-color': 'rgba(0, 0, 0, 0)',
            'circle-stroke-color': RED_500,
            'circle-stroke-width': 2,
            'circle-radius': 20,
            'circle-stroke-opacity': 0,
        },
    });
    map.addLayer({
        id: SELECTED_LAYER,
        type: 'symbol',
        source: PHARMACY_SOURCE,
        filter: selected,
        layout: {
            'icon-image': 'pharmacy-pin-selected',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
        },
    });

    // Let the first frame render the transparent pins, then fade them in.
    requestAnimationFrame(() => revealPharmacies(map));
}

function revealPharmacies(map: MapLibreMap) {
    for (const group of GROUPS) {
        if (!map.getLayer(dotLayer(group.key))) continue;
        map.setPaintProperty(
            dotLayer(group.key),
            'circle-opacity',
            group.opacity
        );
        map.setPaintProperty(
            dotLayer(group.key),
            'circle-stroke-opacity',
            group.opacity
        );
        map.setPaintProperty(
            iconLayer(group.key),
            'icon-opacity',
            group.opacity
        );
    }
}

function selectedFilter(selectedId: number | null): FilterSpecification {
    return ['==', ['get', 'id'], selectedId ?? -1];
}

export function setPharmacyData(
    map: MapLibreMap,
    data: FeatureCollection<Point, PharmacyProperties>
) {
    map.getSource<GeoJSONSource>(PHARMACY_SOURCE)?.setData(data);
}

/**
 * Moves the selection layers to the pharmacy and plays one ripple ring.
 * One-shot paint transitions, not a render loop: the map only repaints while
 * the ring is moving.
 */
export function setSelectedPharmacy(
    map: MapLibreMap,
    selectedId: number | null
) {
    if (!map.getLayer(SELECTED_LAYER)) return;
    const filter = selectedFilter(selectedId);
    for (const layer of [HALO_LAYER, RIPPLE_LAYER, SELECTED_LAYER]) {
        map.setFilter(layer, filter);
    }
    if (selectedId === null) return;

    const instant = { duration: 0, delay: 0 };
    map.setPaintProperty(RIPPLE_LAYER, 'circle-radius-transition', instant);
    map.setPaintProperty(
        RIPPLE_LAYER,
        'circle-stroke-opacity-transition',
        instant
    );
    map.setPaintProperty(RIPPLE_LAYER, 'circle-radius', 18);
    map.setPaintProperty(RIPPLE_LAYER, 'circle-stroke-opacity', 0.8);
    requestAnimationFrame(() => {
        if (!map.getLayer(RIPPLE_LAYER)) return;
        const ripple = { duration: RIPPLE_MS, delay: 0 };
        map.setPaintProperty(RIPPLE_LAYER, 'circle-radius-transition', ripple);
        map.setPaintProperty(
            RIPPLE_LAYER,
            'circle-stroke-opacity-transition',
            ripple
        );
        map.setPaintProperty(RIPPLE_LAYER, 'circle-radius', 44);
        map.setPaintProperty(RIPPLE_LAYER, 'circle-stroke-opacity', 0);
    });
}

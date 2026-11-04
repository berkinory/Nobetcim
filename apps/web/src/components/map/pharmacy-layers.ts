import type { FeatureCollection, Point } from 'geojson';
import type {
    ExpressionSpecification,
    FilterSpecification,
    GeoJSONSource,
    Map as MapLibreMap,
} from 'maplibre-gl';

import type { MappedPharmacy } from '@/lib/geo';

export const PHARMACY_SOURCE = 'pharmacies';
export const DOT_LAYER = 'pharmacy-dot';
const ICON_LAYER = 'pharmacy-icon';
const SELECTED_LAYER = 'pharmacy-selected';
export const INTERACTIVE_LAYERS = [DOT_LAYER, ICON_LAYER, SELECTED_LAYER];

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

const UPCOMING_OPACITY = 0.45;
const fadeUpcoming: ExpressionSpecification = [
    'case',
    ['get', 'upcoming'],
    UPCOMING_OPACITY,
    1,
];

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

    map.addLayer({
        id: DOT_LAYER,
        type: 'circle',
        source: PHARMACY_SOURCE,
        maxzoom: ICON_MIN_ZOOM,
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
            'circle-opacity': fadeUpcoming,
            'circle-stroke-opacity': fadeUpcoming,
        },
    });
    map.addLayer({
        id: ICON_LAYER,
        type: 'symbol',
        source: PHARMACY_SOURCE,
        minzoom: ICON_MIN_ZOOM,
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
        paint: { 'icon-opacity': fadeUpcoming },
    });
    map.addLayer({
        id: SELECTED_LAYER,
        type: 'symbol',
        source: PHARMACY_SOURCE,
        filter: selectedFilter(selectedId),
        layout: {
            'icon-image': 'pharmacy-pin-selected',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
        },
    });
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

export function setSelectedPharmacy(
    map: MapLibreMap,
    selectedId: number | null
) {
    if (map.getLayer(SELECTED_LAYER)) {
        map.setFilter(SELECTED_LAYER, selectedFilter(selectedId));
    }
}

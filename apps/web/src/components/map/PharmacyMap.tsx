import {
    AttributionControl,
    Map as MapLibreMap,
    Marker,
    setWorkerUrl,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    type Ref,
} from 'react';

import { TURKEY_BOUNDS, type LatLng, type MappedPharmacy } from '@/lib/geo';
import type { Fix } from '@/lib/use-geolocation';

import { mapStyleUrl, transformRequest, type MapStyleId } from './map-style';
import {
    BASE_LAYER,
    INTERACTIVE_LAYERS,
    installPharmacyLayers,
    setPharmacyData,
    setSelectedPharmacy,
    toFeatureCollection,
    type PharmacyProperties,
} from './pharmacy-layers';
import {
    createUserLocationElement,
    installAccuracyLayer,
    setAccuracy,
} from './user-location';

// maplibre v6 cannot locate its worker inside a bundle; hand Vite's URL over.
setWorkerUrl(workerUrl);

export interface PharmacyMapHandle {
    flyTo: (location: LatLng, zoom?: number) => void;
    /** Re-centers without changing zoom; used while following the user. */
    panTo: (location: LatLng) => void;
    zoomIn: () => void;
    zoomOut: () => void;
}

interface PharmacyMapProps {
    ref?: Ref<PharmacyMapHandle>;
    styleId: MapStyleId;
    pharmacies: readonly MappedPharmacy[];
    /** Pharmacies whose shift has not started yet; drawn faded. */
    upcomingIds: ReadonlySet<number>;
    selectedId: number | null;
    userLocation: Fix | null;
    initialCenter: LatLng | null;
    onSelect: (id: number | null) => void;
    /** The user dragged or zoomed the map themselves. */
    onUserMove: () => void;
}

const DETAIL_ZOOM = 14;
// Fingers are imprecise and the low-zoom dots are tiny; search a box around
// the tap instead of the exact pixel.
const TAP_RADIUS_PX = 14;

export function PharmacyMap({
    ref,
    styleId,
    pharmacies,
    upcomingIds,
    selectedId,
    userLocation,
    initialCenter,
    onSelect,
    onUserMove,
}: PharmacyMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const userMarkerRef = useRef<Marker | null>(null);

    const data = useMemo(
        () => toFeatureCollection(pharmacies, upcomingIds),
        [pharmacies, upcomingIds]
    );

    // Map event handlers outlive renders; read the latest props through refs.
    const latest = useRef({
        data,
        selectedId,
        userLocation,
        onSelect,
        onUserMove,
    });
    useLayoutEffect(() => {
        latest.current = {
            data,
            selectedId,
            userLocation,
            onSelect,
            onUserMove,
        };
    });
    const initial = useRef({ styleId, initialCenter });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const { styleId: firstStyle, initialCenter: center } = initial.current;

        const map = new MapLibreMap({
            container,
            style: mapStyleUrl(firstStyle),
            transformRequest,
            ...(center
                ? { center: [center.longitude, center.latitude], zoom: 13 }
                : {
                      bounds: TURKEY_BOUNDS,
                      // Keep the country clear of the controls and the list.
                      fitBoundsOptions: {
                          padding: {
                              top: 72,
                              bottom: 220,
                              left: 16,
                              right: 16,
                          },
                      },
                  }),
            minZoom: 4.5,
            maxZoom: 18,
            maxBounds: [
                [TURKEY_BOUNDS[0] - 6, TURKEY_BOUNDS[1] - 4],
                [TURKEY_BOUNDS[2] + 6, TURKEY_BOUNDS[3] + 4],
            ],
            // 3x phone screens triple the fill cost for no visible gain on a
            // map; 2x is where most low-end Android jank disappears.
            pixelRatio: Math.min(window.devicePixelRatio, 2),
            renderWorldCopies: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            attributionControl: false,
        });
        // Top-left, under the style switcher: the bottom edge belongs to the
        // list panel, and MapTiler's terms need the credit visible.
        map.addControl(new AttributionControl({ compact: true }), 'top-left');
        map.once('load', () => {
            // Compact attribution starts expanded; start it folded to the (i).
            container
                .querySelector('.maplibregl-ctrl-attrib')
                ?.classList.remove('maplibregl-compact-show');
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();

        map.on('style.load', () => {
            const { data: current, selectedId: selected } = latest.current;
            installPharmacyLayers(map, current, selected);
            installAccuracyLayer(map, latest.current.userLocation, BASE_LAYER);
        });

        // Camera events carry `originalEvent` only when a person caused them.
        const reportUserMove = (event: { originalEvent?: unknown }) => {
            if (event.originalEvent) latest.current.onUserMove();
        };
        map.on('dragstart', reportUserMove);
        map.on('zoomstart', reportUserMove);

        map.on('click', ({ point }) => {
            const hits = map.queryRenderedFeatures(
                [
                    [point.x - TAP_RADIUS_PX, point.y - TAP_RADIUS_PX],
                    [point.x + TAP_RADIUS_PX, point.y + TAP_RADIUS_PX],
                ],
                { layers: INTERACTIVE_LAYERS }
            );
            let nearest: { id: number; distance: number } | null = null;
            for (const feature of hits) {
                const [lng, lat] = (feature.geometry as GeoJSON.Point)
                    .coordinates as [number, number];
                const projected = map.project([lng, lat]);
                const distance = Math.hypot(
                    projected.x - point.x,
                    projected.y - point.y
                );
                if (!nearest || distance < nearest.distance) {
                    nearest = {
                        id: (feature.properties as PharmacyProperties).id,
                        distance,
                    };
                }
            }
            latest.current.onSelect(nearest?.id ?? null);
        });

        for (const layer of INTERACTIVE_LAYERS) {
            map.on('mouseenter', layer, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layer, () => {
                map.getCanvas().style.cursor = '';
            });
        }

        mapRef.current = map;
        return () => {
            mapRef.current = null;
            userMarkerRef.current = null;
            map.remove();
        };
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            flyTo: ({ latitude, longitude }, zoom) => {
                const map = mapRef.current;
                if (!map) return;
                // On phones the bottom sheet covers the lower third; aim the
                // camera so the target lands in the visible part.
                const narrow = map.getContainer().clientWidth < 768;
                map.flyTo({
                    center: [longitude, latitude],
                    zoom: Math.max(map.getZoom(), zoom ?? DETAIL_ZOOM),
                    offset: [0, narrow ? -130 : 0],
                    duration: 1200,
                    curve: 1.3,
                    essential: true,
                });
            },
            panTo: ({ latitude, longitude }) => {
                const map = mapRef.current;
                if (!map) return;
                const narrow = map.getContainer().clientWidth < 768;
                map.easeTo({
                    center: [longitude, latitude],
                    offset: [0, narrow ? -130 : 0],
                    duration: 600,
                });
            },
            zoomIn: () => mapRef.current?.zoomIn({ duration: 250 }),
            zoomOut: () => mapRef.current?.zoomOut({ duration: 250 }),
        }),
        []
    );

    const lastStyle = useRef(styleId);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || lastStyle.current === styleId) return;
        lastStyle.current = styleId;
        // Custom layers are dropped with the old style; `style.load` re-adds them.
        map.setStyle(mapStyleUrl(styleId));
    }, [styleId]);

    useEffect(() => {
        const map = mapRef.current;
        if (map?.isStyleLoaded()) setPharmacyData(map, data);
    }, [data]);

    useEffect(() => {
        const map = mapRef.current;
        if (map?.isStyleLoaded()) setSelectedPharmacy(map, selectedId);
    }, [selectedId]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (map.isStyleLoaded()) setAccuracy(map, userLocation);
        if (!userLocation) {
            userMarkerRef.current?.remove();
            userMarkerRef.current = null;
            return;
        }
        const lngLat: [number, number] = [
            userLocation.longitude,
            userLocation.latitude,
        ];
        if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat(lngLat);
        } else {
            userMarkerRef.current = new Marker({
                element: createUserLocationElement(),
                anchor: 'center',
            })
                .setLngLat(lngLat)
                .addTo(map);
        }
    }, [userLocation]);

    return (
        <div
            ref={containerRef}
            role="application"
            aria-label="Nöbetçi eczaneleri gösteren etkileşimli harita"
            className="h-full w-full"
        />
    );
}

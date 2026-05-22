import {
    useState,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
    useCallback,
    useMemo,
} from 'react';
import {
    Map as MapGL,
    Layer,
    Source,
    type MapLayerMouseEvent,
    type MapRef,
    type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import type { FeatureCollection, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { toast } from 'sonner';

import UserLocationMarker from '@/components/UserLocationMarker';
import PharmacyDialog from '@/components/PharmacyDialog';
import {
    calculateBoundsFromLocation,
    findClosestPharmacies,
    hasMovedMeters,
    MAP_CONFIG,
    type PharmacyData,
    type PharmacyWithDistance,
} from '@/lib/map-config';

const PHARMACY_LAYER_ID = 'pharmacy-points';

function getMapStyleUrl(styleId: string): string {
    const baseUrl = 'https://api.maptiler.com/maps/';
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    const styleMap =
        styleId === 'custom' ? '01976890-9b0b-705a-b6ef-fd4f77dd0100' : styleId;
    return `${baseUrl}${styleMap}/style.json?key=${apiKey}`;
}

function loadPharmacyMarker(map: maplibregl.Map) {
    if (map.hasImage('pharmacy-marker')) return;

    const image = new Image(32, 32);
    image.onload = () => {
        if (!map.hasImage('pharmacy-marker')) {
            map.addImage('pharmacy-marker', image, { pixelRatio: 2 });
        }
    };
    image.src = '/pharmacy-marker.svg';
}

export function isLocationInTurkey(
    latitude: number,
    longitude: number
): boolean {
    const turkeyBounds = {
        north: 42.1,
        south: 35.8,
        east: 44.8,
        west: 25.7,
    };

    return (
        latitude >= turkeyBounds.south &&
        latitude <= turkeyBounds.north &&
        longitude >= turkeyBounds.west &&
        longitude <= turkeyBounds.east
    );
}

export function getCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
}> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser.'));
            return;
        }

        const timeoutId = setTimeout(() => {
            reject(new Error('Location request timed out'));
        }, MAP_CONFIG.GEOLOCATION_OPTIONS.timeout || 10000);

        const successCallback = (position: GeolocationPosition) => {
            clearTimeout(timeoutId);
            resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            });
        };

        const errorCallback = (error: GeolocationPositionError) => {
            clearTimeout(timeoutId);
            console.error('Location error:', error);
            reject(error);
        };

        navigator.geolocation.getCurrentPosition(
            successCallback,
            errorCallback,
            MAP_CONFIG.GEOLOCATION_OPTIONS
        );
    });
}

export interface MapHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    flyToUserLocation: () => void;
    startLocationTracking: () => void;
}

interface MapProps {
    mapStyle: string;
    pharmacies?: PharmacyData[];
    onLocationFound?: (location: {
        latitude: number;
        longitude: number;
    }) => void;
    initialLocation?: { latitude: number; longitude: number };
}

const MapComponent = forwardRef<MapHandle, MapProps>(
    ({ mapStyle, pharmacies, onLocationFound, initialLocation }, ref) => {
        const [viewState, setViewState] = useState<{
            longitude: number;
            latitude: number;
            zoom: number;
        }>({
            longitude: initialLocation?.longitude ?? 0,
            latitude: initialLocation?.latitude ?? 0,
            zoom: initialLocation
                ? MAP_CONFIG.ZOOM.INITIAL
                : MAP_CONFIG.ZOOM.DEFAULT,
        });
        const [userLocation, setUserLocation] = useState<{
            latitude: number;
            longitude: number;
        } | null>(initialLocation ?? null);
        const [boundsAnchor, setBoundsAnchor] = useState<{
            latitude: number;
            longitude: number;
        } | null>(initialLocation ?? null);
        const [closestPharmacies, setClosestPharmacies] = useState<
            PharmacyWithDistance[]
        >([]);
        const [selectedPharmacy, setSelectedPharmacy] = useState<{
            pharmacy: PharmacyData;
            distance?: number;
        } | null>(null);

        const mapRef = useRef<MapRef>(null);
        const watchIdRef = useRef<number | null>(null);
        const hasInitialZoomRef = useRef(!!initialLocation);
        const lastLocationUpdateRef = useRef<number>(0);
        const pendingLocationRef = useRef<{
            latitude: number;
            longitude: number;
        } | null>(null);
        const locationUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const hasPerformedInitialZoomRef = useRef(false);
        const userLocationRef = useRef(userLocation);
        const boundsAnchorRef = useRef(boundsAnchor);
        const hasShownDistanceWarningRef = useRef(false);
        const closestPharmaciesRef = useRef<PharmacyWithDistance[]>([]);

        userLocationRef.current = userLocation;
        boundsAnchorRef.current = boundsAnchor;
        closestPharmaciesRef.current = closestPharmacies;

        const mapStyleUrl = useMemo(() => getMapStyleUrl(mapStyle), [mapStyle]);

        const maxBounds = useMemo(() => {
            if (!boundsAnchor) return undefined;

            return calculateBoundsFromLocation(
                boundsAnchor.latitude,
                boundsAnchor.longitude,
                MAP_CONFIG.LOCATION.BUFFER_KM
            );
        }, [boundsAnchor]);

        const pharmacyGeoJson = useMemo<
            FeatureCollection<Point, { index: number }>
        >(() => {
            return {
                type: 'FeatureCollection',
                features: closestPharmacies.map(({ pharmacy }, index) => ({
                    type: 'Feature',
                    id: index,
                    geometry: {
                        type: 'Point',
                        coordinates: [pharmacy.long, pharmacy.lat],
                    },
                    properties: { index },
                })),
            };
        }, [closestPharmacies]);

        const updateClosestPharmacies = useCallback(
            (
                location: { latitude: number; longitude: number },
                pharmacyList?: PharmacyData[]
            ) => {
                if (!pharmacyList?.length) {
                    setClosestPharmacies([]);
                    return;
                }

                const nextClosest = findClosestPharmacies(
                    pharmacyList,
                    location,
                    MAP_CONFIG.LOCATION.MAX_CLOSEST_PHARMACIES
                );

                setClosestPharmacies((current) => {
                    if (
                        current.length === nextClosest.length &&
                        current.every(
                            (item, index) =>
                                item.pharmacy.lat ===
                                    nextClosest[index]?.pharmacy.lat &&
                                item.pharmacy.long ===
                                    nextClosest[index]?.pharmacy.long &&
                                Math.abs(
                                    item.distance - nextClosest[index].distance
                                ) < 0.01
                        )
                    ) {
                        return current;
                    }

                    return nextClosest;
                });
            },
            []
        );

        useEffect(() => {
            if (!userLocation || !pharmacies?.length) {
                setClosestPharmacies([]);
                return;
            }

            updateClosestPharmacies(userLocation, pharmacies);
        }, [pharmacies, userLocation, updateClosestPharmacies]);

        useEffect(() => {
            if (
                closestPharmacies.length === 0 ||
                closestPharmacies[0].distance <=
                    MAP_CONFIG.LOCATION.DISTANCE_WARNING_KM
            ) {
                return;
            }

            if (hasShownDistanceWarningRef.current) {
                return;
            }

            hasShownDistanceWarningRef.current = true;
            toast.error(
                'Şuan bulunduğunuz şehirde hizmet veremiyor olabiliriz. Lütfen başka kaynakları da kontrol edin.'
            );
        }, [closestPharmacies]);

        const processLocationUpdate = useCallback(
            (newLocation: { latitude: number; longitude: number }) => {
                if (
                    !hasMovedMeters(
                        userLocationRef.current,
                        newLocation,
                        MAP_CONFIG.LOCATION.CHANGE_THRESHOLD_METERS
                    )
                ) {
                    return;
                }

                setUserLocation(newLocation);
                onLocationFound?.(newLocation);

                if (
                    hasMovedMeters(
                        boundsAnchorRef.current,
                        newLocation,
                        MAP_CONFIG.LOCATION.BOUNDS_UPDATE_METERS
                    )
                ) {
                    setBoundsAnchor(newLocation);
                }

                if (!hasInitialZoomRef.current && mapRef.current) {
                    mapRef.current.flyTo({
                        center: [newLocation.longitude, newLocation.latitude],
                        zoom: MAP_CONFIG.ZOOM.TARGET,
                        duration: MAP_CONFIG.ANIMATION.ZOOM_DURATION,
                        essential: true,
                    });
                    hasInitialZoomRef.current = true;
                }
            },
            [onLocationFound]
        );

        const handleLocationUpdate = useCallback(
            (newLocation: { latitude: number; longitude: number }) => {
                const now = Date.now();
                const timeSinceLastUpdate = now - lastLocationUpdateRef.current;

                pendingLocationRef.current = newLocation;

                if (
                    timeSinceLastUpdate >=
                    MAP_CONFIG.LOCATION.UPDATE_THROTTLE_MS
                ) {
                    lastLocationUpdateRef.current = now;
                    processLocationUpdate(newLocation);
                    pendingLocationRef.current = null;

                    if (locationUpdateTimeoutRef.current) {
                        clearTimeout(locationUpdateTimeoutRef.current);
                        locationUpdateTimeoutRef.current = null;
                    }
                    return;
                }

                if (!locationUpdateTimeoutRef.current) {
                    const remainingTime =
                        MAP_CONFIG.LOCATION.UPDATE_THROTTLE_MS -
                        timeSinceLastUpdate;

                    locationUpdateTimeoutRef.current = setTimeout(() => {
                        if (pendingLocationRef.current) {
                            lastLocationUpdateRef.current = Date.now();
                            processLocationUpdate(pendingLocationRef.current);
                            pendingLocationRef.current = null;
                        }
                        locationUpdateTimeoutRef.current = null;
                    }, remainingTime);
                }
            },
            [processLocationUpdate]
        );

        const startLocationTracking = useCallback(() => {
            if (watchIdRef.current !== null || !navigator.geolocation) return;

            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    handleLocationUpdate({
                        longitude: position.coords.longitude,
                        latitude: position.coords.latitude,
                    });
                },
                (error) => console.error('Location tracking error:', error),
                MAP_CONFIG.GEOLOCATION_OPTIONS
            );
        }, [handleLocationUpdate]);

        const handleMapMove = useCallback((evt: ViewStateChangeEvent) => {
            setViewState(evt.viewState);
        }, []);

        const handleMapLoad = useCallback(() => {
            const map = mapRef.current?.getMap();
            if (map) {
                loadPharmacyMarker(map);
            }

            if (
                initialLocation &&
                mapRef.current &&
                !hasPerformedInitialZoomRef.current
            ) {
                hasPerformedInitialZoomRef.current = true;
                setTimeout(() => {
                    mapRef.current?.flyTo({
                        center: [
                            initialLocation.longitude,
                            initialLocation.latitude,
                        ],
                        zoom: MAP_CONFIG.ZOOM.TARGET,
                        duration: MAP_CONFIG.ANIMATION.ZOOM_DURATION,
                        essential: true,
                    });
                }, MAP_CONFIG.ANIMATION.INITIAL_ZOOM_DELAY);
            }
        }, [initialLocation]);

        const handleMapClick = useCallback((event: MapLayerMouseEvent) => {
            const feature = event.features?.[0];
            if (!feature || feature.layer.id !== PHARMACY_LAYER_ID) {
                return;
            }

            const index = feature.properties?.index;
            if (typeof index !== 'number') {
                return;
            }

            const selected = closestPharmaciesRef.current[index];
            if (!selected) {
                return;
            }

            setSelectedPharmacy(selected);
        }, []);

        const zoomIn = useCallback(() => {
            mapRef.current?.zoomIn({
                duration: MAP_CONFIG.ANIMATION.ZOOM_CONTROL_DURATION,
            });
        }, []);

        const zoomOut = useCallback(() => {
            mapRef.current?.zoomOut({
                duration: MAP_CONFIG.ANIMATION.ZOOM_CONTROL_DURATION,
            });
        }, []);

        const flyToUserLocation = useCallback(() => {
            if (userLocation && mapRef.current) {
                mapRef.current.flyTo({
                    center: [userLocation.longitude, userLocation.latitude],
                    zoom: Math.max(
                        mapRef.current.getZoom(),
                        MAP_CONFIG.ZOOM.TARGET
                    ),
                    duration: MAP_CONFIG.ANIMATION.FLY_DURATION,
                    essential: true,
                });
            }
        }, [userLocation]);

        const handleCloseDialog = useCallback(() => {
            setSelectedPharmacy(null);
        }, []);

        const imperativeHandle = useMemo(
            () => ({
                zoomIn,
                zoomOut,
                flyToUserLocation,
                startLocationTracking,
            }),
            [zoomIn, zoomOut, flyToUserLocation, startLocationTracking]
        );

        useEffect(() => {
            if (initialLocation) {
                startLocationTracking();
            }
        }, [initialLocation, startLocationTracking]);

        useEffect(() => {
            return () => {
                if (watchIdRef.current !== null) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                }
                if (locationUpdateTimeoutRef.current) {
                    clearTimeout(locationUpdateTimeoutRef.current);
                }
            };
        }, []);

        useImperativeHandle(ref, () => imperativeHandle, [imperativeHandle]);

        if (!userLocation) {
            return (
                <section
                    className="w-full h-full flex items-center justify-center bg-gray-100"
                    aria-live="polite"
                    aria-label="Konum yükleniyor"
                >
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
                        <p className="text-gray-600">Konum alınıyor...</p>
                    </div>
                </section>
            );
        }

        return (
            <>
                <div
                    role="application"
                    aria-label="Nöbetçi eczaneleri gösteren etkileşimli harita"
                    className="w-full h-full"
                >
                    <MapGL
                        {...viewState}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={mapStyleUrl}
                        minZoom={MAP_CONFIG.ZOOM.MIN}
                        maxZoom={MAP_CONFIG.ZOOM.MAX}
                        maxBounds={maxBounds}
                        onMove={handleMapMove}
                        onLoad={handleMapLoad}
                        onClick={handleMapClick}
                        interactiveLayerIds={[PHARMACY_LAYER_ID]}
                        cursor="grab"
                        ref={mapRef}
                        attributionControl={false}
                        logoPosition="bottom-left"
                    >
                        <Source
                            id="pharmacies"
                            type="geojson"
                            data={pharmacyGeoJson}
                        >
                            <Layer
                                id={PHARMACY_LAYER_ID}
                                type="symbol"
                                layout={{
                                    'icon-image': 'pharmacy-marker',
                                    'icon-size': 1,
                                    'icon-allow-overlap': true,
                                    'icon-ignore-placement': true,
                                }}
                            />
                        </Source>

                        <UserLocationMarker
                            longitude={userLocation.longitude}
                            latitude={userLocation.latitude}
                        />
                    </MapGL>
                </div>

                <PharmacyDialog
                    pharmacy={selectedPharmacy?.pharmacy || null}
                    distance={selectedPharmacy?.distance}
                    onClose={handleCloseDialog}
                />
            </>
        );
    }
);

MapComponent.displayName = 'Map';

export default MapComponent;

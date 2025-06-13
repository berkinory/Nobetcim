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
    type MapRef,
    type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import UserLocationMarker from '@/components/UserLocationMarker';
import PharmacyMarker from '@/components/PharmacyMarker';

const MAP_CONFIG = {
    TURKEY_BOUNDS: {
        north: 42.5,
        south: 36.25,
        east: 44.5,
        west: 25,
    },

    ZOOM: {
        MIN: 12,
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
        UPDATE_THROTTLE_MS: 10000,
        CHANGE_THRESHOLD: 0.00025,
        PHARMACY_RADIUS_KM: 15,
        DEFAULT_FALLBACK: { latitude: 39.9334, longitude: 32.8597 },
    },

    GEOLOCATION_OPTIONS: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
    },
};

function getMapStyleUrl(styleId: string): string {
    const baseUrl = 'https://api.maptiler.com/maps/';
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    const styleMap =
        styleId === 'custom' ? '01976890-9b0b-705a-b6ef-fd4f77dd0100' : styleId;
    return `${baseUrl}${styleMap}/style.json?key=${apiKey}`;
}

function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function hasLocationChangedSignificantly(
    oldLocation: { latitude: number; longitude: number } | null,
    newLocation: { latitude: number; longitude: number }
): boolean {
    if (!oldLocation) return true;

    const latDiff = Math.abs(newLocation.latitude - oldLocation.latitude);
    const lonDiff = Math.abs(newLocation.longitude - oldLocation.longitude);

    return (
        latDiff > MAP_CONFIG.LOCATION.CHANGE_THRESHOLD ||
        lonDiff > MAP_CONFIG.LOCATION.CHANGE_THRESHOLD
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

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                console.error('Location error:', error);
                // Fallback to default location
                resolve(MAP_CONFIG.LOCATION.DEFAULT_FALLBACK);
            },
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

interface PharmacyData {
    city: string;
    district: string;
    name: string;
    phone: string;
    address: string;
    lat: number;
    long: number;
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
        const [viewState, setViewState] = useState({
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

        const mapStyleUrl = useMemo(() => getMapStyleUrl(mapStyle), [mapStyle]);

        const maxBounds = useMemo(
            () =>
                [
                    [
                        MAP_CONFIG.TURKEY_BOUNDS.west,
                        MAP_CONFIG.TURKEY_BOUNDS.south,
                    ],
                    [
                        MAP_CONFIG.TURKEY_BOUNDS.east,
                        MAP_CONFIG.TURKEY_BOUNDS.north,
                    ],
                ] as [[number, number], [number, number]],
            []
        );

        const processLocationUpdate = useCallback(
            (newLocation: { latitude: number; longitude: number }) => {
                if (
                    !hasLocationChangedSignificantly(userLocation, newLocation)
                ) {
                    return;
                }

                console.log(
                    'Processing significant location change:',
                    newLocation
                );

                setUserLocation(newLocation);
                onLocationFound?.(newLocation);

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
            [userLocation, onLocationFound]
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
                } else {
                    if (!locationUpdateTimeoutRef.current) {
                        const remainingTime =
                            MAP_CONFIG.LOCATION.UPDATE_THROTTLE_MS -
                            timeSinceLastUpdate;

                        locationUpdateTimeoutRef.current = setTimeout(() => {
                            if (pendingLocationRef.current) {
                                lastLocationUpdateRef.current = Date.now();
                                processLocationUpdate(
                                    pendingLocationRef.current
                                );
                                pendingLocationRef.current = null;
                            }
                            locationUpdateTimeoutRef.current = null;
                        }, remainingTime);
                    }
                }
            },
            [processLocationUpdate]
        );

        const startLocationTracking = useCallback(() => {
            if (watchIdRef.current !== null || !navigator.geolocation) return;

            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const newLocation = {
                        longitude: position.coords.longitude,
                        latitude: position.coords.latitude,
                    };

                    handleLocationUpdate(newLocation);
                },
                (error) => console.error('Location tracking error:', error),
                MAP_CONFIG.GEOLOCATION_OPTIONS
            );

            watchIdRef.current = watchId;
        }, [handleLocationUpdate]);

        const handleMapMove = useCallback((evt: ViewStateChangeEvent) => {
            setViewState(evt.viewState);
        }, []);

        const handleMapLoad = useCallback(() => {
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

        // Memoize nearby pharmacies to avoid recalculating on every render
        const nearbyPharmacies = useMemo(() => {
            if (!pharmacies || !userLocation) return [];

            return pharmacies
                .map((pharmacy) => {
                    const distance = calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        pharmacy.lat,
                        pharmacy.long
                    );
                    return { pharmacy, distance };
                })
                .filter(
                    ({ distance }) =>
                        distance <= MAP_CONFIG.LOCATION.PHARMACY_RADIUS_KM
                )
                .map(({ pharmacy, distance }) => (
                    <PharmacyMarker
                        key={`${pharmacy.name}-${pharmacy.lat}-${pharmacy.long}`}
                        pharmacy={pharmacy}
                        distance={distance}
                    />
                ));
        }, [pharmacies, userLocation]);

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

        return (
            <MapGL
                {...viewState}
                style={{ width: '100%', height: '100%' }}
                mapStyle={mapStyleUrl}
                minZoom={MAP_CONFIG.ZOOM.MIN}
                maxZoom={MAP_CONFIG.ZOOM.MAX}
                maxBounds={maxBounds}
                onMove={handleMapMove}
                onLoad={handleMapLoad}
                ref={mapRef}
                attributionControl={false}
                logoPosition="bottom-left"
            >
                {userLocation && (
                    <UserLocationMarker
                        longitude={userLocation.longitude}
                        latitude={userLocation.latitude}
                    />
                )}

                {nearbyPharmacies}
            </MapGL>
        );
    }
);

MapComponent.displayName = 'Map';

export default MapComponent;

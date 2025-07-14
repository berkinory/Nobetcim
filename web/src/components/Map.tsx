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
import { toast } from 'sonner';

import UserLocationMarker from '@/components/UserLocationMarker';
import PharmacyMarker from '@/components/PharmacyMarker';
import PharmacyDialog from '@/components/PharmacyDialog';

const MAP_CONFIG = {
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
        UPDATE_THROTTLE_MS: 10000,
        CHANGE_THRESHOLD: 0.00025,
        MAX_CLOSEST_PHARMACIES: 40,
        BUFFER_KM: 50,
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

function calculateBoundsFromLocation(
    latitude: number,
    longitude: number,
    bufferKm: number
): [[number, number], [number, number]] {
    const latBuffer = bufferKm / 111.32;
    const lonBuffer =
        bufferKm / (111.32 * Math.cos((latitude * Math.PI) / 180));

    const south = latitude - latBuffer;
    const north = latitude + latBuffer;
    const west = longitude - lonBuffer;
    const east = longitude + lonBuffer;

    return [
        [west, south],
        [east, north],
    ];
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

        const abortController = new AbortController();
        const signal = abortController.signal;

        const timeoutId = setTimeout(() => {
            abortController.abort();
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

        try {
            navigator.geolocation.getCurrentPosition(
                successCallback,
                errorCallback,
                {
                    ...MAP_CONFIG.GEOLOCATION_OPTIONS,
                    timeout: MAP_CONFIG.GEOLOCATION_OPTIONS.timeout || 10000,
                }
            );
        } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
        }

        return () => {
            clearTimeout(timeoutId);
            abortController.abort();
        };
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

        const mapStyleUrl = useMemo(() => getMapStyleUrl(mapStyle), [mapStyle]);

        const maxBounds = useMemo(() => {
            if (!userLocation) return undefined;

            return calculateBoundsFromLocation(
                userLocation.latitude,
                userLocation.longitude,
                MAP_CONFIG.LOCATION.BUFFER_KM
            );
        }, [userLocation]);

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

        const handlePharmacyClick = useCallback(
            (pharmacy: PharmacyData, distance?: number) => {
                setSelectedPharmacy({ pharmacy, distance });
            },
            []
        );

        const handleCloseDialog = useCallback(() => {
            setSelectedPharmacy(null);
        }, []);

        const nearbyPharmacies = useMemo(() => {
            if (!pharmacies || !userLocation) return [];

            const closestPharmacies: Array<{
                pharmacy: PharmacyData;
                distance: number;
            }> = [];

            for (const pharmacy of pharmacies) {
                const distance = calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    pharmacy.lat,
                    pharmacy.long
                );

                if (
                    closestPharmacies.length <
                    MAP_CONFIG.LOCATION.MAX_CLOSEST_PHARMACIES
                ) {
                    closestPharmacies.push({ pharmacy, distance });
                    if (
                        closestPharmacies.length ===
                        MAP_CONFIG.LOCATION.MAX_CLOSEST_PHARMACIES
                    ) {
                        closestPharmacies.sort(
                            (a, b) => b.distance - a.distance
                        );
                    }
                } else {
                    if (distance < closestPharmacies[0].distance) {
                        closestPharmacies[0] = { pharmacy, distance };
                        closestPharmacies.sort(
                            (a, b) => b.distance - a.distance
                        );
                    }
                }
            }

            closestPharmacies.sort((a, b) => a.distance - b.distance);

            if (
                closestPharmacies.length > 0 &&
                closestPharmacies[0].distance > 15
            ) {
                toast.error(
                    'Şuan bulunduğunuz şehirde hizmet veremiyor olabiliriz. Lütfen başka kaynakları da kontrol edin.'
                );
            }

            return closestPharmacies.map(({ pharmacy, distance }, index) => (
                <PharmacyMarker
                    key={`${pharmacy.name}-${pharmacy.city}-${pharmacy.district}-${pharmacy.address}-${pharmacy.lat}-${pharmacy.long}-${index}`}
                    pharmacy={pharmacy}
                    distance={distance}
                    onClick={handlePharmacyClick}
                />
            ));
        }, [pharmacies, userLocation, handlePharmacyClick]);

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
                        ref={mapRef}
                        attributionControl={false}
                        logoPosition="bottom-left"
                    >
                        <UserLocationMarker
                            longitude={userLocation.longitude}
                            latitude={userLocation.latitude}
                        />

                        {nearbyPharmacies}
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

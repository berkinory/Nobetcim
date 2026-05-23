import {
    useState,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
    useCallback,
    useMemo,
} from 'react';
import { Map as MapGL, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { toast } from 'sonner';

import PharmacyMarker from '@/components/PharmacyMarker';
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

function getMapStyleUrl(styleId: string): string {
    const baseUrl = 'https://api.maptiler.com/maps/';
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    const styleMap =
        styleId === 'custom' ? '01976890-9b0b-705a-b6ef-fd4f77dd0100' : styleId;
    return `${baseUrl}${styleMap}/style.json?key=${apiKey}`;
}

function pharmacyMarkerKey(pharmacy: PharmacyData): string {
    return `${pharmacy.lat}-${pharmacy.long}-${pharmacy.name}-${pharmacy.address}`;
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

        userLocationRef.current = userLocation;
        boundsAnchorRef.current = boundsAnchor;

        const mapStyleUrl = useMemo(() => getMapStyleUrl(mapStyle), [mapStyle]);

        const initialViewState = useMemo(
            () => ({
                longitude: initialLocation?.longitude ?? 0,
                latitude: initialLocation?.latitude ?? 0,
                zoom: initialLocation
                    ? MAP_CONFIG.ZOOM.INITIAL
                    : MAP_CONFIG.ZOOM.DEFAULT,
            }),
            [initialLocation]
        );

        const maxBounds = useMemo(() => {
            if (!boundsAnchor) return undefined;

            return calculateBoundsFromLocation(
                boundsAnchor.latitude,
                boundsAnchor.longitude,
                MAP_CONFIG.LOCATION.BUFFER_KM
            );
        }, [boundsAnchor]);

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
                                pharmacyMarkerKey(item.pharmacy) ===
                                    pharmacyMarkerKey(
                                        nextClosest[index].pharmacy
                                    ) &&
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

        const pharmacyMarkers = useMemo(
            () =>
                closestPharmacies.map(({ pharmacy, distance }) => (
                    <PharmacyMarker
                        key={pharmacyMarkerKey(pharmacy)}
                        pharmacy={pharmacy}
                        distance={distance}
                        onClick={handlePharmacyClick}
                    />
                )),
            [closestPharmacies, handlePharmacyClick]
        );

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
                        initialViewState={initialViewState}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={mapStyleUrl}
                        minZoom={MAP_CONFIG.ZOOM.MIN}
                        maxZoom={MAP_CONFIG.ZOOM.MAX}
                        maxBounds={maxBounds}
                        onLoad={handleMapLoad}
                        ref={mapRef}
                        attributionControl={false}
                        logoPosition="bottom-left"
                    >
                        <UserLocationMarker
                            longitude={userLocation.longitude}
                            latitude={userLocation.latitude}
                        />

                        {pharmacyMarkers}
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

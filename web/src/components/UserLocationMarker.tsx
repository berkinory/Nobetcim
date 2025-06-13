'use client';

import { Marker } from 'react-map-gl/maplibre';

interface UserLocationMarkerProps {
    longitude: number;
    latitude: number;
}

export default function UserLocationMarker({
    longitude,
    latitude,
}: UserLocationMarkerProps) {
    return (
        <Marker longitude={longitude} latitude={latitude} anchor="center">
            <div className="relative">
                <div className="absolute top-1/2 left-1/2 w-10 h-10 border-2 border-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-location-ripple" />
                <div className="absolute top-1/2 left-1/2 w-10 h-10 border-2 border-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-location-ripple-delayed" />

                <div className="relative w-5 h-5 bg-blue-700 border-3 border-white rounded-full shadow-lg z-10">
                    <div className="w-full h-full bg-blue-600 rounded-full animate-location-pulse" />
                </div>
            </div>
        </Marker>
    );
}

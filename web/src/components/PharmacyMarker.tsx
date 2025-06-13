'use client';

import { Marker } from 'react-map-gl/maplibre';
import { Cross } from 'lucide-react';

interface PharmacyData {
    city: string;
    district: string;
    name: string;
    phone: string;
    address: string;
    lat: number;
    long: number;
}

interface PharmacyMarkerProps {
    pharmacy: PharmacyData;
    distance?: number;
    onClick?: (pharmacy: PharmacyData, distance?: number) => void;
}

export default function PharmacyMarker({
    pharmacy,
    distance,
    onClick,
}: PharmacyMarkerProps) {
    return (
        <Marker
            longitude={pharmacy.long}
            latitude={pharmacy.lat}
            anchor="center"
        >
            <button
                type="button"
                className="w-8 h-8 bg-red-400 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-red-500 transition-colors border-0 p-0"
                onClick={() => onClick?.(pharmacy, distance)}
                aria-label={`Eczane: ${pharmacy.name}`}
            >
                <Cross size={16} className="text-white" strokeWidth={3} />
            </button>
        </Marker>
    );
}

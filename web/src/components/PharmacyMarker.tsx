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
}

export default function PharmacyMarker({
    pharmacy,
    distance,
}: PharmacyMarkerProps) {
    return (
        <Marker longitude={pharmacy.long} latitude={pharmacy.lat} anchor="center">
            <div className="w-8 h-8 bg-red-400 rounded-full flex items-center justify-center shadow-lg">
                <Cross size={16} className="text-white" strokeWidth={3} />
            </div>
        </Marker>
    );
} 
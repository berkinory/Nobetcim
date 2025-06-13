'use client';

import { X, Phone, MapPin } from 'lucide-react';
import { useEffect } from 'react';
import { FaGoogle, FaApple } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PharmacyData {
    city: string;
    district: string;
    name: string;
    phone: string;
    address: string;
    lat: number;
    long: number;
}

interface PharmacyDialogProps {
    pharmacy: PharmacyData | null;
    distance?: number;
    onClose: () => void;
}

export default function PharmacyDialog({
    pharmacy,
    distance,
    onClose,
}: PharmacyDialogProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (pharmacy) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [pharmacy, onClose]);

    if (!pharmacy) return null;

    const handleCall = () => {
        if (pharmacy.phone) {
            window.location.href = `tel:${pharmacy.phone}`;
        }
    };

    const handleNavigate = () => {
        const url = `https://maps.google.com/?q=${pharmacy.lat},${pharmacy.long}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
                <div
                    key={`${pharmacy.name}-${pharmacy.lat}-${pharmacy.long}`}
                    className="bg-card border border-border rounded-lg shadow-xl p-4 min-w-80 max-w-sm mx-4 animate-in slide-in-from-bottom-8 fade-in-0 duration-300 transition-all"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 pr-2">
                            <h3 className="font-semibold text-card-foreground text-lg leading-tight">
                                Eczane{' '}
                                {pharmacy.name
                                    .split(' ')
                                    .map(
                                        (word) =>
                                            word.charAt(0).toUpperCase() +
                                            word.slice(1).toLowerCase()
                                    )
                                    .join(' ')}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {pharmacy.district}, {pharmacy.city}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="flex-shrink-0 h-8 w-8 hover:bg-accent rounded-full"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </Button>
                    </div>

                    <div className="overflow-hidden transition-all duration-300 ease-in-out">
                        {distance !== undefined && (
                            <div className="mb-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                                <Badge variant="outline">
                                    {distance < 1
                                        ? `${Math.round(distance * 1000)} metre`
                                        : `${distance.toFixed(1)} kilometre`}{' '}
                                </Badge>
                            </div>
                        )}
                    </div>

                    {pharmacy.phone && (
                        <div className="mb-4 overflow-hidden transition-all duration-300 ease-in-out">
                            <div className="flex items-center gap-2 animate-in fade-in-0 slide-in-from-right-2 duration-350">
                                <Phone
                                    size={14}
                                    className="text-muted-foreground"
                                />
                                <button
                                    type="button"
                                    onClick={handleCall}
                                    className="text-sm text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
                                >
                                    {pharmacy.phone}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mb-4 overflow-hidden transition-all duration-300 ease-in-out">
                        <div className="flex items-start gap-2 animate-in fade-in-0 slide-in-from-left-2 duration-300">
                            <MapPin
                                size={14}
                                className="text-muted-foreground mt-0.5 flex-shrink-0"
                            />
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {pharmacy.address}
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden transition-all duration-300 ease-in-out">
                        <div className="flex gap-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-400">
                            <Button
                                type="button"
                                onClick={handleNavigate}
                                variant="outline"
                                size="sm"
                                className="flex-1 h-9"
                            >
                                <FaGoogle size={16} />
                                Google Haritalar
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    const url = `maps://maps.apple.com/?q=${pharmacy.lat},${pharmacy.long}`;
                                    window.open(url, '_blank');
                                }}
                                variant="outline"
                                size="sm"
                                className="flex-1 h-9"
                            >
                                <FaApple size={16} />
                                Apple Haritalar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

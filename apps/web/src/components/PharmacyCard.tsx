import { Clock, MapPin, Phone, Share2, X } from 'lucide-react';
import { useEffect } from 'react';
import { FaApple, FaGoogle } from 'react-icons/fa';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { surface } from '@/components/ui/surface';
import {
    appleMapsDirectionsUrl,
    googleMapsDirectionsUrl,
} from '@/lib/directions';
import {
    formatDistance,
    formatPhone,
    pharmacyDisplayName,
    toTitleCaseTr,
} from '@/lib/format';
import type { MappedPharmacy } from '@/lib/geo';
import { shiftLabel, shiftWindow, type ShiftState } from '@/lib/shift';
import { cn } from '@/lib/utils';

interface PharmacyCardProps {
    pharmacy: MappedPharmacy;
    state: ShiftState;
    now: number;
    distanceKm: number | null;
    onClose: () => void;
}

async function share(pharmacy: MappedPharmacy) {
    const url = `${window.location.origin}/?eczane=${pharmacy.id}`;
    const title = pharmacyDisplayName(pharmacy.name);
    try {
        if (navigator.share) {
            await navigator.share({ title, url });
            return;
        }
        await navigator.clipboard.writeText(url);
        toast.success('Bağlantı kopyalandı');
    } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
            toast.error('Bağlantı paylaşılamadı');
        }
    }
}

export function PharmacyCard({
    pharmacy,
    state,
    now,
    distanceKm,
    onClose,
}: PharmacyCardProps) {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const status = shiftLabel(pharmacy, state, now);
    const hours = shiftWindow(pharmacy);

    return (
        <section
            key={pharmacy.id}
            aria-label={pharmacyDisplayName(pharmacy.name)}
            className={cn(
                surface,
                'pointer-events-auto p-4 animate-in fade-in-0 slide-in-from-bottom-4 zoom-in-95 duration-300 ease-out'
            )}
        >
            <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold leading-tight text-card-foreground">
                        {pharmacyDisplayName(pharmacy.name)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {toTitleCaseTr(pharmacy.district)}, {pharmacy.city}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => share(pharmacy)}
                    className="h-8 w-8 shrink-0 rounded-full"
                    aria-label="Paylaş"
                >
                    <Share2 />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 shrink-0 rounded-full"
                    aria-label="Kapat"
                >
                    <X />
                </Button>
            </div>

            {status && (
                <p
                    className={cn(
                        'mb-2 flex items-center gap-1.5 text-sm font-medium',
                        state === 'open'
                            ? 'text-emerald-600'
                            : 'text-muted-foreground'
                    )}
                >
                    <span
                        className={cn(
                            'h-2 w-2 rounded-full',
                            state === 'open'
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground/50'
                        )}
                    />
                    {status}
                </p>
            )}

            {(distanceKm !== null || hours) && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {distanceKm !== null && (
                        <Badge variant="outline">
                            {formatDistance(distanceKm)}
                        </Badge>
                    )}
                    {hours && (
                        <Badge
                            variant="outline"
                            title="Nöbet saatleri il sağlık müdürlüğünce onaylanmış TİTCK listesinden alınır."
                        >
                            <Clock className="h-3 w-3" />
                            Nöbet {hours}
                        </Badge>
                    )}
                </div>
            )}

            {pharmacy.phone && (
                <a
                    href={`tel:${pharmacy.phone}`}
                    className="mb-3 flex w-fit items-center gap-2 text-sm text-primary underline underline-offset-2"
                >
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatPhone(pharmacy.phone)}
                </a>
            )}

            <p className="mb-4 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {pharmacy.address}
            </p>

            <div className="flex gap-2">
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1"
                >
                    <a
                        href={googleMapsDirectionsUrl(
                            pharmacy.lat,
                            pharmacy.lng
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FaGoogle />
                        Google Haritalar
                    </a>
                </Button>
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1"
                >
                    <a
                        href={appleMapsDirectionsUrl(
                            pharmacy.lat,
                            pharmacy.lng
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FaApple />
                        Apple Haritalar
                    </a>
                </Button>
            </div>
        </section>
    );
}

import {
    Map as MapIcon,
    Minus,
    Navigation,
    Plus,
    SatelliteDish,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { MapStyleId } from '@/components/map/map-style';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAP_STYLES = [
    { id: 'street', label: 'Sokak', icon: MapIcon },
    { id: 'satellite', label: 'Uydu', icon: SatelliteDish },
] as const;

// Solid panels on purpose: `backdrop-blur` over a WebGL canvas forces a blur
// pass on every map frame and was a large part of the Android jank.
export function ControlGroup({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'rounded-lg border border-border/50 bg-background/95 p-1 shadow-lg',
                className
            )}
        >
            {children}
        </div>
    );
}

const ICON_BUTTON = 'h-9 w-9 md:h-10 md:w-10';

export function MapStyleSelector({
    value,
    onChange,
}: {
    value: MapStyleId;
    onChange: (style: MapStyleId) => void;
}) {
    return (
        <ControlGroup className="flex gap-0.5">
            {MAP_STYLES.map(({ id, label, icon: Icon }) => (
                <Button
                    key={id}
                    variant={value === id ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => onChange(id)}
                    aria-label={`${label} harita görünümü`}
                    aria-pressed={value === id}
                    className={ICON_BUTTON}
                >
                    <Icon />
                </Button>
            ))}
        </ControlGroup>
    );
}

export function NavigationControls({
    onZoomIn,
    onZoomOut,
    onLocate,
    locating,
    following,
}: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onLocate: () => void;
    locating: boolean;
    /** The camera is following the user's position. */
    following: boolean;
}) {
    return (
        <div className="flex flex-col gap-2">
            <ControlGroup className="flex flex-col gap-0.5">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onZoomIn}
                    aria-label="Yakınlaştır"
                    className={ICON_BUTTON}
                >
                    <Plus />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onZoomOut}
                    aria-label="Uzaklaştır"
                    className={ICON_BUTTON}
                >
                    <Minus />
                </Button>
            </ControlGroup>
            <ControlGroup>
                <Button
                    variant={following ? 'default' : 'outline'}
                    size="icon"
                    onClick={onLocate}
                    aria-label={
                        following ? 'Konumunuz takip ediliyor' : 'Konumuma git'
                    }
                    aria-pressed={following}
                    className={ICON_BUTTON}
                >
                    <Navigation
                        className={cn(
                            locating && 'animate-pulse',
                            following && 'fill-current'
                        )}
                    />
                </Button>
            </ControlGroup>
        </div>
    );
}

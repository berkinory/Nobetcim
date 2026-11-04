import { Minus, Navigation, Plus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

export function ControlGroup({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn(surface, 'overflow-hidden', className)}>
            {children}
        </div>
    );
}

/** A borderless button that is part of its group's surface. */
export function ControlButton({
    className,
    ...props
}: ComponentProps<'button'>) {
    return (
        <button
            type="button"
            className={cn(
                'flex h-10 w-10 touch-manipulation select-none items-center justify-center text-foreground/75 transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none active:bg-muted [&_svg]:size-[18px]',
                className
            )}
            {...props}
        />
    );
}

export function ZoomControls({
    onZoomIn,
    onZoomOut,
    orientation,
}: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    orientation: 'row' | 'column';
}) {
    return (
        <ControlGroup
            className={cn(
                'flex',
                orientation === 'row'
                    ? 'flex-row divide-x divide-border/70'
                    : 'flex-col divide-y divide-border/70'
            )}
        >
            <ControlButton onClick={onZoomIn} aria-label="Yakınlaştır">
                <Plus />
            </ControlButton>
            <ControlButton onClick={onZoomOut} aria-label="Uzaklaştır">
                <Minus />
            </ControlButton>
        </ControlGroup>
    );
}

export function LocateControl({
    onLocate,
    locating,
    following,
}: {
    onLocate: () => void;
    locating: boolean;
    /** The camera is following the user's position. */
    following: boolean;
}) {
    return (
        <ControlGroup>
            <ControlButton
                onClick={onLocate}
                aria-label={
                    following ? 'Konumunuz takip ediliyor' : 'Konumuma git'
                }
                aria-pressed={following}
                className={cn(following && 'text-blue-600 hover:text-blue-600')}
            >
                <Navigation
                    className={cn(
                        'transition-transform duration-200',
                        locating && 'animate-pulse',
                        following && 'fill-current'
                    )}
                />
            </ControlButton>
        </ControlGroup>
    );
}

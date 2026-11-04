import { useCallback, useEffect, useRef, useState } from 'react';

import { distanceKm, isInTurkey, type LatLng } from './geo';
import { writeLastLocation } from './last-location';

export type GeolocationStatus =
    | 'idle'
    | 'locating'
    | 'tracking'
    | 'denied'
    | 'unavailable'
    | 'outside';

export interface Fix extends LatLng {
    /** 95% confidence radius in metres, as reported by the device. */
    accuracy: number;
}

// A coarse network fix arrives in well under a second and is enough to sort
// the list; the precise GPS watch refines it afterwards.
const QUICK_OPTIONS: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: 5 * 60_000,
    timeout: 6_000,
};
const WATCH_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 5_000,
    timeout: 20_000,
};
const MIN_MOVE_M = 10;
// The list re-sorts only after this much movement, so rows do not shuffle
// under the user's finger while they walk.
const ANCHOR_MOVE_M = 25;
// No fix for this long while tracking: the dot is shown as stale.
const STALE_AFTER_MS = 45_000;

export const GEOLOCATION_MESSAGES: Record<
    Exclude<GeolocationStatus, 'idle' | 'locating' | 'tracking'>,
    string
> = {
    denied: 'Konum izni reddedildi. Tarayıcı ayarlarından konum iznini açabilirsiniz.',
    unavailable:
        'Konum alınamadı. Konum servislerinin açık olduğundan emin olup tekrar deneyin.',
    outside:
        'Konumunuz Türkiye dışında görünüyor. Haritadan eczane seçebilirsiniz.',
};

/**
 * Decides whether a new fix is worth a re-render. GPS wobbles by several
 * metres while standing still; re-sorting the list and moving the marker for
 * that is wasted work on low-end phones and makes the dot jitter.
 */
export function shouldAccept(previous: Fix | null, next: Fix): boolean {
    if (!previous) return true;
    const movedM = distanceKm(previous, next) * 1000;
    // Clearly better accuracy is news even without movement (the circle
    // shrinks, e.g. network fix -> GPS fix).
    if (next.accuracy < previous.accuracy * 0.7) return true;
    // A much worse reading than the one we have is likely a bad sample.
    if (next.accuracy > previous.accuracy * 3 && movedM < next.accuracy) {
        return false;
    }
    return movedM >= Math.max(MIN_MOVE_M, next.accuracy / 2);
}

export function useGeolocation() {
    const [status, setStatus] = useState<GeolocationStatus>('idle');
    const [position, setPosition] = useState<Fix | null>(null);
    const [anchor, setAnchor] = useState<Fix | null>(null);
    const [stale, setStale] = useState(false);
    const watchId = useRef<number | null>(null);
    const anchorRef = useRef<Fix | null>(null);
    const staleTimer = useRef<number | undefined>(undefined);
    const last = useRef<Fix | null>(null);
    // True while the user wants tracking; survives background pauses.
    const wanted = useRef(false);

    const clearWatch = useCallback(() => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
    }, []);

    const onFix = useCallback(
        ({ coords }: GeolocationPosition) => {
            const next: Fix = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy,
            };
            if (!isInTurkey(next)) {
                wanted.current = false;
                clearWatch();
                setStatus('outside');
                return;
            }
            setStatus('tracking');
            setStale(false);
            window.clearTimeout(staleTimer.current);
            staleTimer.current = window.setTimeout(
                () => setStale(true),
                STALE_AFTER_MS
            );
            if (!shouldAccept(last.current, next)) return;
            last.current = next;
            writeLastLocation(next);
            setPosition(next);
            const previousAnchor = anchorRef.current;
            if (
                !previousAnchor ||
                distanceKm(previousAnchor, next) * 1000 >= ANCHOR_MOVE_M ||
                next.accuracy < previousAnchor.accuracy * 0.5
            ) {
                anchorRef.current = next;
                setAnchor(next);
            }
        },
        [clearWatch]
    );

    const onError = useCallback(
        (error: GeolocationPositionError) => {
            if (error.code === error.PERMISSION_DENIED) {
                wanted.current = false;
                clearWatch();
                setStatus('denied');
                return;
            }
            // Timeouts and lost signal: keep the watch alive, it recovers on
            // its own (tunnels, indoors). Only report it if we have nothing.
            if (last.current === null) setStatus('unavailable');
        },
        [clearWatch]
    );

    const watch = useCallback(() => {
        if (watchId.current !== null) return;
        watchId.current = navigator.geolocation.watchPosition(
            onFix,
            onError,
            WATCH_OPTIONS
        );
    }, [onFix, onError]);

    const start = useCallback(() => {
        if (!('geolocation' in navigator)) {
            setStatus('unavailable');
            return;
        }
        wanted.current = true;
        if (last.current === null) {
            setStatus('locating');
            navigator.geolocation.getCurrentPosition(
                (fix) => {
                    if (last.current === null) onFix(fix);
                },
                () => {},
                QUICK_OPTIONS
            );
        }
        watch();
    }, [onFix, watch]);

    // GPS is the biggest battery drain on the page: pause it while the tab
    // is hidden and resume when the user comes back.
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') clearWatch();
            else if (wanted.current) watch();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () =>
            document.removeEventListener('visibilitychange', onVisibility);
    }, [clearWatch, watch]);

    // Start silently when permission was granted on an earlier visit, and
    // follow permission changes made in browser settings mid-session.
    useEffect(() => {
        const controller = new AbortController();
        navigator.permissions
            ?.query({ name: 'geolocation' })
            .then((permission) => {
                if (controller.signal.aborted) return;
                const sync = () => {
                    if (permission.state === 'granted' && !wanted.current) {
                        start();
                    }
                    if (permission.state === 'denied' && wanted.current) {
                        wanted.current = false;
                        clearWatch();
                        setStatus('denied');
                    }
                };
                permission.addEventListener('change', sync, {
                    signal: controller.signal,
                });
                sync();
            })
            .catch(() => {});
        return () => {
            controller.abort();
            clearWatch();
        };
    }, [start, clearWatch]);

    useEffect(() => () => window.clearTimeout(staleTimer.current), []);

    /**
     * `position`: every accepted fix, for the map dot and camera.
     * `anchor`: the position the list is sorted and measured from; moves in
     * 25 m steps. `stale`: no fix for a while (tunnel, indoors).
     */
    return { status, position, anchor, stale, start };
}

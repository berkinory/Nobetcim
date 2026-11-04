import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { InfoDialog } from '@/components/InfoDialog';
import { MapStyleSelector, NavigationControls } from '@/components/MapControls';
import type { MapStyleId } from '@/components/map/map-style';
import {
    PharmacyMap,
    type PharmacyMapHandle,
} from '@/components/map/PharmacyMap';
import { NearbyPanel, type PanelRow } from '@/components/NearbyPanel';
import { PharmacyCard } from '@/components/PharmacyCard';
import { dutiesQuery } from '@/lib/api';
import { distanceKm, hasCoordinates, type MappedPharmacy } from '@/lib/geo';
import { readLastLocation } from '@/lib/last-location';
import {
    SHIFT_RANK,
    shiftState,
    UPCOMING_PENALTY_KM,
    useNow,
    type ShiftState,
} from '@/lib/shift';
import { GEOLOCATION_MESSAGES, useGeolocation } from '@/lib/use-geolocation';
import { useOnline } from '@/lib/use-online';

const route = getRouteApi('/');

// Farther than this, the user's own city probably has no published list.
const FAR_AWAY_KM = 40;

export function HomePage() {
    const { eczane: selectedId = null } = route.useSearch();
    const navigate = route.useNavigate();
    const mapRef = useRef<PharmacyMapHandle>(null);
    const [styleId, setStyleId] = useState<MapStyleId>('street');
    const [initialCenter] = useState(readLastLocation);
    // Follow the user's position until they pan the map or pick a pharmacy;
    // a shared link opens on its pharmacy instead.
    const [following, setFollowing] = useState(selectedId === null);

    const duties = useQuery(dutiesQuery);
    const geo = useGeolocation();
    const online = useOnline();
    const now = useNow();

    const all = useMemo(
        () => duties.data?.pharmacies.filter(hasCoordinates) ?? [],
        [duties.data]
    );

    // Re-evaluated every minute, so shifts that end drop off the map and
    // shifts that start light up without a reload.
    const states = useMemo(
        () => new Map(all.map((p) => [p.id, shiftState(p, now)])),
        [all, now]
    );
    const pharmacies = useMemo(
        () => all.filter((p) => states.get(p.id) !== 'ended'),
        [all, states]
    );
    const upcomingIds = useMemo(
        () =>
            new Set(
                pharmacies
                    .filter((p) => states.get(p.id) === 'upcoming')
                    .map((p) => p.id)
            ),
        [pharmacies, states]
    );

    const rows = useMemo<PanelRow[]>(() => {
        const origin = geo.position;
        const withDistance = pharmacies.map((pharmacy) => ({
            pharmacy,
            state: states.get(pharmacy.id) ?? ('unknown' as ShiftState),
            distanceKm: origin
                ? distanceKm(origin, {
                      latitude: pharmacy.lat,
                      longitude: pharmacy.lng,
                  })
                : null,
        }));
        if (!origin) {
            return withDistance.toSorted(
                (a, b) => SHIFT_RANK[a.state] - SHIFT_RANK[b.state]
            );
        }
        const score = (row: PanelRow) =>
            (row.distanceKm ?? 0) +
            (row.state === 'upcoming' ? UPCOMING_PENALTY_KM : 0);
        return withDistance.toSorted((a, b) => score(a) - score(b));
    }, [pharmacies, states, geo.position]);

    const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
    const selected =
        selectedId === null ? null : (byId.get(selectedId) ?? null);
    const selectedDistance =
        selected && geo.position
            ? distanceKm(geo.position, {
                  latitude: selected.lat,
                  longitude: selected.lng,
              })
            : null;

    const select = useCallback(
        (id: number | null) => {
            void navigate({
                search: id === null ? {} : { eczane: id },
                replace: true,
            });
        },
        [navigate]
    );

    const focusPharmacy = useCallback(
        (pharmacy: MappedPharmacy) => {
            setFollowing(false);
            select(pharmacy.id);
            mapRef.current?.flyTo({
                latitude: pharmacy.lat,
                longitude: pharmacy.lng,
            });
        },
        [select]
    );

    // The first fix flies in; later fixes glide the camera along.
    const hasCentered = useRef(false);
    useEffect(() => {
        if (!geo.position || !following) return;
        if (hasCentered.current) {
            mapRef.current?.panTo(geo.position);
        } else {
            hasCentered.current = true;
            mapRef.current?.flyTo(geo.position);
        }
    }, [geo.position, following]);

    // A shared link (?eczane=) centers on that pharmacy once data arrives.
    const hasFocusedLink = useRef(false);
    useEffect(() => {
        if (hasFocusedLink.current || !selected) return;
        hasFocusedLink.current = true;
        mapRef.current?.flyTo({
            latitude: selected.lat,
            longitude: selected.lng,
        });
    }, [selected]);

    useEffect(() => {
        if (
            geo.status === 'denied' ||
            geo.status === 'unavailable' ||
            geo.status === 'outside'
        ) {
            toast.error(GEOLOCATION_MESSAGES[geo.status]);
        }
    }, [geo.status]);

    const warnedFarAway = useRef(false);
    useEffect(() => {
        if (!geo.position || rows.length === 0 || warnedFarAway.current) return;
        const closest = Math.min(...rows.map((row) => row.distanceKm ?? 0));
        if (closest > FAR_AWAY_KM) {
            warnedFarAway.current = true;
            toast.warning(
                'Bulunduğunuz il için bu gece nöbet listesi yayınlanmamış olabilir. Lütfen başka kaynakları da kontrol edin.'
            );
        }
    }, [rows, geo.position]);

    useEffect(() => {
        if (duties.isError) toast.error('Eczane bilgileri yüklenemedi');
    }, [duties.isError]);

    const locate = useCallback(() => {
        setFollowing(true);
        if (geo.position) {
            hasCentered.current = true;
            mapRef.current?.flyTo(geo.position);
        } else {
            geo.start();
        }
    }, [geo]);

    const navigation = (
        <NavigationControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onLocate={locate}
            locating={geo.status === 'locating'}
            following={following && geo.position !== null}
        />
    );

    return (
        <main className="relative h-dvh w-full overflow-hidden">
            <PharmacyMap
                ref={mapRef}
                styleId={styleId}
                pharmacies={pharmacies}
                upcomingIds={upcomingIds}
                selectedId={selected?.id ?? null}
                userLocation={geo.position}
                initialCenter={initialCenter}
                onSelect={(id) => {
                    if (id !== null) setFollowing(false);
                    select(id);
                }}
                onUserMove={() => setFollowing(false)}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-4 [&>*]:pointer-events-auto">
                <MapStyleSelector value={styleId} onChange={setStyleId} />
                <div className="flex flex-col items-end gap-2">
                    <InfoDialog
                        missingCities={duties.data?.missingCities ?? []}
                    />
                    <div className="md:hidden">{navigation}</div>
                </div>
            </div>

            <div className="absolute bottom-4 right-4 hidden md:block">
                {navigation}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-4 md:left-4 md:w-[380px] md:p-0">
                {selected ? (
                    <PharmacyCard
                        pharmacy={selected}
                        state={shiftState(selected, now)}
                        now={now}
                        distanceKm={selectedDistance}
                        onClose={() => select(null)}
                    />
                ) : (
                    <NearbyPanel
                        date={duties.data?.date ?? null}
                        rows={rows}
                        hasLocation={geo.position !== null}
                        accuracyM={geo.position?.accuracy ?? null}
                        geolocation={geo.status}
                        offlineSince={
                            online ? null : (duties.data?.generatedAt ?? null)
                        }
                        loading={duties.isPending}
                        error={duties.isError && !duties.data}
                        onRetry={() => void duties.refetch()}
                        onLocate={locate}
                        onSelect={focusPharmacy}
                    />
                )}
            </div>
        </main>
    );
}

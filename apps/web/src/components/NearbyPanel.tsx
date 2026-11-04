import {
    ChevronRight,
    CloudOff,
    LocateFixed,
    Navigation2,
    Phone,
    Search,
} from 'lucide-react';
import {
    useDeferredValue,
    useMemo,
    useRef,
    useState,
    type PointerEvent,
} from 'react';

import { Button } from '@/components/ui/button';
import { surface } from '@/components/ui/surface';
import { preferredDirectionsUrl } from '@/lib/directions';
import {
    formatDistance,
    pharmacyDisplayName,
    searchKey,
    toTitleCaseTr,
} from '@/lib/format';
import type { MappedPharmacy } from '@/lib/geo';
import type { ShiftState } from '@/lib/shift';
import type { GeolocationStatus } from '@/lib/use-geolocation';
import { cn } from '@/lib/utils';

const MAX_ROWS = 60;
// Beyond this the fix is network/IP based and distances are rough.
const LOW_ACCURACY_M = 500;
// iOS-style sheet curve: quick start, long soft settle.
const SHEET_EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]';
const DRAG_THRESHOLD_PX = 24;

export interface PanelRow {
    pharmacy: MappedPharmacy;
    state: ShiftState;
    distanceKm: number | null;
}

interface NearbyPanelProps {
    /** The duty list has loaded at least once. */
    ready: boolean;
    /** Already sorted: nearest (and open) first. */
    rows: readonly PanelRow[];
    hasLocation: boolean;
    accuracyM: number | null;
    geolocation: GeolocationStatus;
    /** When offline, the time the shown (cached) list was built. */
    offlineSince: string | null;
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    onLocate: () => void;
    onSelect: (pharmacy: MappedPharmacy) => void;
}

const clock = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
});

function useFilteredRows(rows: readonly PanelRow[], query: string): PanelRow[] {
    const index = useMemo(
        () =>
            new Map(
                rows.map(({ pharmacy: p }) => [
                    p.id,
                    searchKey(`${p.name} ${p.district} ${p.city} ${p.address}`),
                ])
            ),
        [rows]
    );

    return useMemo(() => {
        const needle = searchKey(query.trim());
        if (!needle) return rows.slice(0, MAX_ROWS);
        const terms = needle.split(/\s+/);
        const matches: PanelRow[] = [];
        for (const row of rows) {
            const haystack = index.get(row.pharmacy.id) ?? '';
            if (terms.every((term) => haystack.includes(term))) {
                matches.push(row);
                if (matches.length === MAX_ROWS) break;
            }
        }
        return matches;
    }, [rows, query, index]);
}

function LiveDot({ className }: { className?: string }) {
    return (
        <span className={cn('relative flex h-2 w-2', className)}>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
    );
}

function ShiftTag({ row }: { row: PanelRow }) {
    if (row.state === 'open') {
        return (
            <span className="text-xs font-medium text-emerald-600">Açık</span>
        );
    }
    if (row.state === 'upcoming' && row.pharmacy.startsAt) {
        return (
            <span className="text-xs text-muted-foreground">
                Nöbet {clock.format(new Date(row.pharmacy.startsAt))}
            </span>
        );
    }
    return null;
}

function NearestHighlight({
    row,
    onSelect,
}: {
    row: PanelRow;
    onSelect: (pharmacy: MappedPharmacy) => void;
}) {
    const { pharmacy, distanceKm } = row;
    return (
        <div className="mx-3 mb-3 rounded-lg bg-muted/60 p-3 animate-in fade-in-0 zoom-in-95 duration-300">
            <button
                type="button"
                onClick={() => onSelect(pharmacy)}
                className="flex w-full items-start gap-3 text-left"
            >
                <span className="min-w-0 flex-1">
                    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        En yakın nöbetçi
                    </span>
                    <span className="block truncate text-base font-semibold text-card-foreground">
                        {pharmacyDisplayName(pharmacy.name)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                        {toTitleCaseTr(pharmacy.district)}, {pharmacy.city}
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 pt-4">
                    {distanceKm !== null && (
                        <span className="text-lg font-semibold tabular-nums leading-none text-card-foreground">
                            {formatDistance(distanceKm)}
                        </span>
                    )}
                    <ShiftTag row={row} />
                </span>
            </button>
            <div className="mt-3 flex gap-2">
                {pharmacy.phone && (
                    <Button asChild size="sm" className="h-9 flex-1">
                        <a href={`tel:${pharmacy.phone}`}>
                            <Phone />
                            Ara
                        </a>
                    </Button>
                )}
                <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-9 flex-1"
                >
                    <a
                        href={preferredDirectionsUrl(
                            pharmacy.lat,
                            pharmacy.lng
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Navigation2 />
                        Yol tarifi
                    </a>
                </Button>
            </div>
        </div>
    );
}

function Skeleton() {
    const shine =
        'animate-shine rounded bg-[length:400%_100%] bg-[linear-gradient(110deg,hsl(var(--muted)),45%,hsl(var(--background)),55%,hsl(var(--muted)))]';
    return (
        <div className="space-y-3 px-4 pb-4 pt-1" aria-hidden>
            <div className={cn(shine, 'h-16 w-full rounded-lg')} />
            <div className={cn(shine, 'h-4 w-2/3')} />
            <div className={cn(shine, 'h-3 w-1/2')} />
        </div>
    );
}

export function NearbyPanel({
    ready,
    rows: allRows,
    hasLocation,
    accuracyM,
    geolocation,
    offlineSince,
    loading,
    error,
    onRetry,
    onLocate,
    onSelect,
}: NearbyPanelProps) {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);
    const rows = useFilteredRows(allRows, deferredQuery);
    const searching = deferredQuery.trim().length > 0;
    const open = expanded || searching;
    const askForLocation =
        !hasLocation && geolocation !== 'locating' && geolocation !== 'outside';
    const onDutyCount = allRows.filter(
        (row) => row.state !== 'upcoming'
    ).length;
    const nearest = hasLocation ? allRows[0] : undefined;
    // The highlight card already shows the nearest one.
    const listRows = nearest && !searching ? rows.slice(1) : rows;

    // Swipe the handle up or down to open or close; a tap toggles.
    const dragStart = useRef<number | null>(null);
    const onHandleDown = (event: PointerEvent) => {
        dragStart.current = event.clientY;
    };
    const onHandleUp = (event: PointerEvent) => {
        if (dragStart.current === null) return;
        const dy = event.clientY - dragStart.current;
        dragStart.current = null;
        if (dy < -DRAG_THRESHOLD_PX) setExpanded(true);
        else if (dy > DRAG_THRESHOLD_PX) setExpanded(false);
        else setExpanded((value) => !value);
    };

    return (
        <section
            aria-label="Nöbetçi eczane listesi"
            className={cn(
                surface,
                'pointer-events-auto flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-6 duration-500 ease-out'
            )}
        >
            <button
                type="button"
                onPointerDown={onHandleDown}
                onPointerUp={onHandleUp}
                aria-expanded={open}
                aria-label={open ? 'Listeyi daralt' : 'Listeyi genişlet'}
                className="flex w-full touch-none flex-col items-stretch px-4 pb-3 pt-2 text-left md:pointer-events-none md:pt-4"
            >
                <span className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/30 md:hidden" />
                <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                        <span className="block text-base font-semibold tracking-tight text-card-foreground">
                            {hasLocation
                                ? 'Size en yakın nöbetçiler'
                                : 'Nöbetçi eczaneler'}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {ready ? (
                                <>
                                    <LiveDot />
                                    {onDutyCount} eczane şu an nöbette
                                </>
                            ) : (
                                'Liste yükleniyor…'
                            )}
                        </span>
                    </span>
                    <ChevronRight
                        className={cn(
                            'h-4 w-4 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-300 md:hidden',
                            open && 'rotate-90'
                        )}
                    />
                </span>
            </button>

            {offlineSince && (
                <p className="mx-3 mb-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground animate-in fade-in-0">
                    <CloudOff className="h-3.5 w-3.5 shrink-0" />
                    Çevrimdışı. {clock.format(new Date(offlineSince))}{' '}
                    itibarıyla kaydedilen liste gösteriliyor.
                </p>
            )}

            {error ? (
                <div className="mx-3 mb-3 flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="text-muted-foreground">
                        Eczane bilgileri yüklenemedi.
                    </span>
                    <Button size="sm" variant="outline" onClick={onRetry}>
                        Tekrar dene
                    </Button>
                </div>
            ) : loading ? (
                <Skeleton />
            ) : nearest && !searching ? (
                <NearestHighlight row={nearest} onSelect={onSelect} />
            ) : askForLocation && !searching ? (
                <div className="mx-3 mb-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 animate-in fade-in-0 duration-300">
                    <p className="text-xs leading-snug text-muted-foreground">
                        Konumunuzu paylaşın, size en yakın nöbetçiyi gösterelim.
                    </p>
                    <Button
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={onLocate}
                    >
                        <LocateFixed />
                        Konumumu bul
                    </Button>
                </div>
            ) : null}

            {/* Height animates through grid rows: no measuring, no layout jank. */}
            <div
                className={cn(
                    'grid transition-[grid-template-rows] duration-300 md:grid-rows-[1fr]',
                    SHEET_EASE,
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="border-t border-border px-3 pb-2 pt-3">
                        <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-shadow focus-within:ring-2 focus-within:ring-ring">
                            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Eczane, mahalle, ilçe veya il ara"
                                className="h-full w-full bg-transparent outline-none placeholder:text-muted-foreground"
                                enterKeyHint="search"
                            />
                        </label>
                        {accuracyM !== null && accuracyM > LOW_ACCURACY_M && (
                            <p className="mt-2 text-xs text-muted-foreground">
                                Konum hassasiyeti düşük (~
                                {formatDistance(accuracyM / 1000)}); mesafeler
                                yaklaşıktır.
                            </p>
                        )}
                    </div>

                    <div className="max-h-[min(46dvh,420px)] overflow-y-auto overscroll-contain px-1.5 pb-1.5">
                        {listRows.length === 0 && !loading ? (
                            <p className="px-2.5 py-4 text-center text-sm text-muted-foreground">
                                Aramanızla eşleşen eczane yok.
                            </p>
                        ) : (
                            <ul>
                                {listRows.map((row, index) => (
                                    <li
                                        key={row.pharmacy.id}
                                        className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both duration-300"
                                        style={{
                                            animationDelay: `${Math.min(index, 12) * 22}ms`,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onSelect(row.pharmacy)
                                            }
                                            className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-[background-color,transform] duration-150 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none active:scale-[0.98]"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-card-foreground">
                                                    {pharmacyDisplayName(
                                                        row.pharmacy.name
                                                    )}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {toTitleCaseTr(
                                                        row.pharmacy.district
                                                    )}
                                                    , {row.pharmacy.city}
                                                </span>
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end gap-0.5">
                                                {row.distanceKm !== null && (
                                                    <span className="text-xs tabular-nums text-muted-foreground">
                                                        {formatDistance(
                                                            row.distanceKm
                                                        )}
                                                    </span>
                                                )}
                                                <ShiftTag row={row} />
                                            </span>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

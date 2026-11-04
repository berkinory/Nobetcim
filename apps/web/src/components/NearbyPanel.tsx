import {
    ChevronDown,
    ChevronRight,
    CloudOff,
    LocateFixed,
    Search,
} from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    formatDistance,
    formatDutyDate,
    pharmacyDisplayName,
    searchKey,
    toTitleCaseTr,
} from '@/lib/format';
import type { MappedPharmacy } from '@/lib/geo';
import { type ShiftState } from '@/lib/shift';
import type { GeolocationStatus } from '@/lib/use-geolocation';
import { cn } from '@/lib/utils';

const MAX_ROWS = 60;
// Beyond this the fix is network/IP based and distances are rough.
const LOW_ACCURACY_M = 500;

export interface PanelRow {
    pharmacy: MappedPharmacy;
    state: ShiftState;
    distanceKm: number | null;
}

interface NearbyPanelProps {
    date: string | null;
    /** Already sorted: open shifts first, then by distance. */
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

function ShiftTag({ row }: { row: PanelRow }) {
    if (row.state === 'open') {
        return (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Açık
            </span>
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

export function NearbyPanel({
    date,
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
    // On phones the collapsed panel only peeks at the nearest pharmacy.
    const collapsed = !expanded && !searching;
    const askForLocation =
        !hasLocation && geolocation !== 'locating' && geolocation !== 'outside';
    const onDutyCount = allRows.filter(
        (row) => row.state !== 'upcoming'
    ).length;

    return (
        <section
            aria-label="Nöbetçi eczane listesi"
            className="pointer-events-auto flex max-h-[min(60dvh,560px)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
            <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex items-center justify-between gap-2 px-4 pb-2 pt-3 text-left md:pointer-events-none"
                aria-expanded={expanded}
            >
                <div className="min-w-0">
                    <h1 className="text-sm font-semibold text-card-foreground">
                        {hasLocation
                            ? 'Size en yakın nöbetçiler'
                            : 'Nöbetçi eczaneler'}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        {date
                            ? `${formatDutyDate(date)} nöbeti · ${onDutyCount} eczane şu an nöbette`
                            : 'Yükleniyor…'}
                    </p>
                </div>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform md:hidden',
                        expanded && 'rotate-180'
                    )}
                />
            </button>

            <div className="px-3 pb-2">
                <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onFocus={() => setExpanded(true)}
                        placeholder="Eczane, mahalle, ilçe veya il ara"
                        className="h-full w-full bg-transparent outline-none placeholder:text-muted-foreground"
                        enterKeyHint="search"
                    />
                </label>
            </div>

            {offlineSince && (
                <p className="mx-3 mb-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <CloudOff className="h-3.5 w-3.5 shrink-0" />
                    Çevrimdışısınız. Liste{' '}
                    {clock.format(new Date(offlineSince))} itibarıyla kayıtlı
                    haliyle gösteriliyor.
                </p>
            )}

            {accuracyM !== null && accuracyM > LOW_ACCURACY_M && !searching && (
                <p className="mx-3 mb-2 text-xs text-muted-foreground">
                    Konum hassasiyeti düşük (~{formatDistance(accuracyM / 1000)}
                    ). Mesafeler yaklaşıktır.
                </p>
            )}

            {askForLocation && !searching && (
                <div className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                        Konumunuzu paylaşın, en yakın nöbetçileri sıralayalım.
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
            )}

            <div
                className={cn(
                    'overflow-y-auto overscroll-contain px-1.5 pb-1.5',
                    collapsed && 'max-md:max-h-[62px] max-md:overflow-hidden'
                )}
            >
                {error ? (
                    <div className="flex items-center justify-between gap-3 px-2.5 py-3 text-sm">
                        <span className="text-muted-foreground">
                            Eczane bilgileri yüklenemedi.
                        </span>
                        <Button size="sm" variant="outline" onClick={onRetry}>
                            Tekrar dene
                        </Button>
                    </div>
                ) : loading ? (
                    <div className="space-y-2 px-2.5 py-2" aria-hidden>
                        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                ) : rows.length === 0 ? (
                    <p className="px-2.5 py-3 text-sm text-muted-foreground">
                        Sonuç bulunamadı.
                    </p>
                ) : (
                    <ul>
                        {rows.map((row) => {
                            const { pharmacy, distanceKm } = row;
                            return (
                                <li key={pharmacy.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(pharmacy)}
                                        className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-card-foreground">
                                                {pharmacyDisplayName(
                                                    pharmacy.name
                                                )}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {toTitleCaseTr(
                                                    pharmacy.district
                                                )}
                                                , {pharmacy.city}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                                            {distanceKm !== null && (
                                                <span className="text-xs tabular-nums text-muted-foreground">
                                                    {formatDistance(distanceKm)}
                                                </span>
                                            )}
                                            <ShiftTag row={row} />
                                        </span>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}

import type { ApiError, DutiesResponse } from '@nobetcim/contract';
import { queryOptions } from '@tanstack/react-query';

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(path, { signal });
    if (!response.ok) {
        const body = (await response
            .json()
            .catch(() => null)) as ApiError | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
    }
    return (await response.json()) as T;
}

export const dutiesQuery = queryOptions({
    queryKey: ['duties', 'active'],
    queryFn: ({ signal }) => getJson<DutiesResponse>('/api/duties', signal),
    staleTime: 5 * 60_000,
    // Still fire the request offline: the service worker answers it from the
    // last saved list.
    networkMode: 'offlineFirst',
    // The active list flips at the morning handover; refresh while open.
    refetchInterval: 30 * 60_000,
});

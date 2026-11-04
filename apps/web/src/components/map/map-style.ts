import type { RequestTransformFunction } from 'maplibre-gl';

import type { ColorScheme } from '@/lib/use-color-scheme';

export type MapStyleId = ColorScheme;

// The custom "Pharmacy" style is built on MapTiler Dataviz; Dataviz Dark is
// its night counterpart with the same layer structure.
const STYLE_PATHS: Record<MapStyleId, string> = {
    light: '01976890-9b0b-705a-b6ef-fd4f77dd0100',
    dark: 'dataviz-dark',
};

const MAPTILER_ORIGIN = 'https://api.maptiler.com';

export function mapStyleUrl(style: MapStyleId): string {
    const key = import.meta.env.VITE_MAPTILER_API_KEY ?? '';
    return `${MAPTILER_ORIGIN}/maps/${STYLE_PATHS[style]}/style.json?key=${key}`;
}

// The key is restricted to the production origin, so dev servers route
// MapTiler through the Vite proxy, which presents that origin.
export const transformRequest: RequestTransformFunction | undefined =
    import.meta.env.DEV
        ? (url) =>
              url.startsWith(MAPTILER_ORIGIN)
                  ? {
                        url: url.replace(
                            MAPTILER_ORIGIN,
                            `${window.location.origin}/maptiler`
                        ),
                    }
                  : undefined
        : undefined;

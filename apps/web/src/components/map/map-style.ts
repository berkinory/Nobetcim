import type { RequestTransformFunction } from 'maplibre-gl';

const PHARMACY_STYLE = '01976890-9b0b-705a-b6ef-fd4f77dd0100';

const MAPTILER_ORIGIN = 'https://api.maptiler.com';

export function mapStyleUrl(): string {
    const key = import.meta.env.VITE_MAPTILER_API_KEY ?? '';
    return `${MAPTILER_ORIGIN}/maps/${PHARMACY_STYLE}/style.json?key=${key}`;
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

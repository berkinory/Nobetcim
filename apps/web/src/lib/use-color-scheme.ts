import { useSyncExternalStore } from 'react';

export type ColorScheme = 'light' | 'dark';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function subscribe(onChange: () => void) {
    const media = query();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
}

/** The OS colour scheme, live: flips with the system setting. */
export function useColorScheme(): ColorScheme {
    return useSyncExternalStore(
        subscribe,
        () => (query().matches ? 'dark' : 'light'),
        () => 'light'
    );
}

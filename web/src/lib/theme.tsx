'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface ThemeStore {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: 'dark',
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'app-theme',
        }
    )
);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);
    const { theme } = useThemeStore();

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div style={{ visibility: 'hidden' }}>{children}</div>;
    }

    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme={theme}
            value={{
                light: 'light',
                dark: 'dark',
            }}
            enableSystem={false}
            forcedTheme={theme}
            storageKey="app-theme"
        >
            {children}
        </NextThemesProvider>
    );
}

export const useTheme = () => useThemeStore((state) => state.theme);
export const useThemeActions = () => {
    const setTheme = useThemeStore((state) => state.setTheme);
    return { setTheme };
};

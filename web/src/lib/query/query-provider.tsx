'use client';

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 10 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
        mutations: {
            onError: (error: Error) => {
                console.error(error.message);
            },
        },
    },
});

type QueryProviderProps = {
    children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

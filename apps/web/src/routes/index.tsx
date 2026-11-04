import { createFileRoute } from '@tanstack/react-router';

import { dutiesQuery } from '@/lib/api';

import { HomePage } from './-home/HomePage';

interface HomeSearch {
    eczane?: number;
}

export const Route = createFileRoute('/')({
    validateSearch: (search: Record<string, unknown>): HomeSearch => {
        const id = Number(search.eczane);
        return Number.isInteger(id) && id > 0 ? { eczane: id } : {};
    },
    // Start the request before the map chunk finishes loading.
    loader: ({ context }) => {
        void context.queryClient.prefetchQuery(dutiesQuery);
    },
    component: HomePage,
});

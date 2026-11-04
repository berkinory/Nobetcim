import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { loadAnalytics } from './lib/invisit';
import { routeTree } from './routeTree.gen';
import './styles.css';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 2 } },
});

const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    </StrictMode>
);

loadAnalytics();

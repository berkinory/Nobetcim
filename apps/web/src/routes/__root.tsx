import type { QueryClient } from '@tanstack/react-query';
import {
    createRootRouteWithContext,
    Link,
    Outlet,
} from '@tanstack/react-router';
import { Home } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

function NotFound() {
    return (
        <main className="flex h-full flex-col items-center justify-center p-8 text-center">
            <h1 className="mb-6 text-8xl font-bold">404</h1>
            <p className="mb-2 text-2xl font-semibold">Hop! Sayfa Bulunamadı</p>
            <p className="mb-8 max-w-lg text-lg opacity-80">
                Aradığınız sayfa bulunamadı veya taşındı.
            </p>
            <Button size="lg" asChild>
                <Link to="/">
                    <Home />
                    Ana Sayfa
                </Link>
            </Button>
        </main>
    );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
    {
        component: () => (
            <>
                <Toaster position="top-center" duration={4000} />
                <Outlet />
            </>
        ),
        notFoundComponent: NotFound,
    }
);

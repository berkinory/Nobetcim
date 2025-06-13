import { Link } from '@/components/Link';
import { Home } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: '404 | Page Not Found',
    description: 'The page you are looking for could not be found',
    robots: {
        index: false,
        follow: false,
    },
};

export default function RootNotFound() {
    return (
        <>
            <main className="min-h-screen flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <h1 className="text-9xl font-bold mb-6">404</h1>
                    <p className="text-2xl font-semibold mb-2">
                        Oops! Page Not Found
                    </p>
                    <p className="text-lg max-w-lg opacity-80 mb-8">
                        The page you're looking for doesn't exist or has been
                        moved.
                    </p>
                    <div className="flex">
                        <Button variant="default" size="lg" asChild>
                            <Link href="/">
                                <Home className="mr-2 h-4 w-4" />
                                Home Page
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>
        </>
    );
}

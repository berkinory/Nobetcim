import './globals.css';
import { ThemeProvider } from '@/lib/theme';
import { OpenPanelComponent } from '@openpanel/nextjs';
import { Toaster } from '@/components/ui/sonner';
import type React from 'react';
import { cn } from '@/lib/utils';
import { Geist } from 'next/font/google';
import localfont from 'next/font/local';
import {
    seoConfig,
    getMetadata,
    getStaticOpenGraph,
    getGoogleVerification,
    getTwitterCard,
} from '@/components/seo/seo.config';
import SEOProvider from '@/components/seo/SEOProvider';
import { QueryProvider } from '@/lib/query/query-provider';

export async function generateMetadata() {
    const { title, description, keywords } = getMetadata();
    const openGraph = getStaticOpenGraph();
    const googleVerification = getGoogleVerification();
    const twitterCard = getTwitterCard();

    return {
        metadataBase: new URL(seoConfig.site.url || 'http://localhost:3000'),
        title,
        description,
        keywords: keywords.join(', '),
        openGraph: {
            ...openGraph,
            title,
            description,
            images: openGraph.images,
        },
        twitter: {
            ...twitterCard,
            title,
            description,
            images: openGraph.images,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-image-preview': 'large',
                'max-video-preview': -1,
                'max-snippet': -1,
            },
        },
        ...(googleVerification && {
            verification: { google: googleVerification },
        }),
        icons: {
            icon: '/favicon.ico',
        },
    };
}

const geist = Geist({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap',
});

const menlo = localfont({
    src: '../../public/fonts/Menlo-Regular.woff2',
    variable: '--font-mono',
    display: 'swap',
});

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="tr"
            suppressHydrationWarning
            className={cn(geist.variable, menlo.variable, 'h-full')}
        >
            <body className="font-sans h-full overflow-hidden">
                <Toaster position="top-right" duration={4000} />
                <OpenPanelComponent
                    clientId="af02c540-1799-4bf5-8a4f-820094e7d26e"
                    cdnUrl="/op1.js"
                    trackScreenViews={true}
                    trackOutgoingLinks={true}
                    trackAttributes={true}
                />
                <SEOProvider>
                    <QueryProvider>
                        <ThemeProvider>
                            <div className="h-full overflow-hidden">
                                {children}
                            </div>
                        </ThemeProvider>
                    </QueryProvider>
                </SEOProvider>
            </body>
        </html>
    );
}

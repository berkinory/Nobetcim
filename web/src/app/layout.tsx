import './globals.css';
import { ThemeProvider } from '@/lib/theme';
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
import { Databuddy } from '@databuddy/sdk';

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
        manifest: '/manifest.webmanifest',
        appleWebApp: {
            capable: true,
            statusBarStyle: 'default',
            title: 'Nobetcim',
        },
        other: {
            'mobile-web-app-capable': 'yes',
            'apple-mobile-web-app-capable': 'yes',
            'apple-mobile-web-app-status-bar-style': 'default',
            'apple-mobile-web-app-title': 'Nobetcim',
            'application-name': 'Nobetcim',
            'msapplication-TileColor': '#000000',
            'theme-color': '#000000',
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
                <SEOProvider>
                    <QueryProvider>
                        <ThemeProvider>
                            <Databuddy
                                clientId="zIxiSsxB-qEREnrg5Vjr8"
                                trackWebVitals={true}
                                enableBatching={true}
                            />
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

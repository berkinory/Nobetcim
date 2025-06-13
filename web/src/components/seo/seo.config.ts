type SiteMetadata = {
    title: string;
    description: string;
    keywords: string[];
};

export const seoConfig = {
    site: {
        name: 'Pingvolt',
        url: process.env.NEXT_PUBLIC_URL,
        publisher: 'berkinory',
        author: {
            name: 'berkinory',
            url: 'mirac.dev',
        },
    },

    metadata: {
        title: 'Pingvolt | Modern Website Uptime & API Monitoring',
        description:
            'Monitor your websites & API endpoints with Pingvolt. Real-time alerts, uptime tracking, performance monitoring, downtime notifications.',
        keywords: [
            'uptime',
            'monitor',
            'heartbeat',
            'track',
            'ping',
            'alert',
            'monitoring',
            'website monitoring',
            'api monitoring',
            'downtime alerts',
            'performance monitoring',
        ],
    } as SiteMetadata,

    openGraph: {
        images: [
            {
                url: '/og.webp',
                width: 1200,
                height: 630,
                alt: 'Pingvolt',
            },
        ],
        type: 'website',
        siteName: 'Pingvolt',
    },

    twitter: {
        card: 'summary_large_image',
        site: '@berkinory',
        creator: '@berkinory',
    },

    verifications: {
        google: '',
    },
};

export function getSiteUrl(path = ''): string {
    return `${seoConfig.site.url}${path}`;
}

export function getMetadata() {
    return {
        title: seoConfig.metadata.title || seoConfig.site.name,
        description: seoConfig.metadata.description || '',
        keywords: seoConfig.metadata.keywords || [],
    };
}

export function getGoogleVerification() {
    return seoConfig.verifications.google || null;
}

export function getStaticOpenGraph() {
    return {
        ...seoConfig.openGraph,
        twitter: seoConfig.twitter,
    };
}

export function getTwitterCard() {
    return seoConfig.twitter;
}

export type SeoConfig = typeof seoConfig;

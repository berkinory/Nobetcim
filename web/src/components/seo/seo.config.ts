type SiteMetadata = {
    title: string;
    description: string;
    keywords: string[];
};

export const seoConfig = {
    site: {
        name: 'Nöbetçim',
        url: process.env.NEXT_PUBLIC_URL,
        publisher: 'berkinory',
        author: {
            name: 'berkinory',
            url: 'mirac.dev',
        },
    },

    metadata: {
        title: 'Nöbetçim',
        description: 'Size en yakın nöbetçi eczaneleri bulun.',
        keywords: [
            'eczane',
            'eczaneler',
            'nöbetçi eczaneler',
            'nöbetçi eczane',
            'nöbetçi eczane bul',
            'nöbetçi eczane arama',
            'nöbetçi eczane harita',
            'nöbetçi eczane yakını',
        ],
    } as SiteMetadata,

    openGraph: {
        images: [
            {
                url: '/og.webp',
                width: 1200,
                height: 630,
                alt: 'En Yakın Nöbetçi Eczaneler',
            },
        ],
        type: 'website',
        siteName: 'Nöbetçim',
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

type SiteMetadata = {
    title: string;
    description: string;
    keywords: string[];
};

export const seoConfig = {
    site: {
        name: 'Nobetcim',
        url: process.env.NEXT_PUBLIC_URL,
        publisher: 'berkinory',
        author: {
            name: 'berkinory',
            url: 'mirac.dev',
        },
    },

    metadata: {
        title: 'Nobetcim | En Yakın Nöbetçi Eczane Bilgileri',
        description:
            "Türkiye'nin en kapsamlı nöbetçi eczane bulma platformu. Size en yakın nöbetçi eczaneleri harita üzerinde görün, adres ve telefon bilgilerine ulaşın. 7/24 nöbetçi eczane sorgulama.",
        keywords: [
            'nöbetçi eczane',
            'nöbetçi eczane bul',
            'en yakın nöbetçi eczane',
            'nöbetçi eczane harita',
            'nöbetçi eczane arama',
            'nöbetçi eczane sorgulama',
            'nöbetçi eczane yakınımda',
            'nöbetçi eczane adres',
            'nöbetçi eczane telefon',
            'eczane nöbetçi',
            'gece nöbetçi eczane',
            'hafta sonu nöbetçi eczane',
            'nöbetçi eczane istanbul',
            'nöbetçi eczane ankara',
            'acil eczane',
            '24 saat eczane',
            'gece eczane',
            'tatil eczane',
            'pazar eczane',
            'türkiye nöbetçi eczane',
            'online nöbetçi eczane',
            'nöbetçi eczane listesi',
            'nöbetçi eczane rehberi',
        ],
    } as SiteMetadata,

    openGraph: {
        images: [
            {
                url: '/og.webp',
                width: 1200,
                height: 630,
                alt: 'Nobetcim | En Yakın Nöbetçi Eczane Bilgileri',
                type: 'image/webp',
            },
        ],
        type: 'website',
        siteName: 'Nobetcim - Nöbetçi Eczane Bulma Platformu',
        locale: 'tr_TR',
        url: '/',
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
    const baseUrl = seoConfig.site.url || 'http://localhost:3000';
    return {
        ...seoConfig.openGraph,
        images: seoConfig.openGraph.images.map((img) => ({
            ...img,
            url: img.url.startsWith('http') ? img.url : `${baseUrl}${img.url}`,
        })),
    };
}

export function getTwitterCard() {
    return seoConfig.twitter;
}

export type SeoConfig = typeof seoConfig;

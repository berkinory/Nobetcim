export default function manifest() {
    return {
        name: 'Nobetcim',
        short_name: 'Nobetcim',
        description: 'Çevrenizdeki nöbetçi eczaneleri bulun',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        orientation: 'portrait-primary',
        icons: [
            {
                src: '/favicon.ico',
                sizes: '16x16',
                type: 'image/x-icon',
            },
            {
                src: '/nobetcim.webp',
                sizes: '192x192',
                type: 'image/webp',
            },
            {
                src: '/nobetcim.webp',
                sizes: '512x512',
                type: 'image/webp',
            },
        ],
        lang: 'tr',
        scope: '/',
    };
}

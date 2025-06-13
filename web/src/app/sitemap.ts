import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/components/seo/seo.config';

const routes = [
    {
        path: '/',
        priority: 1.0,
        changeFrequency: 'weekly' as const,
    },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes = routes.map((route) => ({
        url: getSiteUrl(route.path),
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
    }));

    return [...staticRoutes];
}

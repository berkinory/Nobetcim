'use client';

import { usePathname } from 'next/navigation';
import { getSiteUrl } from '@/components/seo/seo.config';

interface SEOProviderProps {
    children: React.ReactNode;
}

export default function SEOProvider({ children }: SEOProviderProps) {
    const pathname = usePathname();
    const canonicalUrl = getSiteUrl(pathname);

    return (
        <>
            <link rel="canonical" href={canonicalUrl} />
            {children}
        </>
    );
}

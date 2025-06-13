import { Link } from '@/components/Link';
import StructuredData from '@/components/seo/StructuredData';
import { seoConfig } from '@/components/seo/seo.config';
import { Button } from '@/components/ui/button';

export default function Home() {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: seoConfig.site.name,
        url: seoConfig.site.url || 'http://localhost:3000',
        inLanguage: 'tr',
    };

    return (
        <>
            <StructuredData data={structuredData} />
            <main className="min-h-screen flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <h1 className="text-4xl font-bold mb-6">Pingvolt</h1>
                    <p className="text-xl max-w-lg opacity-80 mb-8">
                        Modern Website Uptime & API Monitoring
                    </p>
                    <div className="flex gap-4">
                        <Link href="/auth">
                            <Button>Get Started</Button>
                        </Link>
                    </div>
                </div>
            </main>
        </>
    );
}

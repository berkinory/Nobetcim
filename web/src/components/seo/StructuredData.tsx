'use client';

import { useInsertionEffect, useRef } from 'react';

type JsonLdValue = string | number | boolean | null | JsonLd | JsonLdValue[];

type JsonLd = {
    '@context': string;
    '@type': string;
    [key: string]: JsonLdValue;
};

export default function StructuredData({ data }: { data: JsonLd | null }) {
    const scriptRef = useRef<HTMLScriptElement | null>(null);

    const scriptString = data ? JSON.stringify(data) : '';

    useInsertionEffect(() => {
        if (!data) return;

        if (!scriptRef.current) {
            const script = document.createElement('script');
            script.setAttribute('type', 'application/ld+json');
            script.textContent = scriptString;
            document.head.appendChild(script);
            scriptRef.current = script;
        } else {
            scriptRef.current.textContent = scriptString;
        }

        return () => {
            if (scriptRef.current) {
                document.head.removeChild(scriptRef.current);
                scriptRef.current = null;
            }
        };
    }, [scriptString, data]);

    return null;
}

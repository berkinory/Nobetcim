const SCRIPT_ID = 'invisit-script';

export function loadAnalytics() {
    if (import.meta.env.DEV || document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://api.invisit.dev/invisit.js';
    script.async = true;
    script.dataset.site = '01a1a62e-6bf8-7569-8ba4-5b465bf551a0';
    script.dataset.collector = 'https://api.invisit.dev';
    script.dataset.respectDnt = 'false';
    script.dataset.respectGpc = 'false';
    script.dataset.requireConsent = 'false';
    document.head.appendChild(script);
}

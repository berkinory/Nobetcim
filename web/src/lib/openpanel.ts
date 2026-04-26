const SCRIPT_ID = 'rybbit-analytics-script';

if (typeof document !== 'undefined' && !document.getElementById(SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://rybbit-api.mirac.dev/api/script.js';
    script.defer = true;
    script.setAttribute('data-site-id', 'da0c48858214');
    document.head.appendChild(script);
}

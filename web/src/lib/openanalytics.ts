const SCRIPT_ID = 'openanalytics-script';

if (typeof document !== 'undefined' && !document.getElementById(SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = '/openanalytics-v0.8.0.js';
    script.defer = true;
    script.dataset.key = 'oa_pk_LmuCS6DQNV4P6Mm1x4MlWOlQchBHxmvW';
    script.dataset.collector = 'https://analytics-c.mirac.dev';
    script.dataset.domain =
        process.env.NEXT_PUBLIC_URL || 'https://nobetcim.app';
    script.dataset.redactQueryKeys =
        'q,query,search,name,first_name,last_name,username,user,user_id,userid,address,message,callbackurl,redirect,redirect_uri,returnurl';
    script.dataset.respectDnt = 'false';
    script.dataset.respectGpc = 'false';
    script.dataset.requireConsent = 'false';
    document.head.appendChild(script);
}

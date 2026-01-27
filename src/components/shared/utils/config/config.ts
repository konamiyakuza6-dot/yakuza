import { LocalStorageConstants, LocalStorageUtils, URLUtils } from '@deriv-com/utils';
import { isStaging } from '../url/helpers';

export const APP_IDS = {
    LOCALHOST: 36300,
    TMP_STAGING: 64584,
    STAGING: 29934,
    STAGING_BE: 29934,
    STAGING_ME: 29934,
    PRODUCTION: 117164,
    PRODUCTION_BE: 117164,
    PRODUCTION_ME: 117164,
};

export const livechat_license_id = 12049137;
export const livechat_client_id = '66aa088aad5a414484c1fd1fa8a5ace7';

export const domain_app_ids = {
    'dbot12.netlify.app': 80491,
    'kingstraders.site': 85821,
    'www.kingstraders.site': 85821,
    'wallacetraders.site': 86003,
    'www.wallacetraders.site': 86003,
    'legoo.site': 85150,
    'www.legoo.site': 85150,
    'makotitraderss.vercel.app': 101585,
    'www.makotitraderss.vercel.app': 101585,
    'www.kenyanhennessy.site': 97088,
    'kenyanhennessy.site': 97088,
    'masterhunter.site': 96223,
    'developmentviewport.netlify.app': 97311,
    'www.developmentviewport.netlify.app': 97311,
    'qtropwinninghub.vercel.app': 107823,
    'www.qtropwinninghub.vercel.app': 107823,
    'qtropwinnershub.site': 107823,
    'www.qtropwinnershub.site': 107823,
};

export const getCurrentProductionDomain = () => {
    // If it's staging, return null to use staging app ID
    if (/^staging\./.test(window.location.hostname)) {
        return null;
    }

    // Check if domain is explicitly configured
    const exactMatch = Object.keys(domain_app_ids).find(domain => window.location.hostname === domain);
    if (exactMatch) {
        return exactMatch;
    }

    // For any other production domain, return the hostname to use production app ID
    return window.location.hostname;
};

export const isProduction = () => {
    const all_domains = Object.keys(domain_app_ids).map(domain => `(www\\.)?${domain.replace('.', '\\.')}`);
    return new RegExp(`^(${all_domains.join('|')})$`, 'i').test(window.location.hostname);
};

export const isTestLink = () => {
    return (
        window.location.origin?.includes('.binary.sx') ||
        window.location.origin?.includes('bot-65f.pages.dev') ||
        isLocal()
    );
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

const getDefaultServerURL = () => {
    const server = 'ws';
    const server_url = `${server}.derivws.com`;

    return server_url;
};

export const getDefaultAppIdAndUrl = () => {
    const server_url = getDefaultServerURL();

    if (isTestLink()) {
        return { app_id: APP_IDS.LOCALHOST, server_url };
    }

    const current_domain = getCurrentProductionDomain() ?? '';
    const app_id = domain_app_ids[current_domain as keyof typeof domain_app_ids] ?? APP_IDS.PRODUCTION;

    return { app_id, server_url };
};

// Default app ID - always 117164
const DEFAULT_APP_ID = 117164;

/**
 * No-op function for backward compatibility - app ID no longer switches
 */
export const switchAppIdAfterTrade = () => {
    // App ID switching is disabled - always use 117164
    return null;
};

// Force update app ID in localStorage on app initialization
export const forceUpdateAppId = () => {
    // Always set to default app ID 117164
    window.localStorage.setItem('config.app_id', DEFAULT_APP_ID.toString());

    return DEFAULT_APP_ID;
};

export const getAppId = () => {
    let app_id = null;

    if (isStaging()) {
        app_id = APP_IDS.STAGING;
    } else if (isTestLink()) {
        app_id = APP_IDS.LOCALHOST;
    } else {
        const current_domain = getCurrentProductionDomain();

        // If domain is explicitly configured, use that app ID
        if (current_domain && domain_app_ids[current_domain as keyof typeof domain_app_ids]) {
            app_id = domain_app_ids[current_domain as keyof typeof domain_app_ids];
        } else {
            // For production domains, always use default app ID 117164
            app_id = DEFAULT_APP_ID;
        }
    }

    // Always force update localStorage with the current app ID
    // This ensures the browser always uses the current app_id
    window.localStorage.setItem('config.app_id', app_id.toString());

    return app_id;
};

export const getSocketURL = () => {
    const local_storage_server_url = window.localStorage.getItem('config.server_url');
    if (local_storage_server_url) return local_storage_server_url;

    const server_url = getDefaultServerURL();

    return server_url;
};

export const checkAndSetEndpointFromUrl = () => {
    if (isTestLink()) {
        const url_params = new URLSearchParams(location.search.slice(1));

        if (url_params.has('qa_server') && url_params.has('app_id')) {
            const qa_server = url_params.get('qa_server') || '';
            const app_id = url_params.get('app_id') || '';

            url_params.delete('qa_server');
            url_params.delete('app_id');

            if (/^(^(www\.)?qa[0-9]{1,4}\.deriv.dev|(.*)\.derivws\.com)$/.test(qa_server) && /^[0-9]+$/.test(app_id)) {
                localStorage.setItem('config.app_id', app_id);
                localStorage.setItem('config.server_url', qa_server.replace(/"/g, ''));
            }

            const params = url_params.toString();
            const hash = location.hash;

            location.href = `${location.protocol}//${location.hostname}${location.pathname}${
                params ? `?${params}` : ''
            }${hash || ''}`;

            return true;
        }
    }

    return false;
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

export const generateOAuthURL = () => {
    const { getOauthURL } = URLUtils;
    const oauth_url = getOauthURL();
    const original_url = new URL(oauth_url);
    const configured_server_url = (LocalStorageUtils.getValue(LocalStorageConstants.configServerURL) ||
        localStorage.getItem('config.server_url') ||
        original_url.hostname) as string;

    const valid_server_urls = ['green.derivws.com', 'red.derivws.com', 'blue.derivws.com'];
    if (
        typeof configured_server_url === 'string'
            ? !valid_server_urls.includes(configured_server_url)
            : !valid_server_urls.includes(JSON.stringify(configured_server_url))
    ) {
        original_url.hostname = configured_server_url;
    }
    return original_url.toString() || oauth_url;
};

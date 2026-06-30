export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body;
        const code = body.code;
        const code_verifier = body.code_verifier;
        const client_id =
            body.client_id ||
            process.env.DERIV_OAUTH_CLIENT_ID ||
            process.env.OAUTH_CLIENT_ID ||
            process.env.CLIENT_ID ||
            process.env.DERIV_LEGACY_APP_ID;
        const redirect_uri =
            body.redirect_uri ||
            process.env.DERIV_REDIRECT_URI ||
            process.env.OAUTH_REDIRECT_URI ||
            process.env.REDIRECT_URI;

        if (!code || !code_verifier || !redirect_uri || !client_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const tokenBaseUrl = process.env.AUTH_BASE_URL || 'https://auth.deriv.com';
        const tokenPath = process.env.TOKEN_ENDPOINT_PATH || '/oauth2/token';
        const tokenUrl = `${tokenBaseUrl.replace(/\/$/, '')}${tokenPath}`;
        console.log('Fetching URL:', tokenUrl);
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id,
                redirect_uri,
                code_verifier,
            }).toString(),
        });

        const text = await response.text();
        console.log('Raw API Response:', text);
        console.log('RESPONSE TYPE:', typeof text);
        console.log('STATUS:', response.status);
        console.log('URL:', response.url);

        if (text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html')) {
            console.error('Endpoint returned HTML instead of JSON. Broken route:', tokenUrl);
        }

        let tokenData;
        try {
            tokenData = text ? JSON.parse(text) : {};
        } catch (err) {
            console.error('JSON Parse Failed');
            console.error(text);
            throw err;
        }
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = ['HttpOnly', 'Path=/', 'SameSite=Lax'];
        if (isProd) {
            cookieOpts.push('Secure');
        }

        const setCookies = [];
        if (tokenData.access_token) {
            const maxAge = Number(tokenData.expires_in) || 3600;
            setCookies.push(
                `deriv_access_token=${encodeURIComponent(tokenData.access_token)}; ${cookieOpts.join('; ')}; Max-Age=${maxAge}`
            );
            setCookies.push(
                `deriv_token_expires=${Date.now() + maxAge * 1000}; ${cookieOpts.join('; ')}`
            );
        }

        if (tokenData.refresh_token) {
            setCookies.push(
                `deriv_refresh_token=${encodeURIComponent(tokenData.refresh_token)}; ${cookieOpts.join('; ')}; Max-Age=604800`
            );
        }

        const appId = process.env.DERIV_LEGACY_APP_ID || process.env.APP_ID || process.env.OAUTH_LEGACY_APP_ID;
        if (appId) {
            setCookies.push(`deriv_app_id=${encodeURIComponent(appId)}; ${cookieOpts.join('; ')}`);
        }

        setCookies.push(
            `logged_state=true; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}`
        );

        if (setCookies.length) {
            res.setHeader('Set-Cookie', setCookies);
        }

        res.status(response.status).json(tokenData);
    } catch (error) {
        return res.status(500).json({
            error: 'token_exchange_failed',
            error_description: error instanceof Error ? error.message : 'Unknown token exchange error',
        });
    }
}

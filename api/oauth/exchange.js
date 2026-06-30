import { URLSearchParams } from 'url';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('OAuth exchange request received at /api/oauth/exchange');
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { code, code_verifier, redirect_uri, client_id } = body || {};

        console.log('[Exchange] Parameters:', {
            client_id,
            redirect_uri,
            code: code ? code.substring(0, 10) + '...' : 'missing',
            code_verifier: code_verifier ? code_verifier.substring(0, 10) + '...' : 'missing',
        });

        if (!code || !code_verifier || !redirect_uri || !client_id) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const tokenUrl = 'https://auth.deriv.com/oauth2/token';
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
        console.log('Raw API Response (Exchange):', text);
        console.log('RESPONSE TYPE:', typeof text);
        console.log('STATUS:', response.status);
        console.log('URL:', response.url);

        if (text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html')) {
            console.error('Endpoint returned HTML instead of JSON. Broken route:', tokenUrl);
            return res.status(500).json({ error: 'Endpoint returned HTML instead of JSON' });
        }

        let tokenData;
        try {
            tokenData = text ? JSON.parse(text) : {};
        } catch (err) {
            console.error('JSON Parse Failed in /api/oauth/exchange');
            console.error(text);
            return res.status(500).json({ error: 'JSON parse failed', details: text });
        }

        if (!response.ok) {
            console.error('[Exchange] Exchange failed on Deriv:', tokenData);
            return res.status(response.status).json(tokenData);
        }

        // Set HttpOnly cookies to store access token and refresh token securely
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

        console.log('[Exchange] Token Exchange Success');
        return res.status(200).json(tokenData);
    } catch (error) {
        console.error('Token exchange API route failed:', error);
        return res.status(500).json({
            error: 'token_exchange_failed',
            error_description: error instanceof Error ? error.message : 'Unknown token exchange error',
        });
    }
}

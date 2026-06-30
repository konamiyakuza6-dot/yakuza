export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse cookies
        const cookieHeader = req.headers.cookie || '';
        const cookies = {};
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.split('=').map(s => s.trim());
            if (name && value) {
                cookies[name] = decodeURIComponent(value);
            }
        });

        const accessToken = cookies.deriv_access_token;
        const refreshToken = cookies.deriv_refresh_token;
        const tokenExpiry = cookies.deriv_token_expires;
        const appId = cookies.deriv_app_id;
        const selectedLoginId = cookies.deriv_selected_loginid;
        const accountType = cookies.deriv_account_type;
        const accountCurrency = cookies.deriv_account_currency;

        const isProd = process.env.NODE_ENV === 'production';

        // Check if we have an access token
        if (!accessToken) {
            return res.status(200).json({
                logged_in: false,
                error: 'No access token found'
            });
        }

        // Check if token is expired
        let isExpired = false;
        let timeUntilExpiry = null;
        if (tokenExpiry) {
            const expiresAt = Number(tokenExpiry);
            if (isNaN(expiresAt)) {
                isExpired = true;
            } else {
                isExpired = Date.now() > expiresAt;
                timeUntilExpiry = expiresAt - Date.now();
            }
        }

        if (isExpired) {
            return res.status(200).json({
                logged_in: false,
                error: 'Access token expired'
            });
        }

        // Return session data
        const sessionData = {
            logged_in: true,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: timeUntilExpiry ? Math.floor(timeUntilExpiry / 1000) : null,
            account_id: selectedLoginId,
            account_type: accountType,
            currency: accountCurrency,
            app_id: appId,
            accounts: [] // We can fetch accounts from Deriv later if needed
        };

        return res.status(200).json(sessionData);
    } catch (err) {
        console.error('Session check error:', err);
        return res.status(500).json({
            error: 'Server error',
            error_description: err instanceof Error ? err.message : String(err)
        });
    }
}

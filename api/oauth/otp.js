function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(function (cookie) {
        const parts = cookie.split('=');
        const key = parts.shift().trim();
        const value = parts.join('=');
        list[key] = decodeURIComponent(value);
    });
    return list;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const cookies = parseCookies(req.headers.cookie || '');
        const access_token = cookies.deriv_access_token;

        if (!access_token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { account_id } = req.body;

        if (!account_id) {
            return res.status(400).json({ error: 'Missing account_id' });
        }

        const app_id = process.env.APP_ID || process.env.DERIV_LEGACY_APP_ID;

        const otpHeaders = {
            Authorization: `Bearer ${access_token}`,
            'Deriv-APP-ID': app_id,
        };

        const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${account_id}/otp`;
        const otpResp = await fetch(otpUrl, {
            method: 'POST',
            headers: otpHeaders,
        });

        if (!otpResp.ok) {
            const err = await otpResp.text();
            return res.status(otpResp.status).json({ error: 'Failed to get OTP', details: err });
        }

        const otpData = await otpResp.json();

        return res.status(200).json({ success: true, ws_url: otpData.data.url });
    } catch (err) {
        return res.status(500).json({
            error: 'otp_request_failed',
            error_description: err instanceof Error ? err.message : String(err),
        });
    }
}

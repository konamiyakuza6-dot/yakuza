export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('OAuth callback request received');
        const { code, state, scope, error, error_description } = req.query || {};
        console.log('Received code:', code);
        console.log('Received state:', state);

        // Always redirect to frontend with all query params
        const redirectUrl = new URL('/', `https://${req.headers.host}`);
        if (code) redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);
        if (scope) redirectUrl.searchParams.set('scope', scope);
        if (error) redirectUrl.searchParams.set('error', error);
        if (error_description) redirectUrl.searchParams.set('error_description', error_description);

        console.log('Redirecting to:', redirectUrl.toString());
        return res.writeHead(302, { Location: redirectUrl.toString() }).end();
    } catch (err) {
        return res.status(500).json({
            error: 'oauth_callback_error',
            error_description: err instanceof Error ? err.message : String(err),
        });
    }
}
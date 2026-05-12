/*
 * PKCE (Proof Key for Code Exchange) helper for Deriv's new auth system.
 *
 * Flow:
 *   1. Generate code_verifier (random) + code_challenge = BASE64URL(SHA256(verifier))
 *   2. Store verifier + random state in localStorage for CSRF protection
 *   3. Redirect to https://auth.deriv.com/oauth2/auth with all PKCE params
 *   4. On callback (/callback route):
 *      a. Verify returned state matches stored state
 *      b. Exchange code for access_token via POST to auth.deriv.com/oauth2/token
 *         (browser-side — auth.deriv.com allows CORS for PKCE public clients)
 *      c. Fetch legacy Deriv tokens via POST to auth.deriv.com/oauth2/legacy/tokens
 *      d. Store resulting tokens and redirect to app
 *
 * Uses Web Crypto API — available in all modern browsers on HTTPS.
 */

export const PKCE_VERIFIER_KEY = 'pkce_verifier';
export const PKCE_STATE_KEY    = 'pkce_state';
export const PKCE_CLIENT_ID    = '337DJLKi2OJ4VsyFSLIt9';

function sha256(plain: string): Promise<ArrayBuffer> {
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}

function base64url(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

async function getCodeChallenge(): Promise<{ verifier: string; challenge: string }> {
    const rand      = window.crypto.getRandomValues(new Uint8Array(32));
    const verifier  = base64url(rand.buffer);
    const challenge = base64url(await sha256(verifier));
    return { verifier, challenge };
}

function randomState(): string {
    const arr = window.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export async function redirectToNewAccountsLogin(): Promise<void> {
    const { verifier, challenge } = await getCodeChallenge();
    const state        = randomState();
    const redirect_uri = `${window.location.origin}/callback`;

    // Store verifier and state so the callback page can verify and exchange
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(PKCE_STATE_KEY,    state);

    const url = new URL('https://auth.deriv.com/oauth2/auth');
    url.searchParams.set('response_type',         'code');
    url.searchParams.set('client_id',             PKCE_CLIENT_ID);
    url.searchParams.set('redirect_uri',          redirect_uri);
    url.searchParams.set('scope',                 'trade');
    url.searchParams.set('state',                 state);
    url.searchParams.set('code_challenge',        challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt',                'registration');
    url.searchParams.set('sidc',                  crypto.randomUUID());
    url.searchParams.set('utm_source',            'makotitraders');
    url.searchParams.set('utm_medium',            'affiliate');
    url.searchParams.set('utm_campaign',          'signup');

    window.location.assign(url.toString());
}

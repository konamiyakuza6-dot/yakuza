/*
 * Deriv REST + WebSocket client utility.
 *
 * All REST calls go through the local backend (/api/trading/*) so the
 * access_token stays in an httpOnly cookie and never touches frontend JS.
 *
 * Public WebSocket (no auth):
 *   wss://api.derivws.com/trading/v1/options/ws/public
 *
 * Authenticated WebSocket:
 *   1. Call getAccountOtp(accountId) → returns wss URL
 *   2. Connect to that URL with connectTradingWebSocket()
 */

import { PUBLIC_TRADING_WS_URL } from '@/components/shared/utils/config/config';

const API_BASE = '/api';

export type DerivOptionsAccount = {
    id: string;
    currency: string;
    balance: number;
    status: string;
    [key: string]: unknown;
};

export type DerivAccountsResponse = {
    data: DerivOptionsAccount[];
    [key: string]: unknown;
};

export type DerivOtpResponse = {
    data: { url: string; [key: string]: unknown };
    [key: string]: unknown;
};

async function apiRequest<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: object
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json() as T & { error?: string };

    if (!res.ok) {
        const errMsg = (data as any)?.error ?? `HTTP ${res.status}`;
        throw new Error(errMsg);
    }

    return data;
}

/** Check whether the user has a valid access_token cookie. */
export async function isAuthenticated(): Promise<boolean> {
    try {
        const result = await apiRequest<{ authenticated: boolean }>('GET', '/auth/status');
        return result.authenticated;
    } catch {
        return false;
    }
}

/** Fetch all Options accounts for the logged-in user. */
export async function fetchDerivAccounts(): Promise<DerivAccountsResponse> {
    return apiRequest<DerivAccountsResponse>('GET', '/trading/v1/options/accounts');
}

/**
 * Request a one-time password for an Options account.
 * Returns the authenticated wss:// URL to connect for trading.
 */
export async function getAccountOtp(accountId: string): Promise<DerivOtpResponse> {
    return apiRequest<DerivOtpResponse>(
        'POST',
        `/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`
    );
}

/** Clear the access_token cookie (server-side logout). */
export async function logout(): Promise<void> {
    await apiRequest('POST', '/auth/logout');
}

export type WsMessageHandler = (event: MessageEvent) => void;
export type WsStatusHandler = (status: 'open' | 'closed' | 'error', event?: Event) => void;

/**
 * Connect to an authenticated Deriv trading WebSocket.
 * @param wssUrl  The wss:// URL returned by getAccountOtp()
 * @param onMessage  Called for every incoming message
 * @param onStatus   Called when connection opens, closes, or errors
 * @returns A function to close the socket
 */
export function connectTradingWebSocket(
    wssUrl: string,
    onMessage: WsMessageHandler,
    onStatus?: WsStatusHandler
): () => void {
    const ws = new WebSocket(wssUrl);

    ws.onopen = e => onStatus?.('open', e);
    ws.onmessage = onMessage;
    ws.onerror = e => onStatus?.('error', e);
    ws.onclose = e => onStatus?.('closed', e);

    return () => ws.close();
}

/** Connect to the Deriv public WebSocket (no auth required). */
export function connectPublicWebSocket(
    onMessage: WsMessageHandler,
    onStatus?: WsStatusHandler
): () => void {
    return connectTradingWebSocket(
        PUBLIC_TRADING_WS_URL,
        onMessage,
        onStatus
    );
}

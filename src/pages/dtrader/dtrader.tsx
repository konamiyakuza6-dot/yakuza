import React, { useEffect, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import IframeWrapper from '@/components/iframe-wrapper';
import { getAppId } from '@/components/shared/utils/config/config';
import {
    getMainAppActiveToken,
    getMainAppActiveLoginId,
} from '@/external/bot-skeleton/services/api/appId';

const Dtrader = observer(() => {
    const [iframeSrc, setIframeSrc] = useState<string>('');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    const buildIframeUrl = useCallback((token: string, loginId: string) => {
        const appId = getAppId() || 101585;

        // Read all accounts from clientAccounts (has loginid, token, currency for each)
        // and pass them all as acct1/token1/cur1, acct2/token2/cur2 etc.
        // so DTrader can pick the active one.
        let allAccounts: Array<{ loginid: string; token: string; currency: string }> = [];

        try {
            const clientAccountsStr = localStorage.getItem('clientAccounts') || '{}';
            const clientAccounts = JSON.parse(clientAccountsStr);

            if (Array.isArray(clientAccounts)) {
                allAccounts = clientAccounts;
            } else {
                allAccounts = Object.values(clientAccounts) as Array<{
                    loginid: string;
                    token: string;
                    currency: string;
                }>;
            }
        } catch (_) {}

        // Fallback: if clientAccounts empty, try accountsList
        if (!allAccounts.length) {
            try {
                const accountsListStr = localStorage.getItem('accountsList') || '{}';
                const accountsList = JSON.parse(accountsListStr) as Record<string, string>;
                allAccounts = Object.entries(accountsList).map(([lid, tok]) => ({
                    loginid: lid,
                    token: tok,
                    currency: 'USD',
                }));
            } catch (_) {}
        }

        // Ensure the active account is always included (covers new-auth token)
        const activeAlreadyIncluded = allAccounts.some(
            a => a.loginid === loginId && a.token === token
        );
        if (!activeAlreadyIncluded) {
            // Get currency for active account
            let activeCurrency = 'USD';
            try {
                const clientAccounts = JSON.parse(localStorage.getItem('clientAccounts') || '{}');
                if (Array.isArray(clientAccounts)) {
                    const found = clientAccounts.find((a: any) => a.loginid === loginId);
                    if (found?.currency) activeCurrency = found.currency;
                } else if (clientAccounts[loginId]?.currency) {
                    activeCurrency = clientAccounts[loginId].currency;
                }
            } catch (_) {}
            // Put active account first
            allAccounts = [{ loginid: loginId, token, currency: activeCurrency }, ...allAccounts];
        } else {
            // Sort so active account is first
            allAccounts = [
                ...allAccounts.filter(a => a.loginid === loginId),
                ...allAccounts.filter(a => a.loginid !== loginId),
            ];
        }

        // Build URL params — pass all accounts, active account as acct1/token1/cur1
        const params: Record<string, string> = {
            lang: 'EN',
            app_id: appId.toString(),
        };

        allAccounts.slice(0, 10).forEach((acc, idx) => {
            const n = idx + 1;
            params[`acct${n}`] = acc.loginid;
            params[`token${n}`] = acc.token;
            params[`cur${n}`] = acc.currency || 'USD';
        });

        const url = `https://deriv-dtrader.vercel.app/?${new URLSearchParams(params).toString()}`;
        setIframeSrc(url);
    }, []);

    useEffect(() => {
        const token = getMainAppActiveToken();
        const activeLoginId = getMainAppActiveLoginId();

        if (token && activeLoginId) {
            setIsAuthenticated(true);
            buildIframeUrl(token, activeLoginId);
        } else {
            setIsAuthenticated(false);
            setIframeSrc('https://deriv-dtrader.vercel.app/');
        }
    }, [buildIframeUrl]);

    // Listen for account switches and authentication changes
    useEffect(() => {
        const checkAuthAndUpdate = () => {
            const token = getMainAppActiveToken();
            const activeLoginId = getMainAppActiveLoginId();

            if (token && activeLoginId) {
                if (!isAuthenticated) {
                    setIsAuthenticated(true);
                }
                buildIframeUrl(token, activeLoginId);
            } else if (isAuthenticated) {
                setIsAuthenticated(false);
                setIframeSrc('https://deriv-dtrader.vercel.app/');
            }
        };

        // Listen for storage changes (account switches from other tabs)
        const handleStorageChange = (e: StorageEvent) => {
            if (
                e.key === 'authToken' ||
                e.key === 'NEW_AUTH_token' ||
                e.key === 'active_loginid' ||
                e.key === 'clientAccounts' ||
                e.key === 'accountsList' ||
                e.key === 'show_as_cr'
            ) {
                checkAuthAndUpdate();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Poll for same-tab localStorage changes (e.g. auth completes after mount)
        const interval = setInterval(checkAuthAndUpdate, 2000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [isAuthenticated, buildIframeUrl]);

    if (!iframeSrc) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>Loading DTrader...</p>
            </div>
        );
    }

    return <IframeWrapper src={iframeSrc} title='DTrader' className='dtrader-container' />;
});

export default Dtrader;

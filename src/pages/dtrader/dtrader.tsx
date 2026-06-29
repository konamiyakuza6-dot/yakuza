import React, { useEffect, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import IframeWrapper from '@/components/iframe-wrapper';
import {
    getMainAppActiveToken,
    getMainAppActiveLoginId,
} from '@/external/bot-skeleton/services/api/appId';
import { isNewLoggedIn } from '@/auth/NewDerivAuth';

const DTRADER_BASE = 'https://deriv-dtrader.vercel.app/';

const Dtrader = observer(() => {
    const [iframeSrc, setIframeSrc] = useState<string>('');

    const buildIframeUrl = useCallback((token: string, loginId: string) => {
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

        const activeAlreadyIncluded = allAccounts.some(
            a => a.loginid === loginId && a.token === token
        );
        if (!activeAlreadyIncluded) {
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
            allAccounts = [{ loginid: loginId, token, currency: activeCurrency }, ...allAccounts];
        } else {
            allAccounts = [
                ...allAccounts.filter(a => a.loginid === loginId),
                ...allAccounts.filter(a => a.loginid !== loginId),
            ];
        }

        const params = new URLSearchParams();
        allAccounts.slice(0, 10).forEach((acc, idx) => {
            const n = idx + 1;
            params.set(`acct${n}`, acc.loginid);
            params.set(`token${n}`, acc.token);
            params.set(`cur${n}`, acc.currency || 'USD');
        });

        setIframeSrc(`${DTRADER_BASE}?${params.toString()}`);
    }, []);

    const checkAuth = useCallback(() => {
        const token = getMainAppActiveToken();
        const activeLoginId = getMainAppActiveLoginId();

        if (!isNewLoggedIn() && token && activeLoginId) {
            buildIframeUrl(token, activeLoginId);
        } else {
            setIframeSrc(DTRADER_BASE);
        }
    }, [buildIframeUrl]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (
                e.key === 'authToken' ||
                e.key === 'NEW_AUTH_token' ||
                e.key === 'active_loginid' ||
                e.key === 'clientAccounts' ||
                e.key === 'accountsList' ||
                e.key === 'show_as_cr'
            ) {
                checkAuth();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        const interval = setInterval(checkAuth, 2000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [checkAuth]);

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

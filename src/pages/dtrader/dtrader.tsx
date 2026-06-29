import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import IframeWrapper from '@/components/iframe-wrapper';
import { getNewToken, isNewLoggedIn } from '@/auth/NewDerivAuth';

const DTRADER_BASE = 'https://deriv-dtrader.vercel.app/';

function buildDtraderUrl(): string {
    try {
        if (!isNewLoggedIn()) return DTRADER_BASE;

        const token = getNewToken();
        if (!token) return DTRADER_BASE;

        const clientAccounts: Record<string, any> = JSON.parse(
            localStorage.getItem('clientAccounts') ?? '{}'
        );
        const activeLoginId = localStorage.getItem('active_loginid') ?? '';

        const params = new URLSearchParams();

        const loginIds = Object.keys(clientAccounts);
        if (loginIds.length === 0 && activeLoginId) {
            params.set('acct1', activeLoginId);
            params.set('token1', token);
        } else {
            loginIds.forEach((loginId, index) => {
                const n = index + 1;
                const currency = clientAccounts[loginId]?.currency ?? '';
                params.set(`acct${n}`, loginId);
                params.set(`token${n}`, token);
                if (currency) params.set(`cur${n}`, currency);
            });
        }

        return `${DTRADER_BASE}?${params.toString()}`;
    } catch {
        return DTRADER_BASE;
    }
}

const Dtrader = observer(() => {
    const src = useMemo(() => buildDtraderUrl(), []);

    return <IframeWrapper src={src} title='DTrader' className='dtrader-container' />;
});

export default Dtrader;

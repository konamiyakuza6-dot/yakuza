import clsx from 'clsx';
import { api_base } from '@/external/bot-skeleton';
import { localize } from '@deriv-com/translations';
import { AccountSwitcher as UIAccountSwitcher } from '@deriv-com/ui';
import AccountSwitcherFooter from './account-swticher-footer';
import { TDemoAccounts } from './types';
import { AccountSwitcherDivider, convertCommaValue } from './utils';
import { isNewLoggedIn, getNewAuthHeaders } from '@/auth/NewDerivAuth';

const REST_BASE = 'https://api.derivws.com/trading/v1';

const DemoAccounts = ({
    tabs_labels,
    modifiedVRTCRAccountList,
    switchAccount,
    isVirtual,
    activeLoginId,
    oAuthLogout,
    is_logging_out,
}: TDemoAccounts) => {
    const handleResetBalance = async (loginId: string) => {
        try {
            console.log('🔄 [RESET BALANCE] Resetting demo balance for:', loginId);

            if (isNewLoggedIn()) {
                // Use the correct REST endpoint from Deriv docs:
                // POST /trading/v1/options/accounts/{account_id}/reset-demo-balance
                const res = await fetch(
                    `${REST_BASE}/options/accounts/${loginId}/reset-demo-balance`,
                    { method: 'POST', headers: getNewAuthHeaders() }
                );
                const text = await res.text();
                if (res.ok) {
                    console.log('✅ [RESET BALANCE] Success via REST API:', text.slice(0, 200));
                } else {
                    console.error('❌ [RESET BALANCE] Failed:', res.status, text.slice(0, 300));
                }
                return;
            }

            if (!api_base?.api) return;
            const { topup_virtual, error } = await api_base.api.send({ topup_virtual: 1 });
            if (error) {
                console.error('❌ [RESET BALANCE] Error resetting balance:', error);
                return;
            }
            console.log('✅ [RESET BALANCE] Balance reset successful, waiting for balance update...');
        } catch (error) {
            console.error('❌ [RESET BALANCE] Error resetting balance:', error);
        }
    };

    return (
        <>
            <UIAccountSwitcher.AccountsPanel
                isOpen
                title={localize('Deriv account')}
                className='account-switcher-panel'
                key={tabs_labels.demo.toLowerCase()}
            >
                {modifiedVRTCRAccountList &&
                    modifiedVRTCRAccountList.map(account => {
                        return (
                            <span
                                className={clsx('account-switcher__item', {
                                    'account-switcher__item--disabled': account.is_disabled,
                                })}
                                key={account.loginid}
                            >
                                <UIAccountSwitcher.AccountsItem
                                    account={account}
                                    onSelectAccount={() => {
                                        if (!account.is_disabled) switchAccount(account.loginid);
                                    }}
                                    onResetBalance={account.isVirtual ? () => handleResetBalance(account.loginid) : undefined}
                                />
                            </span>
                        );
                    })}
            </UIAccountSwitcher.AccountsPanel>
            <AccountSwitcherDivider />
            <AccountSwitcherFooter loginid={activeLoginId} oAuthLogout={oAuthLogout} is_logging_out={is_logging_out} />
        </>
    );
};

export default DemoAccounts;

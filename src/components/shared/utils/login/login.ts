import { startNewLogin, startNewSignup } from '@/auth/NewDerivAuth';

export const redirectToLogin = async (
    is_logged_in: boolean,
    _language?: string,
    _has_params = true,
    redirect_delay = 0
) => {
    if (!is_logged_in) {
        setTimeout(async () => {
            await startNewLogin();
        }, redirect_delay);
    }
};

export const redirectToSignUp = async () => {
    await startNewSignup();
};

type TLoginUrl = {
    language: string;
};

export const loginUrl = async (_params?: TLoginUrl) => {
    // Returns empty string — callers that need an href should use startNewLogin() directly.
    // This shim keeps type compatibility with legacy callers.
    return '';
};

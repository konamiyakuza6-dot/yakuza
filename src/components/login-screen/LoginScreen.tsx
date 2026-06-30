import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { startNewLogin, startNewSignup } from '@/auth/NewDerivAuth';
import './LoginScreen.scss';

const LoginScreenInner = () => {
    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 80);
        return () => clearTimeout(t);
    }, []);

    const handleLogin = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isLoginLoading) return;
        setIsLoginLoading(true);
        setLoginError('');
        try {
            await startNewLogin();
        } catch (error) {
            console.error('[Login]', error);
            setIsLoginLoading(false);
            setLoginError('Login failed to start. Please try again or use a different browser.');
        }
    };

    const handleSignup = async (e: React.MouseEvent) => {
        e.preventDefault();
        try {
            await startNewSignup();
        } catch (error) {
            console.error('[Signup]', error);
        }
    };

    return (
        <div className={`login-screen${visible ? ' login-screen--visible' : ''}`}>
            <div className='login-screen__bg' style={{ backgroundImage: "url('/captain-peter-logo.png')" }} />
            <div className='login-screen__overlay' />

            <div className='login-screen__content'>
                <div className='login-screen__logo-wrap'>
                    <img src='/captain-peter-logo.png' alt='Captain Peter Trading Hub' className='login-screen__logo' />
                </div>

                <div className='login-screen__brand'>
                    <h1 className='login-screen__title'>CAPTAIN PETER TRADING HUB</h1>
                    <p className='login-screen__sub'>POWERED BY DERIV</p>
                </div>

                <p className='login-screen__tagline'>
                    Your intelligent trading platform.<br />
                    Automate strategies. Trade smarter.
                </p>

                <div className='login-screen__buttons'>
                    <button
                        className={`login-screen__btn login-screen__btn--primary${isLoginLoading ? ' login-screen__btn--loading' : ''}`}
                        onClick={handleLogin}
                        disabled={isLoginLoading}
                    >
                        <span className='login-screen__btn-icon'>→</span>
                        {isLoginLoading ? 'Preparing…' : 'Log In'}
                    </button>
                </div>

                {loginError && (
                    <p className='login-screen__error'>{loginError}</p>
                )}

                <div className='login-screen__divider'>
                    <span>or</span>
                </div>

                <div className='login-screen__create-wrap'>
                    <button
                        className='login-screen__btn login-screen__btn--create'
                        onClick={handleSignup}
                    >
                        <span className='login-screen__btn-icon'>+</span>
                        Create Account
                    </button>
                </div>

                <p className='login-screen__footer-note'>
                    Secure login powered by Deriv OAuth
                </p>
            </div>

            <div className='login-screen__particles'>
                {[...Array(12)].map((_, i) => (
                    <div key={i} className={`login-screen__particle login-screen__particle--${i + 1}`} />
                ))}
            </div>
        </div>
    );
};

const LoginScreen = () => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return ReactDOM.createPortal(<LoginScreenInner />, document.body);
};

export default LoginScreen;

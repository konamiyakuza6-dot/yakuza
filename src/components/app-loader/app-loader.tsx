import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './app-loader.scss';

interface AppLoaderProps {
    onLoadingComplete: () => void;
    duration?: number;
}

const SUBTITLES = [
    'DEPLOYING ASSETS',
    'LOADING ORDNANCE',
    'TARGET ACQUIRED',
    'MISSION READY',
];

const TITLE = 'MAKOTI TRADERS';

const AppLoader: React.FC<AppLoaderProps> = ({ onLoadingComplete, duration = 9000 }) => {
    const [show, setShow] = useState(true);
    const [subIndex, setSubIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const subInterval = setInterval(() => {
            setSubIndex(prev => Math.min(prev + 1, SUBTITLES.length - 1));
        }, duration / SUBTITLES.length);

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                const next = prev + Math.random() * 6 + 2;
                return next >= 100 ? 100 : next;
            });
        }, duration / 18);

        const timer = setTimeout(() => {
            setProgress(100);
            setTimeout(() => {
                setShow(false);
                onLoadingComplete();
            }, 200);
        }, duration);

        return () => {
            clearTimeout(timer);
            clearInterval(subInterval);
            clearInterval(progressInterval);
        };
    }, [onLoadingComplete, duration]);

    if (!show) return null;

    return (
        <div className='cod-loader'>
            <div className='loader-bg' />
            <div className='loader-overlay' />
            <div className='loader-vignette' />

            <div className='loader-center'>
                <div className='emblem anim-emblem'>
                    <svg width='80' height='80' viewBox='0 0 80 80' fill='none'>
                        <defs>
                            <linearGradient id='eg' x1='0' y1='0' x2='1' y2='1'>
                                <stop offset='0%' stopColor='#85acb0' />
                                <stop offset='100%' stopColor='#ffa500' />
                            </linearGradient>
                            <linearGradient id='eg2' x1='0' y1='1' x2='1' y2='0'>
                                <stop offset='0%' stopColor='#ffa500' />
                                <stop offset='100%' stopColor='#85acb0' />
                            </linearGradient>
                        </defs>
                        <path d='M40 4L76 40L40 76L4 40L40 4Z' stroke='url(#eg)' strokeWidth='3' fill='none' />
                        <path d='M40 14L66 40L40 66L14 40L40 14Z' stroke='url(#eg2)' strokeWidth='2' fill='none' opacity='0.6' />
                        <path d='M40 24L56 40L40 56L24 40L40 24Z' stroke='url(#eg)' strokeWidth='1.5' fill='none' opacity='0.4' />
                        <circle cx='40' cy='40' r='6' fill='#85acb0' />
                        <circle cx='40' cy='40' r='2' fill='#fff' opacity='0.8' />
                    </svg>
                </div>

                {/* ── Rotating padlock ── */}
                <div className='lock-wrap'>
                    <svg width='36' height='40' viewBox='0 0 36 40' fill='none' className='lock-svg'>
                        <rect x='5' y='16' width='26' height='20' rx='3' fill='none' stroke='url(#eg)' strokeWidth='2' />
                        <rect x='5' y='16' width='26' height='20' rx='3' fill='rgba(133,172,176,0.08)' />
                        <circle cx='18' cy='28' r='4' fill='none' stroke='#85acb0' strokeWidth='1.5' opacity='0.3' />
                        <circle className='lock-inner' cx='18' cy='28' r='2' fill='none' stroke='#ffa500' strokeWidth='1.5' strokeDasharray='3 4' />
                        <path className='lock-shackle' d='M18 16V12C18 8.5 15 6 12 6C9 6 6 8.5 6 12V14' stroke='url(#eg)' strokeWidth='2.5' strokeLinecap='round' fill='none' />
                    </svg>
                </div>

                <div className='title-wrap'>
                    {TITLE.split('').map((letter, i) => (
                        <span key={i} className='title-letter' style={{ animationDelay: `${1.2 + i * 0.07}s` }}>
                            {letter === ' ' ? '\u00A0' : letter}
                        </span>
                    ))}
                </div>

                <motion.p
                    className='loader-subtitle'
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.8, duration: 0.5 }}
                >
                    ⚔️ TRADING PLATFORM 🔥
                </motion.p>

                <div className='progress-container'>
                    <div className='progress-bar'>
                        <div className='progress-track'>
                            <div className='progress-fill' style={{ animationDuration: `${duration}ms` }} />
                        </div>
                    </div>
                    <div className='progress-info'>
                        <span className='progress-label'>⚡ LOADING</span>
                        <span className='progress-pct'>{Math.round(progress)}%</span>
                    </div>
                </div>

                <div className='status-wrap'>
                    <AnimatePresence mode='wait'>
                        <motion.p
                            key={subIndex}
                            className='status-text'
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 0.6 }}
                            exit={{ y: -10, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            ▸ {SUBTITLES[subIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>

                <div className='bottom-tag'>💀 EST. 2024 🏆</div>
            </div>
        </div>
    );
};

export default AppLoader;

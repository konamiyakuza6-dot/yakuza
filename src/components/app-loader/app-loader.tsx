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
                const next = prev + Math.random() * 8 + 2;
                return next >= 100 ? 100 : next;
            });
        }, duration / 20);

        const timer = setTimeout(() => {
            setShow(false);
            onLoadingComplete();
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
            <div className='sweep-lines' />
            <div className='scanlines' />
            <div className='vignette' />

            <div className='loader-center'>
                <motion.div
                    className='loader-emblem'
                    initial={{ scale: 0, opacity: 0, rotateX: 120 }}
                    animate={{ scale: 1.2, opacity: 0.9, rotateX: 0 }}
                    transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                    style={{ perspective: 1000 }}
                >
                    <svg width='80' height='80' viewBox='0 0 80 80' fill='none'>
                        <defs>
                            <linearGradient id='emblemGrad' x1='0' y1='0' x2='1' y2='1'>
                                <stop offset='0%' stopColor='#85acb0' />
                                <stop offset='100%' stopColor='#ffa500' />
                            </linearGradient>
                            <linearGradient id='emblemGrad2' x1='0' y1='1' x2='1' y2='0'>
                                <stop offset='0%' stopColor='#ffa500' />
                                <stop offset='100%' stopColor='#85acb0' />
                            </linearGradient>
                        </defs>
                        <path d='M40 4L76 40L40 76L4 40L40 4Z' stroke='url(#emblemGrad)' strokeWidth='3' fill='none' />
                        <path d='M40 14L66 40L40 66L14 40L40 14Z' stroke='url(#emblemGrad2)' strokeWidth='2' fill='none' opacity='0.6' />
                        <path d='M40 24L56 40L40 56L24 40L40 24Z' stroke='url(#emblemGrad)' strokeWidth='1.5' fill='none' opacity='0.4' />
                        <circle cx='40' cy='40' r='6' fill='#85acb0' />
                        <circle cx='40' cy='40' r='2' fill='#fff' opacity='0.8' />
                    </svg>
                </motion.div>

                <div className='title-wrap'>
                    {TITLE.split('').map((letter, i) => (
                        <motion.span
                            key={i}
                            className='title-letter'
                            initial={{ y: -100, opacity: 0, rotateX: -90 }}
                            animate={{ y: 0, opacity: 1, rotateX: 0 }}
                            transition={{
                                duration: 0.6,
                                delay: 1.2 + i * 0.07,
                                type: 'spring',
                                stiffness: 180,
                                damping: 10,
                            }}
                        >
                            {letter === ' ' ? '\u00A0' : letter}
                        </motion.span>
                    ))}
                </div>

                <motion.p
                    className='loader-subtitle'
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.8, duration: 0.5 }}
                >
                    ⚔️ TRADING PLATFORM 🔥
                </motion.p>

                <motion.div
                    className='progress-container'
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2, duration: 0.5 }}
                >
                    <div className='progress-bar'>
                        <div className='progress-track'>
                            <motion.div
                                className='progress-fill'
                                initial={{ width: '0%' }}
                                animate={{ width: '100%' }}
                                transition={{ duration: duration / 1000, ease: 'easeInOut' }}
                            />
                        </div>
                    </div>
                    <div className='progress-info'>
                        <span className='progress-label'>⚡ LOADING</span>
                        <motion.span className='progress-pct'>{Math.round(progress)}%</motion.span>
                    </div>
                </motion.div>

                <div className='status-container'>
                    <AnimatePresence mode='wait'>
                        <motion.p
                            key={subIndex}
                            className='status-text'
                            initial={{ y: 12, opacity: 0 }}
                            animate={{ y: 0, opacity: 0.6 }}
                            exit={{ y: -12, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            ▸ {SUBTITLES[subIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>

                <motion.div
                    className='bottom-tag'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    transition={{ delay: 3.5, duration: 1 }}
                >
                    💀 EST. 2024 🏆
                </motion.div>
            </div>
        </div>
    );
};

export default AppLoader;

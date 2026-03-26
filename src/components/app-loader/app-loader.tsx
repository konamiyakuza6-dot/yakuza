import React, { useState, useEffect, useRef } from 'react';
import './app-loader.scss';
import AnimatedStatus from './AnimatedStatus';

interface AppLoaderProps {
    onLoadingComplete: () => void;
    duration?: number;
}

const AppLoader: React.FC<AppLoaderProps> = ({ onLoadingComplete, duration = 6000 }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [progress, setProgress] = useState(0);
    const [crackEffects, setCrackEffects] = useState<Array<{ id: number; x: number; y: number; angle: number }>>([]);
    const [flyingWords, setFlyingWords] = useState<Array<{ id: number; text: string; x: number; y: number; angle: number; delay: number }>>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const crackAudioRef = useRef<HTMLAudioElement | null>(null);

    const words = ['TRADING', 'MAKOTI', 'PRECISION', 'PROFIT', 'AUTOMATED', 'SIGNALS', 'BOTS', 'ANALYSIS', 'STRATEGY', 'SUCCESS'];

    useEffect(() => {
        // Initialize flying words from different directions
        const newWords = words.map((word, i) => ({
            id: i,
            text: word,
            x: Math.random() > 0.5 ? -200 - Math.random() * 100 : window.innerWidth + 200 + Math.random() * 100,
            y: Math.random() * window.innerHeight,
            angle: Math.random() * 30 - 15,
            delay: i * 200 + Math.random() * 500,
        }));
        setFlyingWords(newWords);

        // Generate crack effects
        const cracks = Array.from({ length: 8 }, (_, i) => ({
            id: i,
            x: 40 + Math.random() * 20,
            y: 40 + Math.random() * 20,
            angle: Math.random() * 360,
        }));
        setCrackEffects(cracks);

        // Try to load sounds (placeholder - would need actual audio files)
        try {
            // @ts-ignore - audio would be loaded from public folder
            audioRef.current = new Audio('/sounds/engine.mp3');
            audioRef.current.volume = 0.3;
            
            // @ts-ignore
            crackAudioRef.current = new Audio('/sounds/crack.mp3');
            crackAudioRef.current.volume = 0.5;
        } catch (e) {
            console.log('Audio files not found, continuing without sound');
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (crackAudioRef.current) {
                crackAudioRef.current.pause();
            }
        };
    }, []);

    // Progress bar
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 2;
            });
        }, duration / 50);

        return () => clearInterval(interval);
    }, [duration]);

    // Complete loading
    useEffect(() => {
        if (progress >= 100) {
            // Play crack sound
            if (crackAudioRef.current) {
                crackAudioRef.current.currentTime = 0;
                crackAudioRef.current.play().catch(() => {});
            }
            
            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                setIsVisible(false);
                setTimeout(onLoadingComplete, 500);
            }, 500);
        }
    }, [progress, onLoadingComplete]);

    if (!isVisible) return null;

    return (
        <div className='makoti-intro-loader'>
            {/* Flying words background */}
            <div className='flying-words-container'>
                {flyingWords.map((word) => (
                    <div
                        key={word.id}
                        className='flying-word'
                        style={{
                            '--start-x': `${word.x}px`,
                            '--start-y': `${word.y}px`,
                            '--angle': `${word.angle}deg`,
                            '--delay': `${word.delay}ms`,
                        } as React.CSSProperties}
                    >
                        {word.text}
                    </div>
                ))}
            </div>

            {/* Crack overlay effect */}
            <div className='crack-overlay'>
                {crackEffects.map((crack) => (
                    <div
                        key={crack.id}
                        className='crack-line'
                        style={{
                            '--crack-x': `${crack.x}%`,
                            '--crack-y': `${crack.y}%`,
                            '--crack-angle': `${crack.angle}deg`,
                        } as React.CSSProperties}
                    />
                ))}
            </div>

            {/* Main content */}
            <div className='intro-content'>
                <div className='intro-logo-container'>
                    <div className='intro-logo'>
                        <div className='logo-icon'>
                            <svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                                <path d='M13 3L4 14H12L11 21L20 10H12L13 3Z' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
                            </svg>
                        </div>
                        <div className='logo-text'>
                            <span className='logo-main'>MAKOTI</span>
                            <span className='logo-sub'>TRADING</span>
                        </div>
                    </div>
                </div>

                <div className='intro-tagline'>
                    <span className='tagline-word'>Automated</span>
                    <span className='tagline-word'>Precision</span>
                    <span className='tagline-word'>Trading</span>
                    <span className='tagline-word'>System</span>
                </div>

                <div className='intro-features'>
                    <div className='feature-item'>
                        <span className='feature-icon'>⚡</span>
                        <span>AI Prediction</span>
                    </div>
                    <div className='feature-item'>
                        <span className='feature-icon'>🎯</span>
                        <span>Smart Analysis</span>
                    </div>
                    <div className='feature-item'>
                        <span className='feature-icon'>🚀</span>
                        <span>Auto Trading</span>
                    </div>
                </div>

                <div className='intro-progress'>
                    <div className='progress-bar-container'>
                        <div className='progress-bar-fill' style={{ width: `${progress}%` }}>
                            <div className='progress-shine' />
                        </div>
                    </div>
                    <div className='progress-text'>
                        <span className='progress-percent'>{Math.round(progress)}%</span>
                        <span className='progress-status'>
                            {progress < 30 && 'Initializing systems...'}
                            {progress >= 30 && progress < 60 && 'Loading prediction engine...'}
                            {progress >= 60 && progress < 90 && 'Connecting to markets...'}
                            {progress >= 90 && 'Almost ready...'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Particles */}
            <div className='particles-container'>
                {Array.from({ length: 50 }).map((_, i) => (
                    <div
                        key={i}
                        className='particle'
                        style={{
                            '--x': `${Math.random() * 100}%`,
                            '--y': `${Math.random() * 100}%`,
                            '--duration': `${2 + Math.random() * 3}s`,
                            '--delay': `${Math.random() * 2}s`,
                        } as React.CSSProperties}
                    />
                ))}
            </div>
        </div>
    );
};

export default AppLoader;

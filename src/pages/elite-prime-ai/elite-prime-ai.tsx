import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAppId, getSocketURL } from '@/components/shared';
import './elite-prime-ai.scss';

interface AISignal {
    symbol: string;
    label: string;
    contractType: string;
    direction: string;
    confidence: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    digitSuggestion: string;
    analysisNote: string;
    status: 'active' | 'idle' | 'loading';
    lastPrice: number;
    tickCount: number;
}

const SYMBOLS = [
    { symbol: 'R_10', label: 'Volatility 10 Index' },
    { symbol: 'R_25', label: 'Volatility 25 Index' },
    { symbol: 'R_50', label: 'Volatility 50 Index' },
    { symbol: 'R_75', label: 'Volatility 75 Index' },
    { symbol: 'R_100', label: 'Volatility 100 Index' },
    { symbol: '1HZ10V', label: 'Volatility 10 (1s)' },
    { symbol: '1HZ25V', label: 'Volatility 25 (1s)' },
    { symbol: '1HZ50V', label: 'Volatility 50 (1s)' },
    { symbol: '1HZ75V', label: 'Volatility 75 (1s)' },
    { symbol: '1HZ100V', label: 'Volatility 100 (1s)' },
];

function runAIAnalysis(ticks: number[]): Omit<AISignal, 'symbol' | 'label'> {
    if (ticks.length < 50) {
        return {
            contractType: '—',
            direction: '—',
            confidence: 0,
            trend: 'neutral',
            digitSuggestion: '—',
            analysisNote: 'Collecting data…',
            status: 'loading',
            lastPrice: ticks[ticks.length - 1] || 0,
            tickCount: ticks.length,
        };
    }

    const last255 = ticks.slice(-255);
    const last55 = ticks.slice(-55);
    const last20 = ticks.slice(-20);

    // Rise/Fall analysis
    let rises = 0, falls = 0;
    for (let i = 1; i < last255.length; i++) {
        if (last255[i] > last255[i - 1]) rises++;
        else if (last255[i] < last255[i - 1]) falls++;
    }
    const total = rises + falls || 1;
    const risePct = (rises / total) * 100;
    const fallPct = (falls / total) * 100;

    let rises55 = 0, falls55 = 0;
    for (let i = 1; i < last55.length; i++) {
        if (last55[i] > last55[i - 1]) rises55++;
        else if (last55[i] < last55[i - 1]) falls55++;
    }
    const total55 = rises55 + falls55 || 1;
    const risePct55 = (rises55 / total55) * 100;
    const fallPct55 = (falls55 / total55) * 100;

    // Digit analysis
    const digitCounts = new Array(10).fill(0);
    last255.forEach(t => {
        const s = t.toFixed(2);
        const d = parseInt(s[s.length - 1]);
        if (d >= 0 && d <= 9) digitCounts[d]++;
    });
    const total255 = last255.length;
    const digitPcts = digitCounts.map(c => (c / total255) * 100);

    const minDigit = digitPcts.indexOf(Math.min(...digitPcts));
    const maxDigit = digitPcts.indexOf(Math.max(...digitPcts));

    const evenCount = [0, 2, 4, 6, 8].reduce((s, d) => s + digitCounts[d], 0);
    const oddCount = [1, 3, 5, 7, 9].reduce((s, d) => s + digitCounts[d], 0);
    const evenPct = (evenCount / total255) * 100;
    const oddPct = (oddCount / total255) * 100;

    // EMA trend (last 20 ticks)
    const ema = last20.reduce((a, b) => a + b, 0) / last20.length;
    const currentPrice = last20[last20.length - 1];
    const trend: 'bullish' | 'bearish' | 'neutral' =
        currentPrice > ema * 1.0005 ? 'bullish' : currentPrice < ema * 0.9995 ? 'bearish' : 'neutral';

    // Determine best signal
    const strongRise = risePct > 57 && risePct55 > 55;
    const strongFall = fallPct > 57 && fallPct55 > 55;
    const overSignal = digitPcts[7] < 10 && digitPcts[8] < 10 && digitPcts[9] < 10;
    const underSignal = digitPcts[0] < 10 && digitPcts[1] < 10 && digitPcts[2] < 10;
    const matchSignal = digitPcts[minDigit] < 9;
    const diffSignal = digitPcts[maxDigit] > 13;
    const evenSignal = evenPct > 55;
    const oddSignal = oddPct > 55;

    let contractType = 'Rise/Fall';
    let direction = '—';
    let confidence = 0;
    let digitSuggestion = '—';
    let analysisNote = 'Market is ranging — no strong signal detected.';

    if (strongRise) {
        contractType = 'Rise';
        direction = '📈 Buy Rise';
        confidence = Math.min(95, Math.round(((risePct - 50) + (risePct55 - 50)) * 1.8 + 55));
        analysisNote = `${Math.round(risePct)}% of 255 ticks rising · ${Math.round(risePct55)}% of last 55`;
    } else if (strongFall) {
        contractType = 'Fall';
        direction = '📉 Buy Fall';
        confidence = Math.min(95, Math.round(((fallPct - 50) + (fallPct55 - 50)) * 1.8 + 55));
        analysisNote = `${Math.round(fallPct)}% of 255 ticks falling · ${Math.round(fallPct55)}% of last 55`;
    } else if (overSignal) {
        contractType = 'Over/Under';
        direction = '🔼 Over 2';
        confidence = Math.round(78 + (10 - Math.max(digitPcts[7], digitPcts[8], digitPcts[9])) * 2);
        digitSuggestion = '> digit 2';
        analysisNote = `High digits (7,8,9) underrepresented — digit barrier cleared.`;
    } else if (underSignal) {
        contractType = 'Over/Under';
        direction = '🔽 Under 7';
        confidence = Math.round(78 + (10 - Math.max(digitPcts[0], digitPcts[1], digitPcts[2])) * 2);
        digitSuggestion = '< digit 7';
        analysisNote = `Low digits (0,1,2) underrepresented — digit barrier cleared.`;
    } else if (matchSignal) {
        contractType = 'Digit Match';
        direction = `🎯 Match ${minDigit}`;
        confidence = Math.round(70 + (10 - digitPcts[minDigit]) * 2);
        digitSuggestion = `Match digit ${minDigit}`;
        analysisNote = `Digit ${minDigit} has only ${digitPcts[minDigit].toFixed(1)}% frequency (cold digit).`;
    } else if (evenSignal) {
        contractType = 'Even/Odd';
        direction = '⚖️ Even';
        confidence = Math.round(60 + (evenPct - 50) * 2);
        analysisNote = `${Math.round(evenPct)}% of last digits are even.`;
    } else if (oddSignal) {
        contractType = 'Even/Odd';
        direction = '🎲 Odd';
        confidence = Math.round(60 + (oddPct - 50) * 2);
        analysisNote = `${Math.round(oddPct)}% of last digits are odd.`;
    } else if (diffSignal) {
        contractType = 'Digit Diff';
        direction = `↔️ Differ ${maxDigit}`;
        confidence = Math.round(65 + (digitPcts[maxDigit] - 10) * 2);
        digitSuggestion = `Differ digit ${maxDigit}`;
        analysisNote = `Digit ${maxDigit} overrepresented at ${digitPcts[maxDigit].toFixed(1)}%.`;
    }

    return {
        contractType,
        direction,
        confidence: Math.max(0, Math.min(99, confidence)),
        trend,
        digitSuggestion,
        analysisNote,
        status: confidence > 60 ? 'active' : 'idle',
        lastPrice: ticks[ticks.length - 1],
        tickCount: ticks.length,
    };
}

const ElitePrimeAI: React.FC = () => {
    const [signals, setSignals] = useState<AISignal[]>(
        SYMBOLS.map(s => ({ ...s, contractType: '—', direction: '—', confidence: 0, trend: 'neutral', digitSuggestion: '—', analysisNote: 'Connecting…', status: 'loading', lastPrice: 0, tickCount: 0 }))
    );
    const [connected, setConnected] = useState(false);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const ticksRef = useRef<Record<string, number[]>>({});

    const computeAll = useCallback(() => {
        setSignals(prev => prev.map(sig => {
            const ticks = ticksRef.current[sig.symbol] || [];
            const analysis = runAIAnalysis(ticks);
            return { ...sig, ...analysis };
        }));
    }, []);

    useEffect(() => {
        const ws = new WebSocket(`wss://${getSocketURL()}/websockets/v3?app_id=${getAppId()}`);

        ws.onopen = () => {
            setConnected(true);
            SYMBOLS.forEach(({ symbol }) => {
                ticksRef.current[symbol] = [];
                ws.send(JSON.stringify({ ticks_history: symbol, count: 255, end: 'latest', style: 'ticks', subscribe: 1 }));
            });
        };

        ws.onmessage = evt => {
            const data = JSON.parse(evt.data);
            if (data.error) return;
            if (data.history?.prices) {
                const sym = data.echo_req.ticks_history;
                ticksRef.current[sym] = data.history.prices.map(Number);
            } else if (data.tick) {
                const sym = data.tick.symbol;
                if (!ticksRef.current[sym]) ticksRef.current[sym] = [];
                ticksRef.current[sym].push(parseFloat(data.tick.quote));
                if (ticksRef.current[sym].length > 500) ticksRef.current[sym].shift();
            }
        };

        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);

        const interval = setInterval(computeAll, 2000);

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, [computeAll]);

    const activeCount = signals.filter(s => s.status === 'active').length;
    const selectedSig = selectedSymbol ? signals.find(s => s.symbol === selectedSymbol) : null;

    const confColor = (c: number) => c >= 80 ? '#22c55e' : c >= 65 ? '#f59e0b' : '#94a3b8';
    const confLabel = (c: number) => c >= 80 ? 'HIGH' : c >= 65 ? 'MEDIUM' : 'LOW';

    return (
        <div className='elite-prime-ai'>
            <div className='epa-header'>
                <div className='epa-header__brand'>
                    <div className='epa-header__icon'>🤖</div>
                    <div>
                        <h1 className='epa-header__title'>Elite Prime AI</h1>
                        <p className='epa-header__subtitle'>
                            {connected
                                ? `AI Engine Active · ${activeCount} signal${activeCount !== 1 ? 's' : ''} detected`
                                : 'Initialising AI engine…'}
                        </p>
                    </div>
                </div>
                <div className='epa-header__stats'>
                    <div className='epa-stat'>
                        <span className='epa-stat__label'>Active</span>
                        <span className='epa-stat__value epa-stat__value--green'>{activeCount}</span>
                    </div>
                    <div className='epa-stat'>
                        <span className='epa-stat__label'>Markets</span>
                        <span className='epa-stat__value'>{SYMBOLS.length}</span>
                    </div>
                </div>
            </div>

            {selectedSig && (
                <div className='epa-detail-card'>
                    <div className='epa-detail-card__header'>
                        <span className='epa-detail-card__label'>{selectedSig.label}</span>
                        <button className='epa-detail-card__close' onClick={() => setSelectedSymbol(null)}>✕</button>
                    </div>
                    <div className='epa-detail-card__body'>
                        <div className='epa-detail-card__direction'>{selectedSig.direction}</div>
                        <div className='epa-detail-card__conf-ring' style={{ '--conf-color': confColor(selectedSig.confidence) } as React.CSSProperties}>
                            <div className='epa-detail-card__conf-val'>{selectedSig.confidence}%</div>
                            <div className='epa-detail-card__conf-label'>{confLabel(selectedSig.confidence)}</div>
                        </div>
                        <div className='epa-detail-card__note'>{selectedSig.analysisNote}</div>
                        <div className='epa-detail-card__meta'>
                            <span>Contract: <strong>{selectedSig.contractType}</strong></span>
                            {selectedSig.digitSuggestion !== '—' && <span>Digit: <strong>{selectedSig.digitSuggestion}</strong></span>}
                            <span>Price: <strong>{selectedSig.lastPrice.toFixed(4)}</strong></span>
                            <span>Ticks: <strong>{selectedSig.tickCount}</strong></span>
                        </div>
                    </div>
                </div>
            )}

            <div className='epa-grid'>
                {signals.map(sig => (
                    <button
                        key={sig.symbol}
                        className={`epa-card ${sig.status === 'active' ? 'epa-card--active' : ''} ${selectedSymbol === sig.symbol ? 'epa-card--selected' : ''}`}
                        onClick={() => setSelectedSymbol(sig.symbol === selectedSymbol ? null : sig.symbol)}
                    >
                        <div className='epa-card__top'>
                            <span className='epa-card__symbol'>{sig.label}</span>
                            <span className='epa-card__badge' style={{ color: confColor(sig.confidence), borderColor: confColor(sig.confidence) }}>
                                {sig.status === 'loading' ? '...' : confLabel(sig.confidence)}
                            </span>
                        </div>

                        <div className='epa-card__direction'>
                            {sig.status === 'loading' ? 'Analysing…' : sig.direction}
                        </div>

                        <div className='epa-card__conf-bar'>
                            <div className='epa-card__conf-bar-fill' style={{ width: `${sig.confidence}%`, background: confColor(sig.confidence) }} />
                        </div>
                        <div className='epa-card__conf-text'>{sig.confidence}% confidence</div>

                        <div className={`epa-card__trend epa-card__trend--${sig.trend}`}>
                            {sig.trend === 'bullish' ? '▲ Bullish' : sig.trend === 'bearish' ? '▼ Bearish' : '— Ranging'}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ElitePrimeAI;

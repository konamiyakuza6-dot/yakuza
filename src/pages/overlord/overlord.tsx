import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAppId, getSocketURL } from '@/components/shared';
import './overlord.scss';

interface MarketData {
    symbol: string;
    label: string;
    price: number;
    prevPrice: number;
    direction: 'up' | 'down' | 'flat';
    riseStrength: number;
    fallStrength: number;
    digitDist: number[];
    tickCount: number;
    strategy: string;
    confidence: number;
}

interface BotState {
    isRunning: boolean;
    sessionPnl: number;
    winCount: number;
    lossCount: number;
    tradesPlaced: number;
}

const SYMBOLS = [
    { symbol: 'R_10', label: 'Vol 10' },
    { symbol: 'R_25', label: 'Vol 25' },
    { symbol: 'R_50', label: 'Vol 50' },
    { symbol: 'R_75', label: 'Vol 75' },
    { symbol: 'R_100', label: 'Vol 100' },
    { symbol: '1HZ10V', label: 'Vol 10(1s)' },
    { symbol: '1HZ25V', label: 'Vol 25(1s)' },
    { symbol: '1HZ50V', label: 'Vol 50(1s)' },
    { symbol: '1HZ75V', label: 'Vol 75(1s)' },
    { symbol: '1HZ100V', label: 'Vol 100(1s)' },
];

const STRATEGIES = [
    { id: 'rise-fall', name: 'Rise / Fall', icon: '📈' },
    { id: 'over-under', name: 'Over / Under', icon: '🎯' },
    { id: 'digit-match', name: 'Digit Match', icon: '🎯' },
    { id: 'even-odd', name: 'Even / Odd', icon: '⚖️' },
    { id: 'ai-hybrid', name: 'AI Hybrid', icon: '🤖' },
];

function analyzeMarket(ticks: number[]): { strategy: string; confidence: number; riseStrength: number; fallStrength: number; digitDist: number[] } {
    if (ticks.length < 30) return { strategy: 'Collecting…', confidence: 0, riseStrength: 50, fallStrength: 50, digitDist: new Array(10).fill(10) };

    const last255 = ticks.slice(-255);
    let rises = 0, falls = 0;
    for (let i = 1; i < last255.length; i++) {
        if (last255[i] > last255[i - 1]) rises++;
        else if (last255[i] < last255[i - 1]) falls++;
    }
    const total = rises + falls || 1;
    const rPct = (rises / total) * 100;
    const fPct = (falls / total) * 100;

    const digitCounts = new Array(10).fill(0);
    last255.forEach(t => {
        const s = t.toFixed(2);
        const d = parseInt(s[s.length - 1]);
        if (d >= 0 && d <= 9) digitCounts[d]++;
    });
    const digitDist = digitCounts.map(c => Math.round((c / last255.length) * 100));

    let strategy = 'Ranging';
    let confidence = 45;

    if (rPct > 57) { strategy = '📈 Rise'; confidence = Math.min(92, Math.round(rPct * 1.4)); }
    else if (fPct > 57) { strategy = '📉 Fall'; confidence = Math.min(92, Math.round(fPct * 1.4)); }
    else if (digitDist[7] < 8 && digitDist[8] < 8 && digitDist[9] < 8) { strategy = '🔼 Over 2'; confidence = 78; }
    else if (digitDist[0] < 8 && digitDist[1] < 8 && digitDist[2] < 8) { strategy = '🔽 Under 7'; confidence = 78; }
    else { const minD = digitDist.indexOf(Math.min(...digitDist)); strategy = `🎯 Match ${minD}`; confidence = 65; }

    return { strategy, confidence, riseStrength: Math.round(rPct), fallStrength: Math.round(fPct), digitDist };
}

const Overlord: React.FC = () => {
    const [markets, setMarkets] = useState<MarketData[]>(
        SYMBOLS.map(s => ({ ...s, price: 0, prevPrice: 0, direction: 'flat', riseStrength: 50, fallStrength: 50, digitDist: new Array(10).fill(10), tickCount: 0, strategy: 'Connecting…', confidence: 0 }))
    );
    const [connected, setConnected] = useState(false);
    const [selectedStrategy, setSelectedStrategy] = useState('rise-fall');
    const [selectedSymbol, setSelectedSymbol] = useState('R_100');
    const [botState, setBotState] = useState<BotState>({ isRunning: false, sessionPnl: 0, winCount: 0, lossCount: 0, tradesPlaced: 0 });
    const [log, setLog] = useState<string[]>(['[OVERLORD-2026] System initialising…']);
    const ticksRef = useRef<Record<string, number[]>>({});

    const addLog = useCallback((msg: string) => {
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    }, []);

    const computeAll = useCallback(() => {
        setMarkets(prev => prev.map(m => {
            const ticks = ticksRef.current[m.symbol] || [];
            const { strategy, confidence, riseStrength, fallStrength, digitDist } = analyzeMarket(ticks);
            const price = ticks[ticks.length - 1] || m.price;
            const prevPrice = ticks[ticks.length - 2] || m.prevPrice;
            const direction: 'up' | 'down' | 'flat' = price > prevPrice ? 'up' : price < prevPrice ? 'down' : 'flat';
            return { ...m, price, prevPrice, direction, strategy, confidence, riseStrength, fallStrength, digitDist, tickCount: ticks.length };
        }));
    }, []);

    useEffect(() => {
        const ws = new WebSocket(`wss://${getSocketURL()}/websockets/v3?app_id=${getAppId()}`);

        ws.onopen = () => {
            setConnected(true);
            addLog('WebSocket connected — subscribing to all markets…');
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

        ws.onclose = () => { setConnected(false); addLog('Connection lost — reconnecting…'); };

        const interval = setInterval(computeAll, 1500);

        return () => { clearInterval(interval); ws.close(); };
    }, [computeAll, addLog]);

    const selectedMarket = markets.find(m => m.symbol === selectedSymbol);

    const toggleBot = () => {
        setBotState(prev => {
            const next = !prev.isRunning;
            addLog(next
                ? `▶ Overlord-2026 ACTIVATED — Strategy: ${STRATEGIES.find(s => s.id === selectedStrategy)?.name}, Market: ${selectedMarket?.label}`
                : '■ Overlord-2026 STOPPED by user');
            return { ...prev, isRunning: next };
        });
    };

    const confColor = (c: number) => c >= 75 ? '#22c55e' : c >= 60 ? '#f59e0b' : '#94a3b8';

    return (
        <div className='overlord'>
            {/* HEADER */}
            <div className='overlord__header'>
                <div className='overlord__header-brand'>
                    <div className='overlord__logo'>⚔️</div>
                    <div>
                        <h1 className='overlord__title'>OVERLORD-2026</h1>
                        <div className='overlord__tagline'>Advanced Multi-Strategy Trading Command Centre</div>
                    </div>
                </div>
                <div className='overlord__header-right'>
                    <div className={`overlord__conn-status ${connected ? 'overlord__conn-status--live' : ''}`}>
                        <span className='overlord__conn-dot' />
                        {connected ? 'LIVE' : 'CONNECTING'}
                    </div>
                    <button
                        className={`overlord__run-btn ${botState.isRunning ? 'overlord__run-btn--stop' : 'overlord__run-btn--start'}`}
                        onClick={toggleBot}
                    >
                        {botState.isRunning ? '■ STOP ENGINE' : '▶ START ENGINE'}
                    </button>
                </div>
            </div>

            <div className='overlord__body'>
                {/* LEFT: Controls */}
                <div className='overlord__controls'>
                    <div className='overlord__panel'>
                        <div className='overlord__panel-title'>Strategy</div>
                        {STRATEGIES.map(s => (
                            <button
                                key={s.id}
                                className={`overlord__strat-btn ${selectedStrategy === s.id ? 'overlord__strat-btn--active' : ''}`}
                                onClick={() => { setSelectedStrategy(s.id); addLog(`Strategy changed → ${s.name}`); }}
                            >
                                <span>{s.icon}</span> {s.name}
                            </button>
                        ))}
                    </div>

                    <div className='overlord__panel'>
                        <div className='overlord__panel-title'>Target Market</div>
                        <div className='overlord__symbol-grid'>
                            {SYMBOLS.map(s => {
                                const m = markets.find(mk => mk.symbol === s.symbol);
                                return (
                                    <button
                                        key={s.symbol}
                                        className={`overlord__sym-btn ${selectedSymbol === s.symbol ? 'overlord__sym-btn--active' : ''} ${m?.direction === 'up' ? 'overlord__sym-btn--up' : m?.direction === 'down' ? 'overlord__sym-btn--down' : ''}`}
                                        onClick={() => setSelectedSymbol(s.symbol)}
                                    >
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className='overlord__panel'>
                        <div className='overlord__panel-title'>Session Stats</div>
                        <div className='overlord__stats'>
                            <div className='overlord__stat'>
                                <span className='overlord__stat-label'>P&L</span>
                                <span className={`overlord__stat-val ${botState.sessionPnl >= 0 ? 'overlord__stat-val--pos' : 'overlord__stat-val--neg'}`}>
                                    {botState.sessionPnl >= 0 ? '+' : ''}{botState.sessionPnl.toFixed(2)}
                                </span>
                            </div>
                            <div className='overlord__stat'>
                                <span className='overlord__stat-label'>Trades</span>
                                <span className='overlord__stat-val'>{botState.tradesPlaced}</span>
                            </div>
                            <div className='overlord__stat'>
                                <span className='overlord__stat-label'>Wins</span>
                                <span className='overlord__stat-val overlord__stat-val--pos'>{botState.winCount}</span>
                            </div>
                            <div className='overlord__stat'>
                                <span className='overlord__stat-label'>Losses</span>
                                <span className='overlord__stat-val overlord__stat-val--neg'>{botState.lossCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTRE: Market Analysis */}
                <div className='overlord__centre'>
                    {selectedMarket && (
                        <div className='overlord__market-detail'>
                            <div className='overlord__md-header'>
                                <div>
                                    <div className='overlord__md-symbol'>{selectedMarket.label}</div>
                                    <div className={`overlord__md-price overlord__md-price--${selectedMarket.direction}`}>
                                        {selectedMarket.price > 0 ? selectedMarket.price.toFixed(4) : '—'}
                                        <span className='overlord__md-arrow'>
                                            {selectedMarket.direction === 'up' ? ' ▲' : selectedMarket.direction === 'down' ? ' ▼' : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className='overlord__md-signal'>
                                    <div className='overlord__md-strategy'>{selectedMarket.strategy}</div>
                                    <div className='overlord__md-conf' style={{ color: confColor(selectedMarket.confidence) }}>
                                        {selectedMarket.confidence}% confidence
                                    </div>
                                </div>
                            </div>

                            <div className='overlord__strength-section'>
                                <div className='overlord__strength-row'>
                                    <span>Rise</span>
                                    <div className='overlord__bar'>
                                        <div className='overlord__bar-fill overlord__bar-fill--rise' style={{ width: `${selectedMarket.riseStrength}%` }} />
                                    </div>
                                    <span className='overlord__bar-val'>{selectedMarket.riseStrength}%</span>
                                </div>
                                <div className='overlord__strength-row'>
                                    <span>Fall</span>
                                    <div className='overlord__bar'>
                                        <div className='overlord__bar-fill overlord__bar-fill--fall' style={{ width: `${selectedMarket.fallStrength}%` }} />
                                    </div>
                                    <span className='overlord__bar-val'>{selectedMarket.fallStrength}%</span>
                                </div>
                            </div>

                            <div className='overlord__digit-section'>
                                <div className='overlord__section-label'>Digit Distribution (last 255 ticks)</div>
                                <div className='overlord__digit-bars'>
                                    {selectedMarket.digitDist.map((pct, d) => (
                                        <div key={d} className='overlord__digit-col'>
                                            <div className='overlord__digit-bar-wrap'>
                                                <div
                                                    className={`overlord__digit-bar ${pct < 8 ? 'overlord__digit-bar--cold' : pct > 13 ? 'overlord__digit-bar--hot' : ''}`}
                                                    style={{ height: `${Math.max(4, pct * 4)}px` }}
                                                />
                                            </div>
                                            <span className='overlord__digit-label'>{d}</span>
                                            <span className='overlord__digit-pct'>{pct}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All markets mini-cards */}
                    <div className='overlord__mini-markets'>
                        {markets.map(m => (
                            <button
                                key={m.symbol}
                                className={`overlord__mini-card ${selectedSymbol === m.symbol ? 'overlord__mini-card--selected' : ''} overlord__mini-card--${m.direction}`}
                                onClick={() => setSelectedSymbol(m.symbol)}
                            >
                                <div className='overlord__mini-label'>{m.label}</div>
                                <div className={`overlord__mini-price overlord__mini-price--${m.direction}`}>
                                    {m.price > 0 ? m.price.toFixed(3) : '—'}
                                </div>
                                <div className='overlord__mini-strategy' style={{ color: confColor(m.confidence) }}>
                                    {m.strategy}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Activity Log */}
                <div className='overlord__log-panel'>
                    <div className='overlord__panel-title'>Activity Log</div>
                    <div className='overlord__log'>
                        {log.map((entry, i) => (
                            <div key={i} className={`overlord__log-entry ${i === 0 ? 'overlord__log-entry--new' : ''}`}>
                                {entry}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Overlord;

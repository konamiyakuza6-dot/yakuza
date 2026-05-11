import React, { useCallback, useRef, useState } from 'react';
import { ALL_SYMBOLS, SYMBOL_LABELS, PIP_SIZES, openMakotiWS, MakotiWS } from './makoti-ws';

type BotId = 'pvty_kill' | 'rf_v4';

interface SymbolDigitResult {
    symbol: string;
    label: string;
    pcts: number[];       // percentage for each digit 0-9
    totalTicks: number;
    qualifies: boolean;
    detail: string;
}

interface SymbolDirectionResult {
    symbol: string;
    label: string;
    sidewaysScore: number;
    upPct: number;
    downPct: number;
    qualifies: boolean;
    detail: string;
}

type ScanResult = SymbolDigitResult | SymbolDirectionResult;

function isDigitResult(r: ScanResult): r is SymbolDigitResult {
    return (r as SymbolDigitResult).pcts !== undefined;
}

// Exactly the same digit-percentage algorithm used in over-under-store & OverUnder.tsx:
// count occurrences of each digit in the full tick array, divide by array length
function calcDigitPcts(digits: number[]): number[] {
    const counts = Array(10).fill(0);
    digits.forEach(d => { if (d >= 0 && d <= 9) counts[d]++; });
    const total = digits.length || 1;
    return counts.map(c => (c / total) * 100);
}

export const Scanner: React.FC = () => {
    const [bot, setBot]             = useState<BotId>('pvty_kill');
    const [scanning, setScanning]   = useState(false);
    const [progress, setProgress]   = useState('');
    const [results, setResults]     = useState<ScanResult[]>([]);
    const [bestSymbols, setBestSymbols] = useState<string[]>([]);
    const wsRef        = useRef<MakotiWS | null>(null);
    const pendingRef   = useRef<Set<string>>(new Set());
    const collectedRef = useRef<Map<string, any>>(new Map());
    const botRef       = useRef<BotId>('pvty_kill');

    const cleanup = useCallback(() => {
        try { wsRef.current?.close(); } catch (_) {}
        wsRef.current = null;
    }, []);

    const analyze = useCallback(() => {
        if (scanning) return;
        botRef.current = bot;
        setScanning(true);
        setProgress('Connecting to Deriv API…');
        setResults([]);
        setBestSymbols([]);
        pendingRef.current   = new Set(ALL_SYMBOLS);
        collectedRef.current = new Map();
        cleanup();

        const isTicks = bot === 'pvty_kill';

        /* ── pvty_kill finalize ───────────────────────────────────────────────
           Algorithm identical to OverUnder.tsx:
             digitStats[d] = count of d in full tick array
             pct[d]        = digitStats[d] / total * 100
           Criterion: digits 7, 8 AND 9 must each be > 10%
        ────────────────────────────────────────────────────────────────────── */
        const finalizePvty = () => {
            const scanResults: SymbolDigitResult[] = [];
            const best: string[] = [];

            collectedRef.current.forEach((digits: number[], sym) => {
                const pcts = calcDigitPcts(digits);
                const d7 = pcts[7], d8 = pcts[8], d9 = pcts[9];
                const qualifies = d7 > 10 && d8 > 10 && d9 > 10;
                if (qualifies) best.push(sym);

                scanResults.push({
                    symbol: sym,
                    label: SYMBOL_LABELS[sym],
                    pcts,
                    totalTicks: digits.length,
                    qualifies,
                    detail: `7: ${d7.toFixed(1)}%  |  8: ${d8.toFixed(1)}%  |  9: ${d9.toFixed(1)}%`,
                });
            });

            // Sort: best combined 7+8+9 score first
            scanResults.sort((a, b) =>
                (b.pcts[7] + b.pcts[8] + b.pcts[9]) - (a.pcts[7] + a.pcts[8] + a.pcts[9])
            );

            setResults(scanResults);
            setBestSymbols(best);
            setScanning(false);
            setProgress(
                best.length > 0
                    ? `✅ Found ${best.length} volatility match${best.length > 1 ? 'es' : ''}`
                    : 'No volatility matched all three criteria. Try again.'
            );
            cleanup();
        };

        /* ── rf_v4 finalize ─────────────────────────────────────────────────
           Candle-direction analysis: counts up/down candles, body vs range.
           Sideways = balanced up/down AND small candle bodies (relative to range).
        ────────────────────────────────────────────────────────────────────── */
        const finalizeRfV4 = () => {
            const scanResults: SymbolDirectionResult[] = [];
            const best: string[] = [];

            collectedRef.current.forEach((candles: any[], sym) => {
                if (!candles || candles.length < 5) return;
                const recent = candles.slice(-10);
                let up = 0, down = 0, totalBody = 0, totalRange = 0;

                for (const c of recent) {
                    const o = Number(c.open), cl = Number(c.close);
                    const h = Number(c.high), lo = Number(c.low);
                    if (cl > o) up++; else if (cl < o) down++;
                    totalBody  += Math.abs(cl - o);
                    totalRange += (h - lo) || 0.00001;
                }

                const total         = recent.length;
                const upPct         = (up   / total) * 100;
                const downPct       = (down / total) * 100;
                const balanceBias   = Math.abs(upPct - downPct);          // lower = more sideways
                const bodyShadowRatio = totalBody / totalRange;            // lower = smaller bodies
                const sidewaysScore = 100 - balanceBias - bodyShadowRatio * 20;
                const qualifies     = balanceBias < 15 && bodyShadowRatio < 0.55;
                if (qualifies) best.push(sym);

                scanResults.push({
                    symbol: sym, label: SYMBOL_LABELS[sym],
                    sidewaysScore, upPct, downPct, qualifies,
                    detail: `↑ ${upPct.toFixed(0)}%  ↓ ${downPct.toFixed(0)}%  |  Body/Range: ${(bodyShadowRatio * 100).toFixed(0)}%`,
                });
            });

            scanResults.sort((a, b) => b.sidewaysScore - a.sidewaysScore);
            setResults(scanResults);
            setBestSymbols(best);
            setScanning(false);
            setProgress(
                best.length > 0
                    ? `✅ Found ${best.length} sideways volatility match${best.length > 1 ? 'es' : ''}`
                    : 'No clear sideways volatility found. Try again.'
            );
            cleanup();
        };

        /* ── Message handler ─────────────────────────────────────────────── */
        const handleMessage = (data: any) => {
            if (data.error) return;

            if (isTicks && data.msg_type === 'history' && data.history?.prices) {
                const sym: string = data.echo_req?.ticks_history;
                if (!sym || !pendingRef.current.has(sym)) return;
                pendingRef.current.delete(sym);

                const pip    = PIP_SIZES[sym] || 2;
                // Extract last digit of each price — exactly as over-under-store does
                const digits = (data.history.prices as (string | number)[])
                    .map(p => Number(Number(p).toFixed(pip).slice(-1)));

                collectedRef.current.set(sym, digits);
                setProgress(`Scanned ${ALL_SYMBOLS.length - pendingRef.current.size} / ${ALL_SYMBOLS.length} volatilities…`);
                if (pendingRef.current.size === 0) finalizePvty();
            }

            if (!isTicks && data.msg_type === 'candles' && data.candles) {
                const sym: string = data.echo_req?.ticks_history;
                if (!sym || !pendingRef.current.has(sym)) return;
                pendingRef.current.delete(sym);
                collectedRef.current.set(sym, data.candles);
                setProgress(`Scanned ${ALL_SYMBOLS.length - pendingRef.current.size} / ${ALL_SYMBOLS.length} volatilities…`);
                if (pendingRef.current.size === 0) finalizeRfV4();
            }
        };

        /* ── Open WS and send requests on ready ─────────────────────────── */
        const mws = openMakotiWS(
            handleMessage,
            () => {
                setProgress('Fetching 1 000 ticks from all 10 volatilities…');
                ALL_SYMBOLS.forEach(sym => {
                    if (isTicks) {
                        // 1 000 ticks — matches MAX_TICKS in over-under-store
                        mws.send({ ticks_history: sym, count: 1000, end: 'latest', style: 'ticks' });
                    } else {
                        mws.send({ ticks_history: sym, count: 10, end: 'latest', style: 'candles', granularity: 60 });
                    }
                });
            },
            () => {
                if (pendingRef.current.size > 0) {
                    setScanning(false);
                    setProgress('Connection closed early. Please retry.');
                }
            }
        );
        wsRef.current = mws;

        // Safety timeout
        setTimeout(() => {
            if (pendingRef.current.size > 0) {
                setScanning(false);
                setProgress('Scan timed out. Please retry.');
                cleanup();
            }
        }, 25000);
    }, [bot, scanning, cleanup]);

    return (
        <div className='mw-scanner'>
            <div className='mw-scanner__controls'>
                <div className='mw-field'>
                    <label className='mw-label'>Bot Selection</label>
                    <select
                        className='mw-select'
                        value={bot}
                        onChange={e => setBot(e.target.value as BotId)}
                        disabled={scanning}
                    >
                        <option value='pvty_kill'>pvty kill</option>
                        <option value='rf_v4'>rf v4</option>
                    </select>
                </div>

                <div className='mw-scanner__desc'>
                    {bot === 'pvty_kill'
                        ? 'Scans 1 000 ticks per volatility. Finds markets where digits 7, 8 and 9 each exceed 10% — ideal for high-digit strategies.'
                        : 'Analyzes the last 10 candles per volatility. Finds markets with no clear direction — balanced up/down with small candle bodies.'}
                </div>

                <button
                    className={`mw-btn mw-btn--scan${scanning ? ' mw-btn--busy' : ''}`}
                    onClick={analyze}
                    disabled={scanning}
                >
                    {scanning ? <><span className='mw-spin' /> Analyzing…</> : 'Analyze'}
                </button>

                {progress && <div className='mw-scanner__progress'>{progress}</div>}
            </div>

            {results.length > 0 && (
                <div className='mw-scanner__results'>
                    <div className='mw-scanner__results-head'>
                        {bot === 'pvty_kill' ? 'Digit 7 / 8 / 9 Distribution (1 000 ticks)' : 'Candle Direction Analysis'}
                    </div>

                    {bestSymbols.length > 0 && (
                        <div className='mw-scanner__best'>
                            <span className='mw-scanner__best-lbl'>Best:</span>
                            {bestSymbols.map(s => (
                                <span key={s} className='mw-scanner__badge'>{SYMBOL_LABELS[s]}</span>
                            ))}
                        </div>
                    )}

                    <div className='mw-scanner__list'>
                        {results.map(r => (
                            <div
                                key={r.symbol}
                                className={`mw-scanner__row${r.qualifies ? ' mw-scanner__row--match' : ''}`}
                            >
                                <div className='mw-scanner__row-head'>
                                    <span className='mw-scanner__sym'>{r.label}</span>
                                    <span className='mw-scanner__row-detail'>{r.detail}</span>
                                    {r.qualifies && <span className='mw-scanner__tag'>MATCH</span>}
                                </div>

                                {isDigitResult(r) && (
                                    <div className='mw-scanner__bars'>
                                        {r.pcts.map((p, i) => (
                                            <div
                                                key={i}
                                                className={`mw-scanner__bar-wrap${[7, 8, 9].includes(i) ? ' mw-scanner__bar-wrap--hi' : ''}`}
                                                title={`Digit ${i}: ${p.toFixed(2)}%`}
                                            >
                                                <div
                                                    className='mw-scanner__bar-fill'
                                                    style={{ height: `${Math.min(100, p * 4)}%` }}
                                                />
                                                <span className='mw-scanner__bar-pct'>{p.toFixed(0)}%</span>
                                                <span className='mw-scanner__bar-lbl'>{i}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!isDigitResult(r) && (() => {
                                    const dr = r as SymbolDirectionResult;
                                    return (
                                        <div className='mw-scanner__dir-bar'>
                                            <div className='mw-scanner__dir-up'   style={{ width: `${dr.upPct}%` }} />
                                            <div className='mw-scanner__dir-down' style={{ width: `${dr.downPct}%` }} />
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

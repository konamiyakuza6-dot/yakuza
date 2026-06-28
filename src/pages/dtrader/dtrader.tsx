import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { isProduction, WS_SERVERS } from '@/components/shared';
import { useStore } from '@/hooks/useStore';
import { contract_stages } from '@/constants/contract-stage';
import { run_panel as run_panel_tabs } from '@/constants/run-panel';
import './dtrader.scss';

const DERIV_WS_URL = isProduction() ? WS_SERVERS.PRODUCTION : WS_SERVERS.STAGING;

const CONTRACT_TYPE_MAP: Record<string, string> = {
    RISE: 'CALL',
    FALL: 'PUT',
    EVEN: 'DIGITEVEN',
    ODD: 'DIGITODD',
    OVER: 'DIGITOVER',
    UNDER: 'DIGITUNDER',
    MATCHES: 'DIGITMATCH',
    DIFFERS: 'DIGITDIFF',
};

const DIGIT_TYPES = ['OVER', 'UNDER', 'MATCHES', 'DIFFERS'];

const SYMBOLS = [
    { value: '1HZ100V', label: 'Volatility 100 (1s)' },
    { value: '1HZ75V',  label: 'Volatility 75 (1s)'  },
    { value: '1HZ50V',  label: 'Volatility 50 (1s)'  },
    { value: '1HZ25V',  label: 'Volatility 25 (1s)'  },
    { value: '1HZ10V',  label: 'Volatility 10 (1s)'  },
    { value: 'R_100',   label: 'Volatility 100'       },
    { value: 'R_75',    label: 'Volatility 75'        },
    { value: 'R_50',    label: 'Volatility 50'        },
    { value: 'R_25',    label: 'Volatility 25'        },
    { value: 'R_10',    label: 'Volatility 10'        },
];

const CONTRACT_TYPES = [
    { value: 'RISE',    label: 'Rise'    },
    { value: 'FALL',    label: 'Fall'    },
    { value: 'EVEN',    label: 'Even'    },
    { value: 'ODD',     label: 'Odd'     },
    { value: 'OVER',    label: 'Over'    },
    { value: 'UNDER',   label: 'Under'   },
    { value: 'MATCHES', label: 'Matches' },
    { value: 'DIFFERS', label: 'Differs' },
];

type TradeRecord = {
    id: string;
    contractType: string;
    symbol: string;
    stake: string;
    profit: number | null;
    status: 'PENDING' | 'WIN' | 'LOSS';
    time: string;
};

const s: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#070e1c',
        padding: '24px',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        color: '#dceaf8',
    },
    header: {
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: '16px',
        marginBottom: '24px',
    },
    title: {
        fontSize: '18px',
        fontWeight: 700,
        color: '#10b981',
        margin: 0,
        letterSpacing: '0.05em',
    },
    subtitle: {
        fontSize: '11px',
        color: '#7fa0be',
        marginTop: '4px',
    },
    statusBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '8px',
    },
    dot: (connected: boolean) => ({
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: connected ? '#10b981' : '#ef4444',
        boxShadow: connected ? '0 0 6px #10b981' : 'none',
    }),
    statusText: (connected: boolean) => ({
        fontSize: '11px',
        color: connected ? '#10b981' : '#ef4444',
    }),
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '6px',
    },
    label: {
        fontSize: '10px',
        fontWeight: 700,
        color: '#7fa0be',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
    },
    select: {
        background: '#0d1b2e',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#dceaf8',
        padding: '10px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        width: '100%',
        cursor: 'pointer',
    },
    input: {
        background: '#0d1b2e',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#dceaf8',
        padding: '10px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        width: '100%',
        boxSizing: 'border-box' as const,
    },
    buyBtn: (busy: boolean) => ({
        width: '100%',
        padding: '14px',
        borderRadius: '8px',
        border: 'none',
        background: busy ? '#1a3a2a' : 'linear-gradient(90deg, #10b981, #059669)',
        color: busy ? '#7fa0be' : '#fff',
        fontSize: '14px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        cursor: busy ? 'not-allowed' : 'pointer',
        marginBottom: '24px',
        transition: 'all 0.2s',
    }),
    errorBox: {
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#ef4444',
        padding: '10px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        marginBottom: '16px',
    },
    tradesHeader: {
        fontSize: '11px',
        fontWeight: 700,
        color: '#7fa0be',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        marginBottom: '10px',
    },
    tradeRow: (status: string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        borderRadius: '6px',
        marginBottom: '6px',
        background: '#0d1b2e',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
    }),
    tradeBar: (status: string) => ({
        width: '4px',
        alignSelf: 'stretch',
        background: status === 'WIN' ? '#10b981' : status === 'LOSS' ? '#ef4444' : '#f59e0b',
        flexShrink: 0,
    }),
    tradeContent: {
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: '8px',
    },
    tradeType: {
        fontSize: '11px',
        fontWeight: 700,
        color: '#dceaf8',
        minWidth: '60px',
    },
    tradeSymbol: {
        fontSize: '10px',
        color: '#7fa0be',
        flex: 1,
    },
    tradeStake: {
        fontSize: '11px',
        color: '#7fa0be',
    },
    tradeProfit: (profit: number | null) => ({
        fontSize: '12px',
        fontWeight: 700,
        color: profit === null ? '#f59e0b' : profit >= 0 ? '#10b981' : '#ef4444',
        minWidth: '60px',
        textAlign: 'right' as const,
    }),
    tradeTime: {
        fontSize: '10px',
        color: '#3a526b',
        minWidth: '56px',
        textAlign: 'right' as const,
    },
    emptyTrades: {
        textAlign: 'center' as const,
        color: '#3a526b',
        fontSize: '12px',
        padding: '32px 0',
    },
};

const Dtrader = observer(() => {
    const store = useStore();
    const { client, transactions, summary_card, journal, run_panel } = store || {};

    const [symbol, setSymbol] = useState('1HZ100V');
    const [contractType, setContractType] = useState('RISE');
    const [stake, setStake] = useState('1');
    const [duration, setDuration] = useState('1');
    const [barrier, setBarrier] = useState('5');
    const [isBuying, setIsBuying] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [error, setError] = useState('');
    const [trades, setTrades] = useState<TradeRecord[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const pendingContractRef = useRef<TradeRecord | null>(null);
    const shouldConnectRef = useRef(true);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getAuth = useCallback(() => {
        try {
            const loginid = localStorage.getItem('active_loginid');
            if (!loginid) return null;
            const raw = localStorage.getItem('clientAccounts');
            if (!raw) return null;
            const accounts = JSON.parse(raw);
            const token = accounts[loginid]?.token;
            if (!token) return null;
            return { token, loginid };
        } catch {
            return null;
        }
    }, []);

    const publishContract = useCallback((contract_data: any) => {
        transactions?.onBotContractEvent?.(contract_data);
        summary_card?.onBotContractEvent?.(contract_data);
    }, [transactions, summary_card]);

    const handleMessage = useCallback((event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (data.msg_type === 'authorize') {
            setIsAuthorized(true);
            setError('');
            return;
        }

        if (data.error) {
            setError(data.error.message || 'Trade error');
            setIsBuying(false);
            if (pendingContractRef.current) {
                setTrades(prev => prev.map(t =>
                    t.id === pendingContractRef.current?.id
                        ? { ...t, status: 'LOSS', profit: -parseFloat(t.stake) }
                        : t
                ));
                pendingContractRef.current = null;
            }
            return;
        }

        if (data.msg_type === 'proposal') {
            const { id: proposal_id, ask_price } = data.proposal || {};
            if (proposal_id && ask_price !== undefined && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ buy: proposal_id, price: ask_price }));
            }
            return;
        }

        if (data.msg_type === 'buy') {
            const { contract_id, buy_price } = data.buy || {};
            if (!contract_id) {
                setIsBuying(false);
                return;
            }
            const rec: TradeRecord = {
                id: String(contract_id),
                contractType,
                symbol,
                stake: Number(buy_price || stake).toFixed(2),
                profit: null,
                status: 'PENDING',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
            pendingContractRef.current = rec;
            setTrades(prev => [rec, ...prev].slice(0, 50));

            const payload: any = {
                id: contract_id,
                contract_id,
                buy_price: parseFloat(rec.stake),
                currency: client?.currency || 'USD',
                underlying: symbol,
                underlying_symbol: symbol,
                contract_type: CONTRACT_TYPE_MAP[contractType] || contractType,
                date_start: Math.floor(Date.now() / 1000),
            };
            publishContract(payload);
            run_panel?.setHasOpenContract?.(true);
            run_panel?.setContractStage?.(contract_stages.PURCHASE_RECEIVED);

            wsRef.current?.send(JSON.stringify({ proposal_open_contract: 1, contract_id, subscribe: 1 }));
            return;
        }

        if (data.msg_type === 'proposal_open_contract') {
            const c = data.proposal_open_contract;
            if (!c || !pendingContractRef.current) return;

            const is_sold = c.is_sold === 1 || c.is_sold === true || c.is_expired === 1 || String(c.status || '').toLowerCase() !== 'open';
            if (!is_sold) return;

            const profit = parseFloat(c.profit ?? 0);
            const status: 'WIN' | 'LOSS' = profit >= 0 ? 'WIN' : 'LOSS';
            const cid = String(c.contract_id);

            setTrades(prev => prev.map(t =>
                t.id === cid ? { ...t, profit, status } : t
            ));

            const native: any = {
                ...(pendingContractRef.current as any),
                ...c,
                id: c.contract_id,
                contract_id: c.contract_id,
                profit,
                is_sold: true,
                result: profit >= 0 ? 'won' : 'lost',
            };
            publishContract(native);

            if (journal?.onLogSuccess) {
                journal.onLogSuccess({
                    log_type: profit > 0 ? 'profit' : 'lost',
                    extra: { currency: client?.currency || 'USD', profit },
                });
            }

            run_panel?.setHasOpenContract?.(false);
            run_panel?.setContractStage?.(contract_stages.CONTRACT_CLOSED);
            run_panel?.setIsRunning?.(false);

            pendingContractRef.current = null;
            setIsBuying(false);
        }
    }, [contractType, symbol, stake, client, publishContract, journal, run_panel]);

    const connect = useCallback(() => {
        if (!shouldConnectRef.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        const ws = new WebSocket(DERIV_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            const auth = getAuth();
            if (auth) {
                ws.send(JSON.stringify({ authorize: auth.token }));
            }
        };

        ws.onmessage = handleMessage;

        ws.onerror = () => setIsConnected(false);

        ws.onclose = () => {
            setIsConnected(false);
            setIsAuthorized(false);
            wsRef.current = null;
            if (shouldConnectRef.current) {
                reconnectRef.current = setTimeout(connect, 2000);
            }
        };
    }, [getAuth, handleMessage]);

    useEffect(() => {
        shouldConnectRef.current = true;
        connect();
        return () => {
            shouldConnectRef.current = false;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    const handleBuy = useCallback(() => {
        if (isBuying) return;
        if (!isAuthorized) {
            setError('Not connected — please wait or check your login.');
            return;
        }
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setError('WebSocket not ready. Reconnecting...');
            connect();
            return;
        }

        const parsedStake = parseFloat(stake);
        const parsedDuration = Math.max(1, parseInt(duration, 10) || 1);
        const derivType = CONTRACT_TYPE_MAP[contractType] || contractType;
        const needsBarrier = DIGIT_TYPES.includes(contractType);

        setError('');
        setIsBuying(true);
        run_panel?.setIsRunning?.(true);
        run_panel?.setContractStage?.(contract_stages.PURCHASE_SENT);
        run_panel?.toggleDrawer?.(true);
        run_panel?.setActiveTabIndex?.(run_panel_tabs.TRANSACTIONS);

        const proposal: any = {
            proposal: 1,
            amount: parsedStake,
            basis: 'stake',
            contract_type: derivType,
            currency: client?.currency || 'USD',
            underlying_symbol: symbol,
            duration: parsedDuration,
            duration_unit: 't',
        };
        if (needsBarrier) {
            proposal.barrier = parseInt(barrier, 10);
        }

        wsRef.current.send(JSON.stringify(proposal));
    }, [isBuying, isAuthorized, stake, duration, contractType, barrier, symbol, client, connect, run_panel]);

    const needsBarrier = DIGIT_TYPES.includes(contractType);

    return (
        <div style={s.page}>
            <div style={s.header}>
                <h2 style={s.title}>⚡ DTrader — Manual Execution</h2>
                <div style={s.subtitle}>Place trades directly through Captain Peter's Deriv connection</div>
                <div style={s.statusBar}>
                    <div style={s.dot(isConnected && isAuthorized)} />
                    <span style={s.statusText(isConnected && isAuthorized)}>
                        {!isConnected ? 'Connecting...' : !isAuthorized ? 'Authorizing...' : 'Ready'}
                    </span>
                </div>
            </div>

            {error && <div style={s.errorBox}>⚠ {error}</div>}

            <div style={s.grid}>
                <div style={s.fieldGroup}>
                    <label style={s.label}>Market</label>
                    <select style={s.select} value={symbol} onChange={e => setSymbol(e.target.value)}>
                        {SYMBOLS.map(sym => (
                            <option key={sym.value} value={sym.value}>{sym.label}</option>
                        ))}
                    </select>
                </div>

                <div style={s.fieldGroup}>
                    <label style={s.label}>Contract Type</label>
                    <select style={s.select} value={contractType} onChange={e => setContractType(e.target.value)}>
                        {CONTRACT_TYPES.map(ct => (
                            <option key={ct.value} value={ct.value}>{ct.label}</option>
                        ))}
                    </select>
                </div>

                <div style={s.fieldGroup}>
                    <label style={s.label}>Stake (USD)</label>
                    <input
                        style={s.input}
                        type='number'
                        min='0.35'
                        step='0.1'
                        value={stake}
                        onChange={e => setStake(e.target.value)}
                    />
                </div>

                <div style={s.fieldGroup}>
                    <label style={s.label}>Duration (ticks)</label>
                    <input
                        style={s.input}
                        type='number'
                        min='1'
                        max='10'
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                    />
                </div>

                {needsBarrier && (
                    <div style={s.fieldGroup}>
                        <label style={s.label}>Digit Barrier</label>
                        <input
                            style={s.input}
                            type='number'
                            min='0'
                            max='9'
                            value={barrier}
                            onChange={e => setBarrier(e.target.value)}
                        />
                    </div>
                )}
            </div>

            <button style={s.buyBtn(isBuying)} onClick={handleBuy} disabled={isBuying}>
                {isBuying ? '⏳ EXECUTING...' : '▶ BUY NOW'}
            </button>

            <div style={s.tradesHeader}>Trade History ({trades.length})</div>
            {trades.length === 0 ? (
                <div style={s.emptyTrades}>No trades yet. Place your first trade above.</div>
            ) : (
                trades.map(t => (
                    <div key={t.id} style={s.tradeRow(t.status)}>
                        <div style={s.tradeBar(t.status)} />
                        <div style={s.tradeContent}>
                            <span style={s.tradeType}>{t.contractType}</span>
                            <span style={s.tradeSymbol}>{t.symbol}</span>
                            <span style={s.tradeStake}>${t.stake}</span>
                            <span style={s.tradeProfit(t.profit)}>
                                {t.profit === null ? 'PENDING' : `${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}`}
                            </span>
                            <span style={s.tradeTime}>{t.time}</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
});

export default Dtrader;

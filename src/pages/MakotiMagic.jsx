import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';

const MakotiMagic = observer(() => {
    // Inputs
    const [token, setToken] = useState('');
    const [stake, setStake] = useState(0.35);
    const [currency, setCurrency] = useState('USD');
    const [offset, setOffset] = useState(0); // The "Gate" tuner
    
    // Engine State
    const [is_hunting, setIsHunting] = useState(false);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);
    const [status, setStatus] = useState('OFFLINE');
    
    const workerRef = useRef(null);

    useEffect(() => {
        const workerBlob = new Blob([`
            let ws;
            let active = false;
            let currentParams = {};

            self.onmessage = function(e) {
                const { type, payload } = e.data;
                
                if (type === 'UPDATE_PARAMS') {
                    currentParams = payload;
                }

                if (type === 'START') {
                    active = true;
                    currentParams = payload;
                    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
                    
                    ws.onopen = () => ws.send(JSON.stringify({ authorize: payload.token }));
                    
                    ws.onmessage = (msg) => {
                        const res = JSON.parse(msg.data);
                        
                        if (res.error) {
                            self.postMessage({ type: 'ERROR', data: res.error.message });
                            return;
                        }

                        if (res.msg_type === 'authorize') {
                            self.postMessage({ type: 'STATUS', data: 'CONNECTED' });
                            ws.send(JSON.stringify({ ticks: '1HZ100V', subscribe: 1 }));
                        }

                        if (active && res.msg_type === 'tick') {
                            const digit = res.tick.quote.toString().slice(-1);
                            
                            // SURGICAL INJECTION WITH OFFSET
                            setTimeout(() => {
                                if(!active) return;
                                ws.send(JSON.stringify({
                                    buy: 1, 
                                    price: currentParams.stake,
                                    parameters: {
                                        amount: currentParams.stake,
                                        basis: 'stake',
                                        contract_type: 'DIGITMATCH',
                                        currency: currentParams.currency,
                                        duration: 1,
                                        duration_unit: 't',
                                        symbol: '1HZ100V',
                                        barrier: parseInt(digit)
                                    },
                                    subscribe: 1
                                }));
                            }, currentParams.offset);
                        }

                        if (res.msg_type === 'proposal_open_contract') {
                            const contract = res.proposal_open_contract;
                            if (contract.is_sold) {
                                self.postMessage({ type: 'RESULT', data: {
                                    id: contract.contract_id,
                                    target: contract.barrier,
                                    exit: contract.exit_tick_display_value.slice(-1),
                                    profit: contract.profit,
                                    status: contract.status.toUpperCase()
                                }});
                            }
                        }
                    };
                }

                if (type === 'STOP') {
                    active = false;
                    if(ws) ws.close();
                }
            };
        `], { type: 'application/javascript' });

        workerRef.current = new Worker(URL.createObjectURL(workerBlob));

        workerRef.current.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'STATUS') setStatus(data);
            if (type === 'ERROR') {
                alert("SERVER ERROR: " + data);
                setIsHunting(false);
            }
            if (type === 'RESULT') {
                setResults(prev => {
                    if (prev.find(r => r.id === data.id)) return prev;
                    return [data, ...prev].slice(0, 10);
                });
                setTotalPL(v => v + data.profit);
            }
        };

        return () => workerRef.current.terminate();
    }, []);

    // Sync parameters to worker when they change
    useEffect(() => {
        if (workerRef.current) {
            workerRef.current.postMessage({ 
                type: 'UPDATE_PARAMS', 
                payload: { token: token.trim(), stake: Number(stake), currency, offset: Number(offset) } 
            });
        }
    }, [token, stake, currency, offset]);

    const handleToggle = () => {
        if (!is_hunting) {
            if (!token) return alert("Please enter API Token");
            setStatus('CONNECTING...');
            workerRef.current.postMessage({ 
                type: 'START', 
                payload: { token: token.trim(), stake: Number(stake), currency, offset: Number(offset) } 
            });
        } else {
            workerRef.current.postMessage({ type: 'STOP' });
            setStatus('OFFLINE');
        }
        setIsHunting(!is_hunting);
    };

    return (
        <div style={ui.container}>
            <div style={ui.card}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <h2 style={ui.logo}>MAKOTI <span style={{color:'#0f0'}}>V8</span></h2>
                    <div style={{color: status === 'CONNECTED' ? '#0f0' : '#f00', fontSize:'12px'}}>{status}</div>
                </div>

                <div style={ui.inputGroup}>
                    <label style={ui.label}>API TOKEN</label>
                    <input type="password" value={token} onChange={e => setToken(e.target.value)} style={ui.inputFull} placeholder="Paste Token..." />
                </div>

                <div style={ui.row}>
                    <div style={{flex:1}}>
                        <label style={ui.label}>STAKE</label>
                        <input type="number" value={stake} onChange={e => setStake(e.target.value)} style={ui.inputFull} />
                    </div>
                    <div style={{flex:1}}>
                        <label style={ui.label}>CURRENCY</label>
                        <select value={currency} onChange={e => setCurrency(e.target.value)} style={ui.select}>
                            <option value="USD">USD</option>
                            <option value="VRTC">VRTC</option>
                        </select>
                    </div>
                </div>

                <div style={ui.inputGroup}>
                    <label style={ui.label}>GATE OFFSET: {offset}ms</label>
                    <input type="range" min="0" max="100" value={offset} onChange={e => setOffset(e.target.value)} style={ui.range} />
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#444'}}>
                        <span>FASTEST</span>
                        <span>DELAYED</span>
                    </div>
                </div>

                <button onClick={handleToggle} style={is_hunting ? ui.btnStop : ui.btnStart}>
                    {is_hunting ? 'STOP SCANNER' : 'ACTIVATE SURGICAL STRIKE'}
                </button>

                <div style={ui.stats}>
                    <div style={ui.label}>SESSION P/L</div>
                    <div style={{fontSize:'28px', color: total_pl >= 0 ? '#0f0' : '#f44'}}>
                        ${total_pl.toFixed(2)}
                    </div>
                </div>
            </div>

            <div style={ui.tableWrapper}>
                <table style={ui.table}>
                    <thead>
                        <tr style={{color:'#666', fontSize:'10px'}}>
                            <th>TARGET</th>
                            <th>EXIT</th>
                            <th>RESULT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map(r => (
                            <tr key={r.id} style={ui.tr}>
                                <td style={{color:'#0f0'}}>{r.target}</td>
                                <td style={{color: r.target === r.exit ? '#0f0' : '#f44'}}>{r.exit}</td>
                                <td style={{color: r.profit > 0 ? '#0f0' : '#f44', fontWeight:'bold'}}>{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

const ui = {
    container: { background: '#000', color: '#fff', minHeight: '100vh', padding: '15px', fontFamily: 'monospace' },
    card: { background: '#0a0a0a', border: '1px solid #222', padding: '20px', borderRadius: '8px' },
    logo: { margin: 0, fontSize: '18px', letterSpacing: '2px' },
    inputGroup: { marginTop: '15px' },
    label: { fontSize: '10px', color: '#555', display: 'block', marginBottom: '5px' },
    inputFull: { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px', boxSizing: 'border-box' },
    row: { display: 'flex', gap: '10px', marginTop: '15px' },
    select: { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px' },
    range: { width: '100%', cursor: 'pointer', accentColor: '#0f0' },
    btnStart: { width: '100%', marginTop: '20px', padding: '15px', background: '#0f0', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' },
    btnStop: { width: '100%', marginTop: '20px', padding: '15px', background: '#300', color: '#f44', fontWeight: 'bold', border: 'none', cursor: 'pointer' },
    stats: { marginTop: '20px', textAlign: 'center', borderTop: '1px solid #222', paddingTop: '15px' },
    tableWrapper: { marginTop: '20px' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'center' },
    tr: { borderBottom: '1px solid #111', height: '35px', fontSize: '14px' }
};

export default MakotiMagic;

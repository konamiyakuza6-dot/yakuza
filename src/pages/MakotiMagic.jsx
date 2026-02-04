import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';

const MakotiMagic = observer(() => {
    const { client } = useStore();
    const [is_hunting, setIsHunting] = useState(false);
    const [stake, setStake] = useState(0.35);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);
    const [status, setStatus] = useState('OFFLINE');
    
    const workerRef = useRef(null);

    useEffect(() => {
        // --- THE ENGINE (WEB WORKER) ---
        const workerBlob = new Blob([`
            let ws;
            let active = false;

            self.onmessage = function(e) {
                const { type, payload } = e.data;
                
                if (type === 'START') {
                    active = true;
                    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
                    
                    ws.onopen = () => ws.send(JSON.stringify({ authorize: payload.token }));
                    
                    ws.onmessage = (msg) => {
                        const res = JSON.parse(msg.data);
                        
                        // Handle Errors (Insufficient balance, invalid token, etc)
                        if (res.error) {
                            self.postMessage({ type: 'ERROR', data: res.error.message });
                            return;
                        }

                        if (res.msg_type === 'authorize') {
                            self.postMessage({ type: 'STATUS', data: 'CONNECTED' });
                            ws.send(JSON.stringify({ ticks: '1HZ100V' }));
                        }

                        if (active && res.msg_type === 'tick') {
                            const digit = res.tick.quote.toString().slice(-1);
                            
                            // THE STRIKE
                            ws.send(JSON.stringify({
                                buy: 1, 
                                price: payload.stake,
                                parameters: {
                                    amount: payload.stake,
                                    basis: 'stake',
                                    contract_type: 'DIGITMATCH',
                                    currency: payload.currency || 'USD',
                                    duration: 1,
                                    duration_unit: 't',
                                    symbol: '1HZ100V',
                                    barrier: parseInt(digit)
                                }
                            }));
                        }

                        if (res.msg_type === 'proposal_open_contract' && res.proposal_open_contract.is_sold) {
                            self.postMessage({ type: 'RESULT', data: res.proposal_open_contract });
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

        // UI Updates from Worker
        workerRef.current.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'STATUS') setStatus(data);
            if (type === 'ERROR') {
                alert("STRIKE ERROR: " + data);
                setIsHunting(false);
            }
            if (type === 'RESULT') {
                setResults(prev => [{
                    id: data.contract_id,
                    target: data.barrier,
                    entry: data.entry_tick_display_value.slice(-1),
                    status: data.status.toUpperCase(),
                    profit: data.profit
                }, ...prev].slice(0, 8));
                setTotalPL(v => v + data.profit);
            }
        };

        return () => workerRef.current.terminate();
    }, []);

    const handleToggle = () => {
        if (!is_hunting) {
            setStatus('CONNECTING...');
            // We pass the token, stake, and currency (USD or VRTC)
            workerRef.current.postMessage({ 
                type: 'START', 
                payload: { 
                    token: client.token, 
                    stake: Number(stake),
                    currency: client.currency // Automatically gets USD or VRTC
                } 
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
                <div style={ui.statusBadge}>{status}</div>
                <h1 style={ui.title}>MAKOTI V8 LONDON</h1>
                
                <div style={ui.inputBox}>
                    <label style={ui.label}>STAKE AMOUNT</label>
                    <input 
                        type="number" 
                        value={stake} 
                        onChange={(e) => setStake(e.target.value)} 
                        style={ui.input} 
                    />
                </div>

                <button onClick={handleToggle} style={{ ...ui.btn, background: is_hunting ? '#330000' : '#003300', color: is_hunting ? '#ff4444' : '#44ff44' }}>
                    {is_hunting ? 'STOP SCANNER' : 'ACTIVATE SURGICAL STRIKE'}
                </button>

                <div style={ui.profitArea}>
                    <div style={ui.label}>TOTAL PROFIT</div>
                    <div style={{ ...ui.money, color: total_pl >= 0 ? '#00ff00' : '#ff0000' }}>
                        ${total_pl.toFixed(2)}
                    </div>
                </div>
            </div>

            <div style={ui.tableArea}>
                {results.map((res) => (
                    <div key={res.id} style={ui.row}>
                        <span>TARGET: <b>{res.target}</b></span>
                        <span>ENTRY: <b style={{ color: res.target === res.entry ? '#0f0' : '#f00' }}>{res.entry}</b></span>
                        <span style={{ fontWeight: 'bold' }}>{res.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

// STYLES (Clean, Dark Mode)
const ui = {
    container: { background: '#000', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' },
    card: { border: '1px solid #222', padding: '30px', borderRadius: '10px', textAlign: 'center', background: '#050505' },
    statusBadge: { fontSize: '10px', color: '#888', marginBottom: '10px' },
    title: { fontSize: '18px', letterSpacing: '2px', marginBottom: '30px', color: '#00ff00' },
    inputBox: { marginBottom: '25px' },
    label: { fontSize: '12px', color: '#666' },
    input: { background: 'transparent', border: 'none', borderBottom: '2px solid #00ff00', color: '#fff', fontSize: '24px', width: '80px', textAlign: 'center', outline: 'none' },
    btn: { width: '100%', padding: '20px', border: '1px solid currentColor', cursor: 'pointer', fontWeight: 'bold' },
    profitArea: { marginTop: '30px' },
    money: { fontSize: '32px', fontWeight: 'bold' },
    tableArea: { marginTop: '20px' },
    row: { display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #111', fontSize: '14px' }
};

export default MakotiMagic;

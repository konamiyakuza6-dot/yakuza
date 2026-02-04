import React, { useState, useRef, useEffect } from 'react';

const MakotiMagic = () => {
    // Trading States
    const [token, setToken] = useState('');
    const [stake, setStake] = useState(0.35);
    const [offset, setOffset] = useState(15);
    const [currency, setCurrency] = useState('USD');
    
    // UI States
    const [is_hunting, setIsHunting] = useState(false);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);
    const [status, setStatus] = useState('OFFLINE');
    
    const workerRef = useRef(null);

    useEffect(() => {
        const workerBlob = new Blob([`
            let ws;
            let active = false;
            let isWaiting = false;
            let initialStake = 0.35;
            let currentStake = 0.35;

            self.onmessage = function(e) {
                const { type, payload } = e.data;
                
                if (type === 'START') {
                    active = true;
                    initialStake = payload.stake;
                    currentStake = payload.stake;
                    
                    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
                    ws.onopen = () => ws.send(JSON.stringify({ authorize: payload.token }));
                    
                    ws.onmessage = (msg) => {
                        const res = JSON.parse(msg.data);
                        
                        if (res.msg_type === 'authorize') {
                            self.postMessage({ type: 'STATUS', data: 'CONNECTED' });
                            ws.send(JSON.stringify({ ticks: '1HZ100V', subscribe: 1 }));
                        }

                        // INJECTION ENGINE
                        if (active && res.msg_type === 'tick' && !isWaiting) {
                            const digit = res.tick.quote.toString().slice(-1);
                            isWaiting = true; 

                            setTimeout(() => {
                                if(!active) return;
                                ws.send(JSON.stringify({
                                    buy: 1, 
                                    price: currentStake,
                                    parameters: {
                                        amount: currentStake,
                                        basis: 'stake',
                                        contract_type: 'DIGITMATCH',
                                        currency: payload.currency,
                                        duration: 1,
                                        duration_unit: 't',
                                        symbol: '1HZ100V',
                                        barrier: parseInt(digit)
                                    }
                                }));
                            }, payload.offset);

                            // Auto-release lock after 1.5 seconds if server is slow
                            // This ensures the bot keeps trading
                            setTimeout(() => { isWaiting = false; }, 1500);
                        }

                        if (res.msg_type === 'buy') {
                            // Trade placed successfully
                        }

                        if (res.msg_type === 'proposal_open_contract' && res.proposal_open_contract.is_sold) {
                            const contract = res.proposal_open_contract;
                            if (contract.status === 'lost') {
                                currentStake = (currentStake * 1.12).toFixed(2);
                            } else {
                                currentStake = initialStake;
                            }
                            isWaiting = false; // Fresh release
                            self.postMessage({ type: 'RESULT', data: contract });
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
            if (type === 'RESULT') {
                setResults(prev => [{
                    id: data.contract_id,
                    target: data.barrier,
                    exit: data.exit_tick_display_value.slice(-1),
                    profit: data.profit,
                    status: data.status.toUpperCase()
                }, ...prev].slice(0, 5));
                setTotalPL(v => v + data.profit);
            }
        };
        return () => workerRef.current.terminate();
    }, []);

    const handleToggle = () => {
        if (!is_hunting) {
            if (!token) return alert("Enter Token");
            setIsHunting(true);
            workerRef.current.postMessage({ 
                type: 'START', 
                payload: { token: token.trim(), stake: Number(stake), currency, offset: Number(offset) } 
            });
        } else {
            setIsHunting(false);
            workerRef.current.postMessage({ type: 'STOP' });
            setStatus('OFFLINE');
        }
    };

    return (
        <div style={ui.page}>
            <div style={ui.container}>
                <h1 style={ui.title}>MAKOTI <span style={{color:'#0f0'}}>LONDON V11</span></h1>
                
                <div style={ui.statusRow}>
                    <span style={{color: status === 'CONNECTED' ? '#0f0' : '#f44'}}>{status}</span>
                    <span style={ui.pl}>NET: ${total_pl.toFixed(2)}</span>
                </div>

                <div style={ui.form}>
                    <div style={ui.inputGroup}>
                        <label style={ui.label}>API TOKEN</label>
                        <input type="password" value={token} onChange={e => setToken(e.target.value)} style={ui.inputLarge} />
                    </div>

                    <div style={ui.row}>
                        <div style={{flex:1}}>
                            <label style={ui.label}>STAKE</label>
                            <input type="number" value={stake} onChange={e => setStake(e.target.value)} style={ui.inputLarge} />
                        </div>
                        <div style={{flex:1}}>
                            <label style={ui.label}>OFFSET (ms)</label>
                            <input type="number" value={offset} onChange={e => setOffset(e.target.value)} style={ui.inputLarge} />
                        </div>
                    </div>

                    <button onClick={handleToggle} style={is_hunting ? ui.btnStop : ui.btnStart}>
                        {is_hunting ? 'STOP ENGINE' : 'START SURGICAL STRIKE'}
                    </button>
                </div>

                <div style={ui.tableArea}>
                    {results.map((r, i) => (
                        <div key={i} style={ui.resultCard}>
                            <div style={{fontSize:'20px'}}>TGT: <b>{r.target}</b> | EXIT: <b style={{color: r.target === r.exit ? '#0f0' : '#f44'}}>{r.exit}</b></div>
                            <div style={{color: r.profit >= 0 ? '#0f0' : '#f44', fontWeight:'bold'}}>{r.status} (${r.profit.toFixed(2)})</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ui = {
    page: { background: '#000', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', color: '#fff' },
    container: { width: '90%', maxWidth: '450px', background: '#0a0a0a', padding: '30px', borderRadius: '15px', border: '1px solid #222', textAlign: 'center' },
    title: { fontSize: '28px', marginBottom: '10px', letterSpacing: '2px' },
    statusRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '0 10px' },
    pl: { fontSize: '20px', fontWeight: 'bold' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    inputGroup: { textAlign: 'left' },
    label: { fontSize: '12px', color: '#555', marginBottom: '8px', display: 'block' },
    inputLarge: { width: '100%', padding: '15px', background: '#111', border: '1px solid #333', color: '#0f0', fontSize: '18px', boxSizing: 'border-box', borderRadius: '8px' },
    row: { display: 'flex', gap: '15px' },
    btnStart: { padding: '20px', background: '#0f0', color: '#000', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' },
    btnStop: { padding: '20px', background: '#300', color: '#f44', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' },
    tableArea: { marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '10px' },
    resultCard: { background: '#111', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
};

export default MakotiMagic;

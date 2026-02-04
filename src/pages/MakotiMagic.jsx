import React, { useState, useRef, useEffect } from 'react';

const MakotiMagic = () => {
    const [token, setToken] = useState('');
    const [stake, setStake] = useState(0.35);
    const [is_hunting, setIsHunting] = useState(false);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);
    const [status, setStatus] = useState('OFFLINE');
    const [liveDigit, setLiveDigit] = useState('-');
    
    const workerRef = useRef(null);

    useEffect(() => {
        const workerBlob = new Blob([`
            let ws;
            let active = false;
            let isWaiting = false;

            self.onmessage = function(e) {
                const { type, payload } = e.data;
                
                if (type === 'START') {
                    active = true;
                    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
                    
                    ws.onopen = () => ws.send(JSON.stringify({ authorize: payload.token }));
                    
                    ws.onmessage = (msg) => {
                        const res = JSON.parse(msg.data);
                        
                        if (res.msg_type === 'authorize') {
                            self.postMessage({ type: 'STATUS', data: 'CONNECTED' });
                            ws.send(JSON.stringify({ ticks: '1HZ100V', subscribe: 1 }));
                        }

                        // THE SINGLE PRECISION STRIKE
                        if (active && res.msg_type === 'tick' && !isWaiting) {
                            const quoteStr = res.tick.quote.toString();
                            const d = quoteStr[quoteStr.length - 1]; 
                            
                            self.postMessage({ type: 'TICK', data: d });
                            isWaiting = true; 

                            // PRE-FLIGHT RAW STRING (Bypasses JSON overhead)
                            const singleStrike = '{"buy":1,"price":'+payload.stake+',"parameters":{"amount":'+payload.stake+',"basis":"stake","contract_type":"DIGITMATCH","currency":"USD","duration":1,"duration_unit":"t","symbol":"1HZ100V","barrier":'+d+'},"subscribe":1}';

                            // ONE SHOT ONLY
                            ws.send(singleStrike);
                        }

                        if (res.msg_type === 'proposal_open_contract' && res.proposal_open_contract.is_sold) {
                            isWaiting = false; 
                            self.postMessage({ type: 'RESULT', data: res.proposal_open_contract });
                        }
                    };
                }

                if (type === 'STOP') {
                    active = false;
                    if(ws) ws.close();
                    self.postMessage({ type: 'STATUS', data: 'OFFLINE' });
                }
            };
        `], { type: 'application/javascript' });

        workerRef.current = new Worker(URL.createObjectURL(workerBlob));
        
        workerRef.current.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'STATUS') setStatus(data);
            if (type === 'TICK') setLiveDigit(data);
            if (type === 'RESULT') {
                setResults(prev => [{
                    id: data.contract_id,
                    target: data.barrier,
                    exit: data.exit_tick_display_value?.slice(-1) || '?',
                    profit: data.profit
                }, ...prev].slice(0, 10));
                setTotalPL(v => v + data.profit);
            }
        };

        return () => workerRef.current.terminate();
    }, []);

    const handleToggle = () => {
        if (!is_hunting) {
            setIsHunting(true);
            setResults([]);
            workerRef.current.postMessage({ 
                type: 'START', 
                payload: { token: token.trim(), stake: Number(stake) } 
            });
        } else {
            setIsHunting(false);
            workerRef.current.postMessage({ type: 'STOP' });
        }
    };

    return (
        <div style={ui.page}>
            <div style={ui.card}>
                <h2 style={ui.title}>SINGLE STRIKE <span style={{color:'#0f0'}}>V23</span></h2>
                
                <div style={ui.monitor}>
                    <div style={{fontSize:'72px', color:'#0f0', fontWeight:'900'}}>{liveDigit}</div>
                    <div style={{fontSize:'10px', color:'#333'}}>ULTRASONIC STREAM</div>
                </div>

                <div style={ui.statsRow}>
                    <div style={{color: status === 'CONNECTED' ? '#0f0' : '#f44', fontWeight:'bold'}}>{status}</div>
                    <div style={{fontSize: '32px', color: total_pl >= 0 ? '#0f0' : '#f44'}}>${total_pl.toFixed(2)}</div>
                </div>

                <div style={ui.form}>
                    <input type="password" value={token} onChange={e => setToken(e.target.value)} style={ui.input} placeholder="API TOKEN" />
                    <input type="number" value={stake} onChange={e => setStake(e.target.value)} style={ui.input} placeholder="STAKE ($)" />
                    <button onClick={handleToggle} style={is_hunting ? ui.btnStop : ui.btnStart}>
                        {is_hunting ? 'ABORT' : 'ACTIVATE SNIPER'}
                    </button>
                </div>

                <div style={ui.table}>
                    {results.map((r) => (
                        <div key={r.id} style={ui.tr}>
                            <span>TGT: <b>{r.target}</b></span>
                            <span style={{color: r.target === r.exit ? '#0f0' : '#f44'}}>EXIT: <b>{r.exit}</b></span>
                            <span style={{fontWeight:'bold'}}>{r.profit > 0 ? 'WIN' : 'MISS'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ui = {
    page: { background: '#000', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace' },
    card: { width: '400px', background: '#0a0a0a', padding: '30px', borderRadius: '15px', border: '1px solid #222', textAlign: 'center' },
    title: { fontSize: '20px', color: '#fff', marginBottom: '15px' },
    monitor: { background: '#000', padding: '15px', borderRadius: '10px', border: '1px solid #1a1a1a', marginBottom: '25px' },
    statsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    form: { display: 'flex', flexDirection: 'column', gap: '10px' },
    input: { width: '100%', padding: '15px', background: '#000', border: '1px solid #222', color: '#0f0', fontSize: '18px', boxSizing: 'border-box' },
    btnStart: { padding: '18px', background: '#0f0', color: '#000', border: 'none', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' },
    btnStop: { padding: '18px', background: '#400', color: '#f44', border: 'none', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' },
    table: { marginTop: '20px' },
    tr: { display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#111', marginBottom: '5px', borderRadius: '5px', color: '#fff' }
};

export default MakotiMagic;

import React, { useState } from 'react';
import './transaction-journal.css';

const TransactionJournal = ({ results = [], wins = 0, losses = 0, totalRuns = 0, totalProfit = 0, onClear }) => {
    const [open, setOpen] = useState(true);

    const winRate = totalRuns > 0 ? Math.round((wins / totalRuns) * 100) : 0;

    return (
        <div className='tj2-root'>
            <div className='tj2-wrap'>
                <div className='tj2-topbar' />

                <div className='tj2-head' onClick={() => setOpen(o => !o)}>
                    <span className='tj2-head__title'>
                        <span className='tj2-head__icon'>▶</span>
                        Transaction Journal
                        {results.length > 0 && (
                            <span className='tj2-head__badge'>{results.length}</span>
                        )}
                    </span>
                    <div className='tj2-head__right'>
                        {results.length > 0 && onClear && (
                            <button
                                className='tj2-clr'
                                onClick={e => { e.stopPropagation(); onClear(); }}
                                title='Clear journal'
                            >
                                🗑
                            </button>
                        )}
                        <span className='tj2-chevron'>{open ? '▲' : '▼'}</span>
                    </div>
                </div>

                {open && (
                    <>
                        <div className='tj2-stats'>
                            <div className='tj2-stat'>
                                <span className='tj2-stat__lbl'>Trades</span>
                                <span className='tj2-stat__val'>{totalRuns}</span>
                            </div>
                            <div className='tj2-stat'>
                                <span className='tj2-stat__lbl'>Wins</span>
                                <span className='tj2-stat__val tj2-stat__val--win'>{wins}</span>
                            </div>
                            <div className='tj2-stat'>
                                <span className='tj2-stat__lbl'>Losses</span>
                                <span className='tj2-stat__val tj2-stat__val--loss'>{losses}</span>
                            </div>
                            <div className='tj2-stat'>
                                <span className='tj2-stat__lbl'>Win Rate</span>
                                <span className='tj2-stat__val'>{totalRuns > 0 ? `${winRate}%` : '—'}</span>
                            </div>
                            <div className='tj2-stat tj2-stat--wide'>
                                <span className='tj2-stat__lbl'>Total P/L</span>
                                <span className={`tj2-stat__val ${totalProfit >= 0 ? 'tj2-stat__val--win' : 'tj2-stat__val--loss'}`}>
                                    {totalProfit >= 0 ? '+' : ''}{Number(totalProfit).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className='tj2-body'>
                            {results.length === 0 ? (
                                <div className='tj2-empty'>
                                    <span className='tj2-empty__icon'>⚡</span>
                                    <span>Waiting for trades…</span>
                                </div>
                            ) : (
                                <div className='tj2-logs'>
                                    {results.map((r, idx) => {
                                        const isWin     = String(r.status || '').toUpperCase() === 'WIN'  || r.result === 'won'  || (r.profit !== null && r.profit !== undefined && parseFloat(r.profit) > 0);
                                        const isLoss    = String(r.status || '').toUpperCase() === 'LOSS' || r.result === 'lost' || (r.profit !== null && r.profit !== undefined && parseFloat(r.profit) < 0);
                                        const isPending = !isWin && !isLoss;

                                        const rowClass = isWin ? ' tj2-log--win' : isLoss ? ' tj2-log--loss' : ' tj2-log--pending';

                                        const contractLabel = String(r.contract_type || r.type || '—')
                                            .replace('DIGIT', '')
                                            .replace('CALL', 'RISE')
                                            .replace('PUT', 'FALL');

                                        const profitDisplay = r.profit !== null && r.profit !== undefined && r.profit !== '-' && r.profit !== 0
                                            ? `${parseFloat(r.profit) >= 0 ? '+' : ''}${parseFloat(r.profit).toFixed(2)}`
                                            : isPending ? '…' : '0.00';

                                        const entryDisplay  = r.entry_spot  || r.entry_tick  || r.entry  || '—';
                                        const exitDisplay   = r.exit_spot   || r.exit_tick   || r.exit   || (isPending ? '…' : '—');
                                        const stakeDisplay  = r.stake ? `${parseFloat(r.stake).toFixed(2)}` : '—';
                                        const marketDisplay = r.market || r.symbol || r.underlying_symbol || '';
                                        const timeDisplay   = r.timestamp || '';

                                        return (
                                            <div key={r.contract_id || idx} className={`tj2-log${rowClass}`}>
                                                <span className='tj2-log__bar' />
                                                <div className='tj2-log__body'>
                                                    <div className='tj2-log__top'>
                                                        <span className='tj2-log__type'>{contractLabel}</span>
                                                        {marketDisplay && <span className='tj2-log__market'>{marketDisplay}</span>}
                                                        {timeDisplay   && <span className='tj2-log__time'>{timeDisplay}</span>}
                                                    </div>
                                                    <div className='tj2-log__bottom'>
                                                        <span className='tj2-log__entry'>
                                                            <span className='tj2-log__lbl'>In </span>{entryDisplay}
                                                        </span>
                                                        <span className='tj2-log__arrow'>→</span>
                                                        <span className='tj2-log__exit'>
                                                            <span className='tj2-log__lbl'>Out </span>{exitDisplay}
                                                        </span>
                                                        <span className='tj2-log__stake'>
                                                            <span className='tj2-log__lbl'>Stake </span>{stakeDisplay}
                                                        </span>
                                                        <span className={`tj2-log__pl ${isWin ? 'tj2-log__pl--win' : isLoss ? 'tj2-log__pl--loss' : ''}`}>
                                                            {profitDisplay}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TransactionJournal;

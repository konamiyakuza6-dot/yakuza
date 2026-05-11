import React, { useEffect, useRef, useState } from 'react';
import { Scanner } from './scanner';
import { MarketKiller } from './market-killer';
import './makoti-widget.scss';

type Tab = 'scanner' | 'market_killer';
const PAD = 8;

export const MakotiWidget: React.FC = () => {
    const [open, setOpen]         = useState(false);
    const [tab, setTab]           = useState<Tab>('scanner');
    const [minimized, setMinimized] = useState(false);

    /* ── FAB position ─────────────────────────────────────── */
    const [btnPos, setBtnPos] = useState(() => ({
        x: Math.max(PAD, window.innerWidth  - 88),
        y: Math.max(PAD, window.innerHeight - 108),
    }));

    /* ── Window position ──────────────────────────────────── */
    const [winPos, setWinPos] = useState(() => ({
        x: Math.max(PAD, window.innerWidth  - 420),
        y: Math.max(PAD, window.innerHeight - 640),
    }));

    /* ── Drag state (refs, never cause re-renders) ─────────── */
    const btnDragging  = useRef(false);
    const winDragging  = useRef(false);
    const btnMoved     = useRef(false);      // true if pointer actually moved
    const winMoved     = useRef(false);
    const startClient  = useRef({ x: 0, y: 0 });
    const startElem    = useRef({ x: 0, y: 0 });

    const btnRef = useRef<HTMLButtonElement>(null);
    const winRef = useRef<HTMLDivElement>(null);

    /* ── Shared global pointer handlers (attached once) ──── */
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (btnDragging.current) {
                const dx = e.clientX - startClient.current.x;
                const dy = e.clientY - startClient.current.y;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) btnMoved.current = true;
                const nx = Math.max(PAD, Math.min(window.innerWidth  - 72 - PAD, startElem.current.x + dx));
                const ny = Math.max(PAD, Math.min(window.innerHeight - 72 - PAD, startElem.current.y + dy));
                setBtnPos({ x: nx, y: ny });
            }
            if (winDragging.current) {
                const dx = e.clientX - startClient.current.x;
                const dy = e.clientY - startClient.current.y;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) winMoved.current = true;
                const nx = Math.max(PAD, Math.min(window.innerWidth  - 404 - PAD, startElem.current.x + dx));
                const ny = Math.max(PAD, Math.min(window.innerHeight - 60,        startElem.current.y + dy));
                setWinPos({ x: nx, y: ny });
            }
        };
        const onUp = () => {
            btnDragging.current = false;
            winDragging.current = false;
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup',   onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup',   onUp);
        };
    }, []);

    /* ── FAB pointer down ─────────────────────────────────── */
    const onBtnPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        btnDragging.current = true;
        btnMoved.current    = false;
        startClient.current = { x: e.clientX, y: e.clientY };
        startElem.current   = { ...btnPos };
        btnRef.current?.setPointerCapture(e.pointerId);
    };

    /* ── FAB click — only toggle if not a drag ────────────── */
    const onBtnClick = () => {
        if (btnMoved.current) { btnMoved.current = false; return; }
        setOpen(o => !o);
    };

    /* ── Window header pointer down ───────────────────────── */
    const onWinPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Only drag from the header strip — never intercept tabs, body, or any interactive element
        const target = e.target as HTMLElement;
        if (
            target.closest('.mw-win-body')    ||
            target.closest('.mw-win-actions') ||
            target.closest('.mw-tabs')        ||
            (target as HTMLElement).tagName === 'BUTTON' ||
            (target as HTMLElement).tagName === 'INPUT'  ||
            (target as HTMLElement).tagName === 'SELECT'
        ) return;
        e.preventDefault();
        winDragging.current = true;
        winMoved.current    = false;
        startClient.current = { x: e.clientX, y: e.clientY };
        startElem.current   = { ...winPos };
        winRef.current?.setPointerCapture(e.pointerId);
    };

    return (
        <>
            {/* ── Floating button ── */}
            <button
                ref={btnRef}
                className={`mw-fab${open ? ' mw-fab--open' : ''}`}
                style={{ left: btnPos.x, top: btnPos.y }}
                onPointerDown={onBtnPointerDown}
                onClick={onBtnClick}
                title='MAKOTI — Scanner & Market Killer'
            >
                <span className='mw-fab__pulse' />
                <span className='mw-fab__icon'>⚔</span>
                <span className='mw-fab__label'>MAKOTI</span>
            </button>

            {/* ── Floating window ── */}
            {open && (
                <div
                    ref={winRef}
                    className={`mw-window${minimized ? ' mw-window--min' : ''}`}
                    style={{ left: winPos.x, top: winPos.y }}
                    onPointerDown={onWinPointerDown}
                >
                    <div className='mw-win-header'>
                        <div className='mw-win-title'>
                            <span className='mw-win-logo'>⚔</span>
                            <span>MAKOTI</span>
                        </div>
                        <div className='mw-win-actions'>
                            <button
                                className='mw-win-action'
                                onClick={() => setMinimized(m => !m)}
                                title={minimized ? 'Expand' : 'Minimize'}
                            >
                                {minimized ? '▲' : '▼'}
                            </button>
                            <button
                                className='mw-win-action mw-win-action--close'
                                onClick={() => setOpen(false)}
                                title='Close'
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {!minimized && (
                        <>
                            <div className='mw-tabs'>
                                <button
                                    className={`mw-tab${tab === 'scanner' ? ' mw-tab--active' : ''}`}
                                    onClick={() => setTab('scanner')}
                                >
                                    Scanner
                                </button>
                                <button
                                    className={`mw-tab${tab === 'market_killer' ? ' mw-tab--active' : ''}`}
                                    onClick={() => setTab('market_killer')}
                                >
                                    Market Killer
                                </button>
                            </div>

                            <div className='mw-win-body'>
                                {tab === 'scanner' ? <Scanner /> : <MarketKiller />}
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default MakotiWidget;

type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    TRADING_BOTS: 3,
    OVER_UNDER: 4,
    MAKOTI_MAGIC: 5,
    ANALYSIS_TOOL: 6,
    STRATEGIES: 7,
    COPY_TRADING: 8,
    DTRADER: 9,
    TRADINGVIEW: 10,
    OVERLORD: 11,
    ELITE_PRIME_AI: 12,
    SIGNAL_ZONE: 13,
    SMART_TRADER: 14,
    SPEEDBOT: 15,
    // Keep TUTORIAL as a non-active sentinel to avoid index mismatches in legacy checks
    TUTORIAL: 999,
    // Legacy tabs - kept for backward compatibility
    HYBRID_BOTS: 3,
    FREE_BOTS: 3,
    MATCHES: 3,
    HYPERBOT: 3,
    DIFFBOT: 3,
    DCIRCLES: 6,
    DP_TOOLS: 6,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-trading-bots',
    'id-analysis-tool',
    'id-strategies',
    'id-copy-trading',
    'id-dtrader',
    'id-tradingview',
    'id-overlord',
    'id-elite-prime-ai',
    'id-signal-zone',
    'id-smart-trader',
    'id-speedbot',
];

export const DEBOUNCE_INTERVAL_TIME = 500;

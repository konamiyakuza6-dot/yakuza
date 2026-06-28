let _symbolMap: Record<string, string> = {};

export const updateSymbolDisplayNames = (active_symbols: { symbol: string; display_name: string }[]) => {
    _symbolMap = {};
    active_symbols.forEach(s => {
        _symbolMap[s.symbol.toUpperCase()] = s.display_name;
    });
};

export const getSymbolDisplayNameSync = (symbol: string): string => {
    if (!symbol) return '';
    return _symbolMap[symbol.toUpperCase()] || symbol;
};

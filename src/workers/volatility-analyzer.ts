
self.onmessage = (event) => {
    const { tick_data, contract_type, barrier } = event.data;

    let bestVolatility = null;
    let minInstability = Infinity;

    const barrier_num = parseInt(barrier, 10);
    let target_digits = [];

    // "when am trading over contract with barrier of digit 2, it should look for volatility which its digit below 2 are not increasing in terms of percentages"
    // "when i select under contract with barrier 7, it should look for volatility with the digits above 7 that are not increasing"
    if (contract_type === 'DIGITOVER') {
        for (let i = 0; i < barrier_num; i++) {
            target_digits.push(i);
        }
    } else { // DIGITUNDER
        for (let i = barrier_num + 1; i < 10; i++) {
            target_digits.push(i);
        }
    }

    if (target_digits.length === 0) {
        const symbols = Object.keys(tick_data);
        self.postMessage(symbols[Math.floor(Math.random() * symbols.length)]);
        return;
    }

    for (const symbol in tick_data) {
        if (Object.prototype.hasOwnProperty.call(tick_data, symbol)) {
            const ticks = tick_data[symbol];
            if (ticks.length < 50) continue;

            // Loading recent 50 ticks for each volatility
            const recent_ticks = ticks.slice(-50);
            const first_half = recent_ticks.slice(0, 25);
            const second_half = recent_ticks.slice(25, 50);

            const countInFirstHalf = first_half.filter(t => target_digits.includes(t)).length;
            const countInSecondHalf = second_half.filter(t => target_digits.includes(t)).length;

            const percentInFirstHalf = (countInFirstHalf / 25) * 100;
            const percentInSecondHalf = (countInSecondHalf / 25) * 100;

            // instability_score represents how much the "bad" digits (digits to avoid) are increasing
            // We want to minimize this (i.e., ensure they are NOT increasing)
            const instability_score = percentInSecondHalf - percentInFirstHalf;

            if (instability_score < minInstability) {
                minInstability = instability_score;
                bestVolatility = symbol;
            }
        }
    }
    self.postMessage(bestVolatility);
};

export {};

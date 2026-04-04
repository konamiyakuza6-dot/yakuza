
// ═══════════════════════════════════════════════════════════
//  Makoti AI - Advanced Over/Under Analysis Engine v2.5
//  (Multi-Strategy Hybrid Engine with Duration Analysis)
// ═══════════════════════════════════════════════════════════

// ── Type Definitions ────────────────────────────────────────
export interface AnalysisResult {
    bestEntry: GoldenEntry | null;
    goldenEntries: GoldenEntry[];
}

export interface GoldenEntry {
    contractType: 'DIGITOVER' | 'DIGITUNDER';
    barrier: string;
    duration: number;
    winRate: number;
    analysis: string;
    triggerDigits: number[];
    confidence: number;
    triggerType: 'single';
}

// ── Main Analysis Functions ──────────────────────────────────

const simulateTriggerTrade = (
    history: number[],
    contractType: 'DIGITOVER' | 'DIGITUNDER',
    barrier: number,
    triggerDigit: number,
    duration: number
): { winRate: number, wins: number, trades: number } => {
    let wins = 0;
    let trades = 0;
    for (let i = 1; i < history.length - duration; i++) {
        if (history[i - 1] === triggerDigit) {
            trades++;
            const outcome_tick = history[i + duration - 1];
            if (contractType === 'DIGITOVER' && outcome_tick > barrier) {
                wins++;
            } else if (contractType === 'DIGITUNDER' && outcome_tick < barrier) {
                wins++;
            }
        }
    }
    return { winRate: trades > 3 ? wins / trades : 0, wins, trades };
};

const calculateMovingAverage = (history: number[], period: number): number => {
    const period_history = history.slice(-period);
    if (period_history.length < period) return 0;
    return period_history.reduce((a, b) => a + b, 0) / period;
};

const calculateDigitDistribution = (history: number[], period: number): number[] => {
    const period_history = history.slice(-period);
    const counts = Array(10).fill(0);
    period_history.forEach(digit => { counts[digit]++; });
    return counts.map(count => (count / period_history.length) * 100);
};


export const analyzeDigits = (history: number[], symbol: string): AnalysisResult => {
    const analysis_period = 200;
    if (history.length < analysis_period) {
        return { bestEntry: null, goldenEntries: [{ contractType: 'DIGITOVER', barrier: '4', triggerDigits: [], duration: 5, winRate: 0, confidence: 0, analysis: `Fallback: Not enough data (need ${analysis_period} ticks).`, triggerType: 'single' }] };
    }

    const recent_history = history.slice(-analysis_period);
    let allPotentialEntries: GoldenEntry[] = [];

    // 1. STRATEGY: Micro-Pattern Simulation (Core Trigger + Duration Analysis)
    const potential_contracts: { type: 'DIGITOVER' | 'DIGITUNDER', barrier: number }[] = [];
    for (let barrier = 0; barrier <= 8; barrier++) potential_contracts.push({ type: 'DIGITOVER', barrier });
    for (let barrier = 1; barrier <= 9; barrier++) potential_contracts.push({ type: 'DIGITUNDER', barrier });

    for (const contract of potential_contracts) {
        for (let triggerDigit = 0; triggerDigit <= 9; triggerDigit++) {
            let best_duration_for_pattern = { duration: 0, winRate: 0, wins: 0, trades: 0 };

            // NEW: Loop through durations to find the optimal one for this pattern
            for (let duration = 1; duration <= 5; duration++) {
                const simulation = simulateTriggerTrade(recent_history, contract.type, contract.barrier, triggerDigit, duration);
                if (simulation.winRate > best_duration_for_pattern.winRate) {
                    best_duration_for_pattern = { duration, ...simulation };
                }
            }

            if (best_duration_for_pattern.winRate > 0.75) { // Pre-filter for high-probability patterns
                allPotentialEntries.push({
                    contractType: contract.type,
                    barrier: String(contract.barrier),
                    duration: best_duration_for_pattern.duration,
                    winRate: best_duration_for_pattern.winRate,
                    analysis: `${contract.type.replace('DIGIT','')} ${contract.barrier} on trigger ${triggerDigit} for ${best_duration_for_pattern.duration}t (${(best_duration_for_pattern.winRate * 100).toFixed(0)}%)`,
                    triggerDigits: [triggerDigit],
                    confidence: best_duration_for_pattern.winRate, // Start with winRate as base confidence
                    triggerType: 'single',
                });
            }
        }
    }

    if (allPotentialEntries.length === 0) {
        return { bestEntry: null, goldenEntries: [{ contractType: 'DIGITOVER', barrier: '4', triggerDigits: [], duration: 5, winRate: 0, confidence: 0, analysis: 'No high-win-rate trigger patterns found.', triggerType: 'single' }] };
    }

    // 2. Run supplementary analysis strategies to score confidence
    const long_term_history = history.slice(-1000);
    const ma_short = calculateMovingAverage(recent_history, 20);
    const ma_long = calculateMovingAverage(recent_history, 100);
    const distribution = calculateDigitDistribution(long_term_history, 1000);
    const volatility = Math.sqrt(recent_history.map(x => Math.pow(x - ma_short, 2)).reduce((a, b) => a + b) / recent_history.length);

    // Score each potential entry based on other strategies
    for (const entry of allPotentialEntries) {
        let confidence_score = entry.winRate; // Base score
        let reasons = [ `Win Rate: ${(entry.winRate * 100).toFixed(0)}%` ];

        // STRATEGY: Trend & Momentum Analysis
        const is_up_trend = ma_short > ma_long;
        if (entry.contractType === 'DIGITOVER' && is_up_trend) {
            confidence_score *= 1.1; // 10% boost for aligning with trend
            reasons.push('Strong uptrend');
        } else if (entry.contractType === 'DIGITUNDER' && !is_up_trend) {
            confidence_score *= 1.1; // 10% boost for aligning with trend
            reasons.push('Strong downtrend');
        }

        // STRATEGY: Digit Frequency & Distribution (from dollawise-strategies.tsx)
        const barrier = parseInt(entry.barrier, 10);
        if (entry.contractType === 'DIGITUNDER' && barrier >= 6) {
            const hot_digits = distribution.slice(barrier).reduce((a, b) => a + b, 0);
            if (hot_digits < 30) { // e.g., for Under 7, digits 7,8,9 make up < 30% of ticks
                confidence_score *= 1.15; // 15% boost
                reasons.push('Favorable cold digits');
            }
        }
        if (entry.contractType === 'DIGITOVER' && barrier <= 3) {
            const cold_digits = distribution.slice(0, barrier + 1).reduce((a, b) => a + b, 0);
            if (cold_digits < 30) { // e.g., for Over 2, digits 0,1,2 make up < 30% of ticks
                confidence_score *= 1.15; // 15% boost
                reasons.push('Favorable cold digits');
            }
        }

        // STRATEGY: Volatility Analysis
        if (volatility < 2.5) { // Low volatility is good for prediction
            confidence_score *= 1.05; // 5% boost
            reasons.push('Low volatility');
        }

        entry.confidence = Math.min(confidence_score, 1.0); // Cap confidence at 1.0
        entry.analysis = `${entry.analysis} | Confidence: ${(entry.confidence * 100).toFixed(0)}% (${reasons.join(', ')})`;
    }

    // 3. Sort by the final confidence score
    allPotentialEntries.sort((a, b) => b.confidence - a.confidence);

    const bestEntry = allPotentialEntries.length > 0 ? allPotentialEntries[0] : null;
    const goldenEntries = allPotentialEntries.slice(0, 5);

    return { bestEntry, goldenEntries };
};
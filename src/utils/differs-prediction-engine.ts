
export interface PredictionResult {
    top4Digits: number[];
    rankedDigits: Array<{ digit: number; score: number }>;
    overallConfidence: number;
    summary: string;
}

interface StrategyResult {
    scores: number[];
    confidence: number;
    name: string;
    tier: 1 | 2 | 3;
}

const TIER_WEIGHT: Record<1 | 2 | 3, number> = { 1: 4.0, 2: 1.8, 3: 1.0 };

function normaliseScores(scores: number[]): number[] {
    const total = scores.reduce((a, b) => a + b, 0);
    if (total === 0) return Array(10).fill(0.1);
    return scores.map(s => s / total);
}

// ── 1. N-Gram Sequence Prediction ─────────────────────────────────────────
function nGramStrategy(history: number[], n: number): StrategyResult {
    const name = `nGram-${n}`;
    const scores = Array(10).fill(0) as number[];
    if (history.length < n + 1) return { scores: normaliseScores(scores), confidence: 0, name, tier: 1 };

    const table = new Map<string, number[]>();
    for (let i = 0; i <= history.length - n - 1; i++) {
        const key = history.slice(i, i + n).join(',');
        if (!table.has(key)) table.set(key, Array(10).fill(0));
        table.get(key)![history[i + n]]++;
    }
    const key = history.slice(-n).join(',');
    const counts = table.get(key);
    if (!counts) return { scores: normaliseScores(scores), confidence: 0, name, tier: 1 };

    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return { scores: normaliseScores(scores), confidence: 0, name, tier: 1 };

    counts.forEach((c, i) => { scores[i] = c / total; });
    return { scores, confidence: Math.max(...scores), name, tier: 1 };
}

// ── 2. Markov Chain ────────────────────────────────────────────────────────
function markovChainStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    if (history.length < 2) return { scores: normaliseScores(scores), confidence: 0, name: 'markov', tier: 1 };

    const matrix: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let i = 0; i < history.length - 1; i++) {
        const from = history[i], to = history[i + 1];
        if (from >= 0 && from <= 9 && to >= 0 && to <= 9) matrix[from][to]++;
    }
    const last = history[history.length - 1];
    if (last < 0 || last > 9) return { scores: normaliseScores(scores), confidence: 0, name: 'markov', tier: 1 };

    const row = matrix[last];
    const total = row.reduce((a, b) => a + b, 0);
    if (total === 0) return { scores: normaliseScores(scores), confidence: 0, name: 'markov', tier: 1 };

    row.forEach((c, i) => { scores[i] = c / total; });
    return { scores, confidence: Math.max(...scores), name: 'markov', tier: 1 };
}

// ── 3. Cyclical Pattern Detection ─────────────────────────────────────────
function cyclicalPatternStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    const minLen = 6;
    if (history.length < minLen) return { scores: normaliseScores(scores), confidence: 0, name: 'cyclical', tier: 2 };

    let bestCycleLen = 0, bestScore = 0;

    for (let cycleLen = 2; cycleLen <= 8; cycleLen++) {
        if (history.length < cycleLen * 2) continue;
        let matches = 0;
        const checks = Math.min(history.length - cycleLen, cycleLen * 3);
        for (let i = 0; i < checks; i++) {
            if (history[history.length - 1 - i] === history[history.length - 1 - i - cycleLen]) matches++;
        }
        const score = matches / checks;
        if (score > bestScore) { bestScore = score; bestCycleLen = cycleLen; }
    }

    if (bestScore > 0.6 && bestCycleLen > 0) {
        const predictedIdx = history.length % bestCycleLen;
        const window = history.slice(-bestCycleLen * 4);
        const cycleVotes = Array(10).fill(0) as number[];
        for (let j = predictedIdx; j < window.length; j += bestCycleLen) {
            const d = window[j];
            if (d >= 0 && d <= 9) cycleVotes[d]++;
        }
        const total = cycleVotes.reduce((a, b) => a + b, 0);
        if (total > 0) cycleVotes.forEach((c, i) => { scores[i] = (c / total) * bestScore; });
    }

    return { scores: normaliseScores(scores), confidence: bestScore, name: 'cyclical', tier: 2 };
}

// ── 4. KNN Pattern Match ───────────────────────────────────────────────────
function knnPatternStrategy(history: number[], k = 5, winLen = 4): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    if (history.length < winLen + 1) return { scores: normaliseScores(scores), confidence: 0, name: 'knn', tier: 1 };

    const current = history.slice(-winLen);
    const candidates: Array<{ dist: number; next: number }> = [];

    for (let i = 0; i <= history.length - winLen - 1; i++) {
        let dist = 0;
        for (let j = 0; j < winLen; j++) dist += Math.abs(history[i + j] - current[j]);
        candidates.push({ dist, next: history[i + winLen] });
    }
    candidates.sort((a, b) => a.dist - b.dist);

    const kNearest = candidates.slice(0, k);
    if (kNearest.length === 0) return { scores: normaliseScores(scores), confidence: 0, name: 'knn', tier: 1 };

    const maxDist = kNearest[kNearest.length - 1].dist || 1;
    kNearest.forEach(({ dist, next }) => {
        if (next >= 0 && next <= 9) scores[next] += (maxDist - dist + 1);
    });

    return { scores: normaliseScores(scores), confidence: Math.max(...scores), name: 'knn', tier: 1 };
}

// ── 5. Adaptive Momentum ───────────────────────────────────────────────────
function adaptiveMomentumStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    const windows = [3, 5, 8];
    if (history.length < Math.max(...windows)) return { scores: normaliseScores(scores), confidence: 0, name: 'adaptiveMomentum', tier: 1 };

    windows.forEach((w, wi) => {
        const slice = history.slice(-w);
        const freq = Array(10).fill(0) as number[];
        slice.forEach(d => { if (d >= 0 && d <= 9) freq[d]++; });
        const total = slice.length;
        const weight = wi === 0 ? 3 : wi === 1 ? 2 : 1;
        freq.forEach((c, i) => { scores[i] += (c / total) * weight; });
    });

    return { scores: normaliseScores(scores), confidence: Math.max(...normaliseScores(scores)), name: 'adaptiveMomentum', tier: 1 };
}

// ── 6. Digit Acceleration ──────────────────────────────────────────────────
function digitAccelerationStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    const window = history.slice(-20);
    if (window.length < 10) return { scores: normaliseScores(scores), confidence: 0, name: 'acceleration', tier: 2 };

    const countInWindow = (start: number, end: number, digit: number) =>
        window.slice(start, end).filter(d => d === digit).length;

    const half = Math.floor(window.length / 2);
    for (let d = 0; d <= 9; d++) {
        if (half === 0 || (window.length - half) === 0) continue;
        const oldVelocity = countInWindow(0, half, d) / half;
        const newVelocity = countInWindow(half, window.length, d) / (window.length - half);
        const acceleration = newVelocity - oldVelocity;
        scores[d] = Math.max(0, acceleration);
    }

    return { scores: normaliseScores(scores), confidence: Math.max(...normaliseScores(scores)), name: 'acceleration', tier: 2 };
}


// ── 7. Hot-Cold Digit Tracker ──────────────────────────────────────────────
function hotColdDigitStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    const windowSize = Math.min(10, history.length);
    if (windowSize === 0) return { scores: normaliseScores(scores), confidence: 0, name: 'hotCold', tier: 2 };

    const recent = history.slice(-windowSize);
    const freq = Array(10).fill(0) as number[];
    recent.forEach(d => { if (d >= 0 && d <= 9) freq[d]++; });

    freq.forEach((c, i) => {
        if (c >= 3) scores[i] = c * 3;
        else if (c >= 2) scores[i] = c * 1.5;
        else scores[i] = c;
    });

    return { scores: normaliseScores(scores), confidence: Math.max(...normaliseScores(scores)), name: 'hotCold', tier: 2 };
}

// ── 8. Bayesian Probability ────────────────────────────────────────────────
function bayesianProbabilityStrategy(history: number[]): StrategyResult {
    const priors = Array(10).fill(0.1) as number[];
    if (history.length === 0) return { scores: normaliseScores(priors), confidence: 0.1, name: 'bayesian', tier: 2 };

    const posteriors = [...priors];
    const decayFactor = 0.85;
    let weight = 1;

    for (let i = history.length - 1; i >= 0; i--) {
        const d = history[i];
        if (d >= 0 && d <= 9) posteriors[d] += weight;
        weight *= decayFactor;
    }

    return { scores: normaliseScores(posteriors), confidence: Math.max(...normaliseScores(posteriors)), name: 'bayesian', tier: 2 };
}

// ── 9. Entropy Analysis ────────────────────────────────────────────────────
function entropyStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    const windowSize = Math.min(50, history.length);
    if (windowSize === 0) return { scores: normaliseScores(scores), confidence: 0, name: 'entropy', tier: 3 };

    const slice = history.slice(-windowSize);
    const freq = Array(10).fill(0) as number[];
    slice.forEach(d => { if (d >= 0 && d <= 9) freq[d]++; });

    let entropy = 0;
    freq.forEach(c => {
        if (c > 0) { const p = c / windowSize; entropy -= p * Math.log2(p); }
    });

    const maxEntropy = Math.log2(10);
    const normEntropy = entropy / maxEntropy;

    if (normEntropy < 0.5) {
        freq.forEach((c, i) => { scores[i] = c; });
    } else {
        const sorted = [...freq].sort((a, b) => a - b);
        const median = sorted[5];
        freq.forEach((c, i) => { scores[i] = Math.abs(c - median) < 2 ? 1 : 0.5; });
    }

    return { scores: normaliseScores(scores), confidence: 1 - normEntropy, name: 'entropy', tier: 3 };
}

// ── 10. Digit Repetition & Frequency ──────────────────────────────────────
function digitRepetitionStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(0) as number[];
    if (history.length === 0) return { scores: normaliseScores(scores), confidence: 0, name: 'digitRepeat', tier: 2 };

    const recentLen = Math.min(50, history.length);
    const recent = history.slice(-recentLen);

    recent.forEach((d, idx) => {
        if (d >= 0 && d <= 9) {
            const recency = (idx + 1) / recentLen;
            scores[d] += recency * recency;
        }
    });

    return { scores: normaliseScores(scores), confidence: Math.max(...normaliseScores(scores)), name: 'digitRepeat', tier: 2 };
}

// ── 11. RSI Adapted ───────────────────────────────────────────────────────
function rsiStrategy(history: number[], period = 14): StrategyResult {
    const scores = Array(10).fill(1) as number[];
    if (history.length < period + 1) return { scores: normaliseScores(scores), confidence: 0, name: 'rsi', tier: 3 };

    let gains = 0, losses = 0;
    for (let i = history.length - period; i < history.length; i++) {
        const diff = history[i] - history[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }

    if (losses === 0) {
        for (let i = 6; i <= 9; i++) scores[i] += 2;
        return { scores: normaliseScores(scores), confidence: 0.5, name: 'rsi', tier: 3 };
    }

    const rs = gains / losses;
    const rsi = 100 - (100 / (1 + rs));

    if (rsi > 70) {
        for (let i = 0; i <= 4; i++) scores[i] += 2;
    } else if (rsi < 30) {
        for (let i = 5; i <= 9; i++) scores[i] += 2;
    } else {
        for (let i = 4; i <= 6; i++) scores[i] += 1.5;
    }

    return { scores: normaliseScores(scores), confidence: Math.abs(rsi - 50) / 50, name: 'rsi', tier: 3 };
}

// ── 12. MACD Adapted ──────────────────────────────────────────────────────
function ema(data: number[], period: number): number[] {
    if (data.length < period) return [];
    const k = 2 / (period + 1);
    const result: number[] = [data.slice(0, period).reduce((a, b) => a + b, 0) / period];
    for (let i = period; i < data.length; i++) result.push(data[i] * k + result[result.length - 1] * (1 - k));
    return result;
}

function macdStrategy(history: number[]): StrategyResult {
    const scores = Array(10).fill(1) as number[];
    if (history.length < 20) return { scores: normaliseScores(scores), confidence: 0, name: 'macd', tier: 3 };

    const fast = ema(history, 5), slow = ema(history, 10);
    const offset = fast.length - slow.length;
    if (slow.length === 0) return { scores: normaliseScores(scores), confidence: 0, name: 'macd', tier: 3 };
    const macdLine = slow.map((s, i) => fast[offset + i] - s);
    const signal = ema(macdLine, 5);
    if (signal.length < 2) return { scores: normaliseScores(scores), confidence: 0, name: 'macd', tier: 3 };

    const mc = macdLine[macdLine.length - 1], sc = signal[signal.length - 1];
    const histogram = mc - sc;

    if (histogram > 0) {
        for (let i = 5; i <= 9; i++) scores[i] += 2;
    } else {
        for (let i = 0; i <= 4; i++) scores[i] += 2;
    }

    return { scores: normaliseScores(scores), confidence: Math.min(Math.abs(histogram) / 2, 1), name: 'macd', tier: 3 };
}

// ── 13. Bollinger Bands Adapted ────────────────────────────────────────────
function bollingerBandsStrategy(history: number[], period = 20): StrategyResult {
    const scores = Array(10).fill(1) as number[];
    if (history.length < period) return { scores: normaliseScores(scores), confidence: 0, name: 'bollinger', tier: 3 };

    const slice = history.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);

    const last = history[history.length - 1];
    const upper = mean + 2 * stdDev, lower = mean - 2 * stdDev;

    if (stdDev < 1.5) {
        for (let i = 4; i <= 6; i++) scores[i] += 2;
    } else if (last > upper) {
        for (let i = 0; i <= 4; i++) scores[i] += 2;
    } else if (last < lower) {
        for (let i = 5; i <= 9; i++) scores[i] += 2;
    }

    const volatilityConfidence = Math.min(stdDev / 3, 1);
    return { scores: normaliseScores(scores), confidence: volatilityConfidence, name: 'bollinger', tier: 3 };
}

// ── MAIN ENGINE ────────────────────────────────────────────────────────────
export function predictNextDigits(history: number[]): PredictionResult {
    if (history.length < 5) {
        return {
            top4Digits: [],
            rankedDigits: [],
            overallConfidence: 0,
            summary: 'Insufficient history for prediction',
        };
    }

    const strategies: StrategyResult[] = [
        nGramStrategy(history, 1),
        nGramStrategy(history, 2),
        nGramStrategy(history, 3),
        markovChainStrategy(history),
        cyclicalPatternStrategy(history),
        knnPatternStrategy(history, 5, 2),
        knnPatternStrategy(history, 5, 4),
        adaptiveMomentumStrategy(history),
        digitAccelerationStrategy(history),
        hotColdDigitStrategy(history),
        bayesianProbabilityStrategy(history),
        entropyStrategy(history),
        digitRepetitionStrategy(history),
        rsiStrategy(history, 9),
        macdStrategy(history),
        bollingerBandsStrategy(history, 10),
    ];

    const combined = Array(10).fill(0) as number[];
    let totalWeight = 0;
    let tier1Consensus = Array(10).fill(0) as number[];
    let tier1Count = 0;

    strategies.forEach(s => {
        const baseWeight = TIER_WEIGHT[s.tier];
        const confidenceWeight = 0.5 + s.confidence * 0.5;
        const weight = baseWeight * confidenceWeight;

        s.scores.forEach((score, digit) => { combined[digit] += score * weight; });
        totalWeight += weight;

        if (s.tier === 1 && s.confidence > 0.15) {
            s.scores.forEach((score, digit) => { tier1Consensus[digit] += score; });
            tier1Count++;
        }
    });

    if (totalWeight > 0) combined.forEach((_, i) => { combined[i] /= totalWeight; });

    if (tier1Count > 0) {
        const t1max = Math.max(...tier1Consensus);
        if (t1max > 0) {
            tier1Consensus = tier1Consensus.map(s => s / t1max);
            combined.forEach((_, i) => { combined[i] += tier1Consensus[i] * 0.3; });
        }
    }

    const final = normaliseScores(combined);

    const rankedDigits = final
        .map((score, digit) => ({ digit, score }))
        .sort((a, b) => b.score - a.score);

    const top4Digits = rankedDigits.slice(0, 4).map(d => d.digit);

    const topScore = rankedDigits[0].score;
    const secondScore = rankedDigits[1].score;
    const dominance = topScore - secondScore;
    const tier1AgreementCount = strategies.filter(s => s.tier === 1 && s.scores[rankedDigits[0].digit] === Math.max(...s.scores)).length;
    const overallConfidence = Math.min((dominance * 10 + tier1AgreementCount / strategies.filter(s => s.tier === 1).length) / 2, 1);

    const top4Str = rankedDigits.slice(0, 4).map(d => `${d.digit}(${(d.score * 100).toFixed(0)}%)`).join(' ');
    const summary = `Predict top4: [${top4Str}] conf:${(overallConfidence * 100).toFixed(0)}%`;

    return { top4Digits, rankedDigits, overallConfidence, summary };
}

export interface GoldenEntry {
    contractType: string;
    triggerDigits: number[];
    barrier: string;
    duration: number;
    winRate: number;
    confidence: number;
    analysis: string;
    triggerType: 'single' | 'consecutive' | 'pattern';
}

export interface AnalysisResult {
    symbol: string;
    goldenEntries: GoldenEntry[];
    analysisTime: number;
    tickCount: number;
    summary: string;
    detailedAnalysis: {
        sequential: any[];
        coldDigit: any[];
        markov: any[];
        streakCluster: any[];
        movingAvg: any[];
        dispersion: any[];
        quantLevel: any[];
    };
}

function chiSquareTest(digitCounts: number[]): { chiSquare: number; pValue: number; isUniform: boolean } {
    const n = digitCounts.length;
    const total = digitCounts.reduce((a, b) => a + b, 0);
    const expected = total / n;
    
    let chiSq = 0;
    digitCounts.forEach(c => {
        chiSq += ((c - expected) ** 2) / expected;
    });
    
    const df = n - 1;
    const pValue = Math.max(0, 1 - chiSq / (df * 2));
    const isUniform = pValue > 0.05;
    
    return { chiSquare: chiSq, pValue, isUniform };
}

function analyzeSequentialTriggers(history: number[]): any[] {
    const results: any[] = [];
    const payout = 1.5;
    
    for (let d = 0; d <= 9; d++) {
        const indices: number[] = [];
        for (let i = 0; i < history.length; i++) {
            if (history[i] === d) indices.push(i);
        }
        
        if (indices.length < 5) continue;
        
        for (const idx of indices) {
            if (idx + 2 >= history.length) continue;
            
            const next1 = history[idx + 1];
            const next2 = history[idx + 2];
            
            const next1Over3 = next1 > 3 ? 1 : 0;
            const next1Over4 = next1 > 4 ? 1 : 0;
            const next1Under5 = next1 < 5 ? 1 : 0;
            const next1Under6 = next1 < 6 ? 1 : 0;
            
            const next2Over3 = next2 > 3 ? 1 : 0;
            const next2Over4 = next2 > 4 ? 1 : 0;
            const next2Under5 = next2 < 5 ? 1 : 0;
            const next2Under6 = next2 < 6 ? 1 : 0;
            
            results.push({
                triggerDigit: d,
                next1Over3, next1Over4, next1Under5, next1Under6,
                next2Over3, next2Over4, next2Under5, next2Under6
            });
        }
    }
    
    const aggregated: any[] = [];
    for (let d = 0; d <= 9; d++) {
        const matches = results.filter(r => r.triggerDigit === d);
        if (matches.length < 10) continue;
        
        const total = matches.length;
        
        const over3_1tick = matches.reduce((sum, r) => sum + r.next1Over3, 0) / total;
        const over4_1tick = matches.reduce((sum, r) => sum + r.next1Over4, 0) / total;
        const under5_1tick = matches.reduce((sum, r) => sum + r.next1Under5, 0) / total;
        const under6_1tick = matches.reduce((sum, r) => sum + r.next1Under6, 0) / total;
        
        const over3_2tick = matches.reduce((sum, r) => sum + r.next2Over3, 0) / total;
        const over4_2tick = matches.reduce((sum, r) => sum + r.next2Over4, 0) / total;
        const under5_2tick = matches.reduce((sum, r) => sum + r.next2Under5, 0) / total;
        const under6_2tick = matches.reduce((sum, r) => sum + r.next2Under6, 0) / total;
        
        aggregated.push({
            digit: d,
            sampleSize: total,
            next1Tick: { over3: over3_1tick, over4: over4_1tick, under5: under5_1tick, under6: under6_1tick },
            next2Tick: { over3: over3_2tick, over4: over4_2tick, under5: under5_2tick, under6: under6_2tick }
        });
    }
    
    return aggregated;
}

function analyzeColdDigitReversion(history: number[]): any[] {
    const results: any[] = [];
    const window = Math.min(500, history.length);
    const slice = history.slice(-window);
    
    const digitCounts = Array(10).fill(0);
    slice.forEach(d => digitCounts[d]++);
    
    const total = slice.length;
    const expected = total / 10;
    
    const coldest = digitCounts.map((count, digit) => ({ digit, count, deviation: count - expected }))
        .sort((a, b) => a.deviation - b.deviation);
    
    for (let i = 0; i < Math.min(3, coldest.length); i++) {
        const cold = coldest[i];
        if (cold.deviation >= 0) continue;
        
        const indices: number[] = [];
        for (let j = 0; j < slice.length; j++) {
            if (slice[j] === cold.digit) indices.push(j);
        }
        
        if (indices.length < 3) continue;
        
        let highAfter = 0;
        let lowAfter = 0;
        let evenAfter = 0;
        let oddAfter = 0;
        
        for (const idx of indices) {
            if (idx + 1 < slice.length) {
                const next = slice[idx + 1];
                if (next >= 5) highAfter++;
                if (next <= 4) lowAfter++;
                if (next % 2 === 0) evenAfter++;
                else oddAfter++;
            }
        }
        
        const totalAfter = indices.length;
        
        results.push({
            coldDigit: cold.digit,
            appearanceCount: cold.count,
            deviationPercent: (cold.deviation / expected) * 100,
            afterHigh: highAfter / totalAfter,
            afterLow: lowAfter / totalAfter,
            afterEven: evenAfter / totalAfter,
            afterOdd: oddAfter / totalAfter,
            winningPattern: highAfter > lowAfter ? 'High' : (lowAfter > highAfter ? 'Low' : 'Neutral')
        });
    }
    
    return results;
}

function analyzeMarkovChains(history: number[]): any[] {
    const results: any[] = [];
    const window = Math.min(1000, history.length);
    const slice = history.slice(-window);
    
    const matrix: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let i = 1; i < slice.length; i++) {
        const from = slice[i - 1];
        const to = slice[i];
        if (from >= 0 && from <= 9 && to >= 0 && to <= 9) {
            matrix[from][to]++;
        }
    }
    
    for (let from = 0; from < 10; from++) {
        const row = matrix[from];
        const total = row.reduce((a, b) => a + b, 0);
        
        if (total < 10) continue;
        
        for (let to = 0; to < 10; to++) {
            const count = row[to];
            const prob = count / total;
            
            if (count >= 5) {
                results.push({
                    fromDigit: from,
                    toDigit: to,
                    probability: prob,
                    count,
                    total,
                    isDiffers: from !== to,
                    isMatch: from === to
                });
            }
        }
    }
    
    return results.sort((a, b) => b.probability - a.probability);
}

function analyzeStreakCluster(history: number[]): any[] {
    const results: any[] = [];
    
    for (let n = 2; n <= 4; n++) {
        if (history.length < n + 20) continue;
        
        const ngramCounts: Record<string, Record<number, number>> = {};
        
        for (let i = 0; i <= history.length - n - 1; i++) {
            const seq = history.slice(i, i + n).join(',');
            const next = history[i + n];
            
            if (!ngramCounts[seq]) ngramCounts[seq] = {};
            ngramCounts[seq][next] = (ngramCounts[seq][next] || 0) + 1;
        }
        
        const lastN = history.slice(-n).join(',');
        const counts = ngramCounts[lastN];
        
        if (counts) {
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            Object.entries(counts).forEach(([next, count]) => {
                const digit = parseInt(next, 10);
                results.push({
                    sequence: lastN,
                    n,
                    nextDigit: digit,
                    count,
                    frequency: count / total,
                    isHigh: digit >= 5,
                    isLow: digit <= 4,
                    isEven: digit % 2 === 0,
                    isOdd: digit % 2 === 1
                });
            });
        }
    }
    
    return results.sort((a, b) => b.frequency - a.frequency).slice(0, 20);
}

function analyzeDigitMovingAverages(history: number[]): any[] {
    const results: any[] = [];
    const windows = [5, 10, 20, 50, 100];
    
    for (const w of windows) {
        if (history.length < w) continue;
        
        const slice = history.slice(-w);
        const sum = slice.reduce((a, b) => a + b, 0);
        const avg = sum / w;
        
        const firstHalf = slice.slice(0, Math.floor(slice.length / 2));
        const secondHalf = slice.slice(Math.floor(slice.length / 2));
        
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        const trend = secondAvg - firstAvg;
        
        results.push({
            window: w,
            average: avg,
            firstHalfAvg: firstAvg,
            secondHalfAvg: secondAvg,
            trend,
            trendDirection: trend > 0.5 ? 'Rising' : (trend < -0.5 ? 'Falling' : 'Stable'),
            bias: avg > 6 ? 'High' : (avg < 4 ? 'Low' : 'Neutral')
        });
    }
    
    return results;
}

function analyzeDispersionVolatility(history: number[]): any[] {
    const results: any[] = [];
    
    const windows = [50, 100, 200, 500];
    
    for (const w of windows) {
        if (history.length < w) continue;
        
        const slice = history.slice(-w);
        
        const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
        const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
        const stdDev = Math.sqrt(variance);
        
        const digitCounts = Array(10).fill(0);
        slice.forEach(d => digitCounts[d]++);
        
        const { chiSquare, pValue, isUniform } = chiSquareTest(digitCounts);
        
        let alternations = 0;
        for (let i = 1; i < slice.length; i++) {
            if (slice[i] !== slice[i - 1]) alternations++;
        }
        const altRate = alternations / (slice.length - 1);
        
        const range = Math.max(...slice) - Math.min(...slice);
        
        results.push({
            window: w,
            mean,
            stdDev,
            chiSquare,
            pValue,
            isUniform,
            alternationRate: altRate,
            range,
            volatility: stdDev > 2.5 ? 'High' : (stdDev < 1.5 ? 'Low' : 'Medium'),
            dispersion: isUniform ? 'Uniform' : 'Biased'
        });
    }
    
    return results;
}

function analyzeQuantLevel(history: number[]): any[] {
    const results: any[] = [];
    const window = Math.min(500, history.length);
    const slice = history.slice(-window);
    
    const digitCounts = Array(10).fill(0);
    slice.forEach(d => digitCounts[d]++);
    
    const matrix: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let i = 1; i < slice.length; i++) {
        const from = slice[i - 1];
        const to = slice[i];
        if (from >= 0 && from <= 9 && to >= 0 && to <= 9) {
            matrix[from][to]++;
        }
    }
    
    const { chiSquare, pValue, isUniform } = chiSquareTest(digitCounts);
    
    let lag1HighHigh = 0;
    let lag1LowLow = 0;
    let lag1HighLow = 0;
    let lag1LowHigh = 0;
    
    for (let i = 1; i < slice.length; i++) {
        const prev = slice[i - 1];
        const curr = slice[i];
        const prevHigh = prev >= 5;
        const currHigh = curr >= 5;
        
        if (prevHigh && currHigh) lag1HighHigh++;
        else if (!prevHigh && !currHigh) lag1LowLow++;
        else if (prevHigh && !currHigh) lag1HighLow++;
        else lag1LowHigh++;
    }
    
    const total = slice.length - 1;
    const clusterProbability = Math.max(lag1HighHigh, lag1LowLow) / total;
    const meanReversionProbability = Math.max(lag1HighLow, lag1LowHigh) / total;
    
    const payout = 1.5;
    
    for (let trigger = 0; trigger <= 9; trigger++) {
        const row = matrix[trigger];
        const rowTotal = row.reduce((a, b) => a + b, 0);
        
        if (rowTotal < 10) continue;
        
        for (let barrier = 0; barrier <= 9; barrier++) {
            const count = row[barrier];
            if (count < 3) continue;
            
            const pWin = count / rowTotal;
            const ev = (pWin * payout) - ((1 - pWin) * 1);
            
            if (ev > 0) {
                results.push({
                    triggerDigit: trigger,
                    barrier,
                    probability: pWin,
                    expectedValue: ev,
                    isPositiveEV: ev > 0,
                    count,
                    total: rowTotal
                });
            }
        }
    }
    
    return {
        chiSquare,
        pValue,
        isUniform,
        clusterProbability,
        meanReversionProbability,
        marketState: clusterProbability > meanReversionProbability ? 'Clustering' : 'Mean-Reverting',
        positiveEVs: results.sort((a, b) => b.expectedValue - a.expectedValue).slice(0, 10)
    };
}

function simulateTrade(history: number[], contractType: string, barrier: number, triggerDigits: number[], triggerType: string): number {
    let wins = 0;
    let total = 0;
    
    const window = Math.min(1000, history.length);
    const slice = history.slice(-window);
    
    for (let i = 1; i < slice.length - 1; i++) {
        let matchesTrigger = false;
        
        if (triggerType === 'consecutive') {
            if (i >= 1) {
                const last = slice[i];
                const prev = slice[i - 1];
                matchesTrigger = triggerDigits.includes(last) && prev === last;
            }
        } else if (triggerType === 'pattern') {
            matchesTrigger = triggerDigits.includes(slice[i]);
        } else {
            matchesTrigger = triggerDigits.includes(slice[i]);
        }
        
        if (matchesTrigger) {
            const actual = slice[i + 1];
            let won = false;
            
            if (contractType === 'DIGITOVER') {
                won = actual > barrier;
            } else if (contractType === 'DIGITUNDER') {
                won = actual < barrier;
            } else if (contractType === 'DIGITDIFF') {
                won = actual !== barrier;
            }
            
            if (won) wins++;
            total++;
        }
    }
    
    return total > 5 ? wins / total : 0.5;
}

function generateGoldenEntries(history: number[]): GoldenEntry[] {
    const goldenEntries: GoldenEntry[] = [];
    
    const sequential = analyzeSequentialTriggers(history);
    sequential.forEach(s => {
        const checkWinRate = (barrier: number, isOver: boolean) => {
            const contract = isOver ? 'DIGITOVER' : 'DIGITUNDER';
            const winRate = simulateTrade(history, contract, barrier, [s.digit], 'single');
            if (winRate >= 0.6) {
                goldenEntries.push({
                    contractType: contract,
                    triggerDigits: [s.digit],
                    barrier: String(barrier),
                    duration: 1,
                    winRate,
                    confidence: winRate,
                    analysis: `When the entry digit is ${s.digit}, the probability of the next tick being ${isOver ? 'Over' : 'Under'} ${barrier} is ${(winRate * 100).toFixed(0)}%.`,
                    triggerType: 'single'
                });
            }
        };
        
        if (s.next1Tick.over3 >= 0.6) checkWinRate(3, true);
        if (s.next1Tick.over4 >= 0.6) checkWinRate(4, true);
        if (s.next1Tick.under5 >= 0.6) checkWinRate(5, false);
        if (s.next1Tick.under6 >= 0.6) checkWinRate(6, false);
        
        if (s.next2Tick.over3 >= 0.6) {
            const winRate = simulateTrade(history, 'DIGITOVER', 3, [s.digit], 'consecutive');
            if (winRate >= 0.6) {
                goldenEntries.push({
                    contractType: 'DIGITOVER',
                    triggerDigits: [s.digit],
                    barrier: '3',
                    duration: 2,
                    winRate,
                    confidence: winRate,
                    analysis: `When the entry digit is ${s.digit}, the probability of the next 2 ticks being Over 3 is ${(winRate * 100).toFixed(0)}%.`,
                    triggerType: 'consecutive'
                });
            }
        }
    });
    
    const coldDigits = analyzeColdDigitReversion(history);
    coldDigits.forEach(c => {
        const barrier = c.winningPattern === 'High' ? 7 : (c.winningPattern === 'Low' ? 3 : 5);
        const contract = c.winningPattern === 'High' ? 'DIGITOVER' : (c.winningPattern === 'Low' ? 'DIGITUNDER' : 'DIGITOVER');
        const winRate = simulateTrade(history, contract, barrier, [c.coldDigit], 'single');
        
        if (winRate >= 0.55) {
            goldenEntries.push({
                contractType: contract,
                triggerDigits: [c.coldDigit],
                barrier: String(barrier),
                duration: 1,
                winRate,
                confidence: c.afterHigh + c.afterLow,
                analysis: `Cold digit ${c.coldDigit} reversion: ${c.winningPattern} pattern with ${(Math.max(c.afterHigh, c.afterLow) * 100).toFixed(0)}% probability.`,
                triggerType: 'single'
            });
        }
    });
    
    const markov = analyzeMarkovChains(history);
    
    const differsPatterns = markov.filter(m => m.isDiffers && m.probability > 0.05).slice(0, 10);
    differsPatterns.forEach(m => {
        const winRate = simulateTrade(history, 'DIGITDIFF', m.toDigit, [m.fromDigit], 'single');
        if (winRate >= 0.6) {
            goldenEntries.push({
                contractType: 'DIGITDIFF',
                triggerDigits: [m.fromDigit],
                barrier: String(m.toDigit),
                duration: 1,
                winRate,
                confidence: m.probability,
                analysis: `Markov: ${m.fromDigit} -> ${m.toDigit} (${(m.probability * 100).toFixed(0)}%). Differs strategy with ${(winRate * 100).toFixed(0)}% win rate.`,
                triggerType: 'single'
            });
        }
    });
    
    const matchPatterns = markov.filter(m => m.isMatch && m.probability > 0.12).slice(0, 5);
    matchPatterns.forEach(m => {
        const winRate = simulateTrade(history, 'DIGITMATCH', m.toDigit, [m.fromDigit], 'single');
        if (winRate >= 0.6) {
            goldenEntries.push({
                contractType: 'DIGITMATCH',
                triggerDigits: [m.fromDigit],
                barrier: String(m.toDigit),
                duration: 1,
                winRate,
                confidence: m.probability,
                analysis: `Markov: ${m.fromDigit} -> ${m.toDigit} Match (${(m.probability * 100).toFixed(0)}%).`,
                triggerType: 'single'
            });
        }
    });
    
    const streaks = analyzeStreakCluster(history);
    
    const highCluster = streaks.filter(s => s.isHigh && s.frequency > 0.6).slice(0, 5);
    highCluster.forEach(s => {
        const winRate = simulateTrade(history, 'DIGITOVER', 5, [s.nextDigit], 'single');
        if (winRate >= 0.55) {
            goldenEntries.push({
                contractType: 'DIGITOVER',
                triggerDigits: [s.nextDigit],
                barrier: '5',
                duration: 1,
                winRate,
                confidence: s.frequency,
                analysis: `N-Gram: Sequence ${s.sequence} -> High digit ${s.nextDigit} (${(s.frequency * 100).toFixed(0)}%).`,
                triggerType: 'pattern'
            });
        }
    });
    
    const evenOdd = streaks.filter(s => s.isEven && s.isHigh).slice(0, 5);
    evenOdd.forEach(s => {
        const nextOddWin = simulateTrade(history, 'DIGITUNDER', 5, [s.nextDigit], 'single');
        if (nextOddWin >= 0.55) {
            goldenEntries.push({
                contractType: 'DIGITUNDER',
                triggerDigits: [s.nextDigit],
                barrier: '5',
                duration: 1,
                winRate: nextOddWin,
                confidence: s.frequency,
                analysis: `Even-High pattern ${s.sequence} -> ${s.nextDigit}. Expect odd next.`,
                triggerType: 'pattern'
            });
        }
    });
    
    const movingAvg = analyzeDigitMovingAverages(history);
    const latestMA = movingAvg[movingAvg.length - 1];
    if (latestMA) {
        if (latestMA.bias === 'High' || latestMA.trend > 1) {
            for (let d = 0; d <= 9; d++) {
                const winRate = simulateTrade(history, 'DIGITOVER', 5, [d], 'single');
                if (winRate >= 0.55) {
                    goldenEntries.push({
                        contractType: 'DIGITOVER',
                        triggerDigits: [d],
                        barrier: '5',
                        duration: 1,
                        winRate,
                        confidence: latestMA.average / 10,
                        analysis: `Trend bias: ${latestMA.bias}, Avg ${latestMA.average.toFixed(1)}. High bias detected.`,
                        triggerType: 'single'
                    });
                }
            }
        } else if (latestMA.bias === 'Low' || latestMA.trend < -1) {
            for (let d = 0; d <= 9; d++) {
                const winRate = simulateTrade(history, 'DIGITUNDER', 5, [d], 'single');
                if (winRate >= 0.55) {
                    goldenEntries.push({
                        contractType: 'DIGITUNDER',
                        triggerDigits: [d],
                        barrier: '5',
                        duration: 1,
                        winRate,
                        confidence: Math.abs(latestMA.average) / 10,
                        analysis: `Trend bias: ${latestMA.bias}, Avg ${latestMA.average.toFixed(1)}. Low bias detected.`,
                        triggerType: 'single'
                    });
                }
            }
        }
    }
    
    const quant = analyzeQuantLevel(history);
    quant.positiveEVs.forEach(ev => {
        const winRate = simulateTrade(history, 'DIGITDIFF', ev.barrier, [ev.triggerDigit], 'single');
        if (winRate >= 0.6) {
            goldenEntries.push({
                contractType: 'DIGITDIFF',
                triggerDigits: [ev.triggerDigit],
                barrier: String(ev.barrier),
                duration: 1,
                winRate,
                confidence: ev.expectedValue,
                analysis: `Quant EV: ${ev.triggerDigit} -> ${ev.barrier}. EV: ${ev.expectedValue.toFixed(3)}, Win: ${(winRate * 100).toFixed(0)}%.`,
                triggerType: 'single'
            });
        }
    });
    
    goldenEntries.sort((a, b) => b.winRate - a.winRate);
    
    return goldenEntries;
}

export function analyzeDigits(history: number[], symbol: string = 'Unknown'): AnalysisResult {
    const startTime = performance.now();
    
    const tickCount = history.length;
    
    const sequential = analyzeSequentialTriggers(history);
    const coldDigit = analyzeColdDigitReversion(history);
    const markov = analyzeMarkovChains(history);
    const streakCluster = analyzeStreakCluster(history);
    const movingAvg = analyzeDigitMovingAverages(history);
    const dispersion = analyzeDispersionVolatility(history);
    const quantLevel = analyzeQuantLevel(history);
    
    const goldenEntries = generateGoldenEntries(history);
    
    const topEntry = goldenEntries[0];
    const summary = topEntry
        ? `${topEntry.contractType} ${topEntry.barrier} trigger:${topEntry.triggerDigits.join(',')} WR:${(topEntry.winRate * 100).toFixed(0)}%`
        : 'No high-confidence patterns found';
    
    const analysisTime = performance.now() - startTime;
    
    return {
        symbol,
        goldenEntries: goldenEntries.slice(0, 10),
        analysisTime,
        tickCount,
        summary,
        detailedAnalysis: {
            sequential,
            coldDigit,
            markov,
            streakCluster,
            movingAvg,
            dispersion,
            quantLevel
        }
    };
}

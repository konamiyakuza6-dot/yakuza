---
name: Customizations zip import
description: Architecture decisions for importing the 4 trading tabs from the 360tradinghub-master zip file.
---

## Rule
All 4 custom tabs (Overlord-2026, Elite Prime AI, Signal Zone, Smart Trader) plus Free Bots (Aibots) are served from `src/pages/customizations/` — exact copies of the zip source files. Do NOT rewrite them.

**Why:** User was emphatic: copy exact source files, no rewrites.

## How to apply
- SignalTools/ → Overlord.js, ElitePremium.js, CustomDash.js (Signal Zone), Dualbot.js, EliteFlow.js (case-fixed alias of Eliteflow.js), Higherlower.js, Oracle.js
- standalones/ → SmartTrader.js, comingsoon.js
- tradingbots/ → Aibots.js
- MiniAnalysis/ → Marketview.js, SignalTool.jsx, Controls.jsx, DigitStats.jsx, HistoryLog.jsx, LiveStream.jsx, SignalPanel.jsx, useAnalysis.jsx, useDerivTicks.jsx

## Key deps
- `sweetalert2` and `axios` must be installed (used by the zip files)
- `src/utils/symbol-display-name.ts` — custom utility for getSymbolDisplayNameSync (not in original codebase)
- `updateSymbolDisplayNames` is called in `app-content.jsx` after `retrieveActiveSymbols` resolves so SmartTrader gets live market names

## Wiring in main.tsx
Lazy imports at indices 11-14 point to the customizations paths, NOT the old placeholder pages (../overlord, ../elite-prime-ai, ../signal-zone, ../smart-trader/smart-trader).

## EliteFlow case fix
Linux is case-sensitive. CustomDash.js imports `./EliteFlow` but the zip file is `Eliteflow.js`. Fix: keep both; `EliteFlow.js` is a copy of `Eliteflow.js`.

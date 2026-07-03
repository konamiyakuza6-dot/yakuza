---
name: Trading contract stuck at "Contract bought" (new-auth users)
description: Three-bug root cause for contracts never closing in the new OTP WebSocket auth path.
---

## The rule
Three things must all be true for contracts to close in the new-auth (PKCE/OTP WS) flow:
1. `subscribeNewSystemTopics()` must be called **inside `ws.onopen`** — not just at proxy setup time.
2. Every `proposal_open_contract` send must include `subscribe: 1`.
3. `OpenContract.js` must guard against null `api_base.account_info`.

**Why:**
- `_setupNewSystemApiProxy()` calls `subscribeNewSystemTopics()` at init, but the OTP WS is not open yet → returns false, flag stays unset, and **nobody calls it again** when the WS actually opens. So no global POC subscription ever activates.
- `Purchase.js` (and fallback/retry paths) sent `{ proposal_open_contract: 1, contract_id }` without `subscribe: 1` → one-shot snapshot only; no streaming updates → contract stays "open" forever.
- `OpenContract.js` line 26 called `api_base.account_info.loginid` directly — for new-auth users the WS authorize never runs so `account_info` is null → TypeError kills the handler before `is_sold` can be processed.

**How to apply:**
- In `NewDerivAuth.js` `ws.onopen`: call `subscribeNewSystemTopics()` and retry with `setTimeout(..., 500)` if the proxy isn't ready yet.
- In `Purchase.js` all three `api_base.api.send({ proposal_open_contract ... })` calls: always include `subscribe: 1`.
- In `trade/index.js` recovery subscription: also include `subscribe: 1`.
- In `OpenContract.js` `broadcastContract` call: use `api_base.account_info?.loginid || localStorage.getItem('active_loginid') || ''` as the accountID.

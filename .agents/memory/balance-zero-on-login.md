---
name: Balance shows 0.00 after login (PKCE/new-auth users)
description: Why all accounts show 0.00 USD on first render after OAuth login, and the two-file fix.
---

## The rule
`legacyClientAccounts` written by `NewDerivAuth.js` must always include a `balance` field.
`CoreStoreProvider`'s init effect must merge `cached_balances` (sessionStorage) on top of `clientAccounts` before calling `setAllAccountsBalance`.

**Why:**
`NewDerivAuth.js` `createNewWebSocket()` builds `legacyClientAccounts` from the REST `/options/accounts` response and writes it to localStorage — but was writing only `{ loginid, token, currency }` with **no balance**. `CoreStoreProvider` then reads that on mount and calls `client.setAllAccountsBalance` with every account at `parseFloat(undefined || '0') = 0`. The 30-second REST balance poll eventually corrects it, but the initial render — and any render before the poll fires — shows 0.00.

**How to apply:**
1. In `NewDerivAuth.js` `createNewWebSocket()` near `legacyClientAccounts[lid] = {...}`: always include `balance: String(parseFloat(acc.balance || '0'))` and `is_virtual`.
2. In `CoreStoreProvider.tsx` balance init effect: read `cached_balances` from sessionStorage first, then merge over `clientAccounts` entries (prefer cached value; also add any accounts in cache that aren't in clientAccounts yet).

The `cached_balances` sessionStorage is written by `NewDerivAuth.js` `ws.onopen` handler from the REST accounts array, so it always contains real balances by the time `setIsAuthorized(true)` fires and `CoreStoreProvider` re-renders.

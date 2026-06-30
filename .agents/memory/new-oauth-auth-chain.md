---
name: New OAuth PKCE auth chain
description: All fixes required for Bearer-token (new OAuth) login to work — auth state seeding, market data, and loading-spinner unblock.
---

## The problem
New OAuth PKCE flow stores a Bearer token (`NEW_AUTH_token` in localStorage). This token:
- ✅ Works with Deriv REST API (`api.derivws.com/trading/v1`)
- ❌ Does NOT work with Deriv WebSocket `authorize` call (needs old-style `a1-XXX` tokens)

## localStorage shape (set by bootstrapNewAuthSession in NewDerivAuth.js)
- `NEW_AUTH_token` — Bearer token (signals new-auth mode everywhere)
- `active_loginid` — Phase 1: `'deriv_oauth_user'`; Phase 2: real ID like `'CR123456'`
- `clientAccounts` — `{ [loginid]: { loginid, currency, account_type, balance } }`
- `accountsList` — `{ [loginid]: Bearer_token }`
- `authToken` — Bearer token (legacy key, used by some checks)

## Fix 1 — AuthWrapper.tsx
Always call `api_base.init(true)`. Do NOT skip for new-auth mode (that prevents WebSocket from connecting → no market data).

## Fix 2 — api-base.ts handleTokenExchangeIfNeeded()
When `NEW_AUTH_token` present:
1. Skip `authorizeAndSubscribe()` entirely (would fail → catch → `clearAuthData()` → redirect loop)
2. Read `clientAccounts` from localStorage → build accountListArr
3. Call `setIsAuthorized(true)`, `setAuthData({loginid, balance, currency, ...})`, `setAccountList([...])`
4. Emit `globalObserver.emit('api.authorize', {...})` for components listening
5. Force `this.getActiveSymbols()` (public API, no auth needed) → market dropdowns populate
6. Call `setIsAuthorizing(false)` and return

**Why:** Bearer token can't WS-authorize; seeding from localStorage keeps header/account-switcher populated.

## Fix 3 — api-base.ts authorizeAndSubscribe() catch block
Do NOT call `clearAuthData()` when `NEW_AUTH_token` is present. That wipe + `location.reload()` causes the infinite redirect loop.

## Fix 4 — CoreStoreProvider.tsx (the spinner unblock)
`app-content.jsx` gates content behind `client.is_landing_company_loaded`. This is set ONLY by `client.setLandingCompany()`. In legacy flow it's called after `api_base.api.getSettings()` + `api_base.api.landingCompany()` — both require WS auth.

**Fix:** In the `useEffect([isAuthorizing, isAuthorized, client])` block, when `isNewLoggedIn()` is true, call `client.setLandingCompany({} as TLandingCompany)` immediately and return. This sets `is_landing_company_loaded = true` → `changeActiveSymbolLoadingState()` → `setIsLoading(false)` → spinner gone.

## Fix 5 — CoreStoreProvider.tsx (live balance polling)
New-auth users don't get WS balance subscription. Polling added:
- `fetchNewAuthBalances()` calls `GET /options/accounts` with Bearer token
- `useEffect([isAuthorized, client])` — guarded by `isNewLoggedIn()` — polls every 30 s
- Also updates `sessionStorage.cached_balances` for offline-refresh

## How to apply
Any time new-auth login is broken, check these 5 fixes in order. The key signal is:
- Redirect loop → Fix 3 missing
- Header shows "Log In" → Fix 2 missing
- Markets "Not available" → Fix 2 (getActiveSymbols) or Fix 1 missing
- Content spinner stuck → Fix 4 missing
- Balance shows 0 → Fix 5 missing

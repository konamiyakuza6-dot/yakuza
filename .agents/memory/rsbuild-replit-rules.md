---
name: Replit rsbuild config rules
description: Mandatory rsbuild.config.ts adjustments needed for this project to run on Replit.
---

When restoring rsbuild.config.ts from a zip or external source, always apply these Replit-specific overrides:

1. **Port**: `server.port = 5000` (not 3000 — Replit preview pane maps port 5000 to external port 80)
2. **Host**: `server.host = '0.0.0.0'` (required for Replit iframe proxy)
3. **Fonts glob**: use `noErrorOnMissing: true` on deriv-charts font/shader copy rules — the fonts directory doesn't exist in the installed package version
4. **Proxy**: keep `/api` proxy to `http://localhost:3001` for the Express backend
5. **source.include**: keep `[/node_modules\/@deriv-com\/translations/]` — needed to process that ESM package
6. **OAuth redirect**: keep `brand.config.json` `oauth.redirect_uri` as `""` so `getAuthRedirectUri()` falls back to `window.location.origin`

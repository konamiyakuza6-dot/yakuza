---
name: Zip import missing exports
description: When importing zip source, api-base.ts expects functions missing from utility files; must add them manually.
---

The zip's `src/external/bot-skeleton/services/api/api-base.ts` imports:
- `getAccountId`, `removeUrlParameter` from `@/utils/account-helpers`
- `isBackendError`, `handleBackendError` from `@/utils/error-handler`

But the zip's utility files only export `getAccountType`/`isDemoAccount` and `handleError` respectively.

**Why:** The zip has a version mismatch — api-base.ts was updated to use these helpers but the helper files weren't updated in the same commit.

**How to apply:** After any zip import of this codebase, add these exports to the utility files:
- `account-helpers.ts`: add `getAccountId()` (reads localStorage active_loginid) and `removeUrlParameter(param)` (uses history.replaceState)
- `error-handler.ts`: add `isBackendError(error)` (type guard) and `handleBackendError(error)` (returns error.message)

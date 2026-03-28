## Problem

After signing out, users cannot sign back in even though their username is registered in the system. The app remembers the username exists (registration fails with "already taken") but login fails silently or with an error.

## Root Cause Analysis

State synchronization bug between React component state and localStorage:

1. `useAuth()` checks `isLoggedIn()` only **once** at initialization — it doesn't re-check localStorage after token changes
2. After logout, if `setToken()` fails silently during re-login, the hook sets `user` state to non-null (authenticated) while localStorage has no valid token
3. Subsequent API calls (e.g., `getSettings()` on mount) fail with 401, which clears the token again, bouncing the user back to login
4. No integration test covers the logout → re-login flow

## Key Files

- `frontend/src/hooks/useAuth.ts` — `isLoggedIn()` checked once, not re-evaluated
- `frontend/src/api/client.ts` — token get/set, 401 handling clears token
- `frontend/src/api/index.ts` — `login()` doesn't verify token was stored
- `frontend/src/App.tsx` — renders based on `isAuthenticated` from useAuth

## Acceptance Criteria

- [ ] User can log out and immediately log back in with the same credentials
- [ ] Token storage is verified before declaring user authenticated
- [ ] 401 responses during login flow surface a clear error message
- [ ] Integration test: logout → re-login → authenticated API call succeeds
- [ ] No race condition between `setToken()` and `setUser()`

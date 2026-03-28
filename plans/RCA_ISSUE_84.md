# RCA: Issue #84 — Cannot sign back in after signing out

## Problem Statement

After logging out and attempting to log back in, users get stuck in a broken
state where React believes they are authenticated but no valid token exists in
localStorage. This manifests as infinite redirects or a blank authenticated
screen that immediately 401s.

**Reproduction steps:**
1. Log in successfully
2. Log out
3. Attempt to log back in
4. Observe: broken state / redirect loop

## Root Cause

**Primary**: `useAuth()` in `frontend/src/hooks/useAuth.ts:30-32` initialises
`user` state with a one-shot `isLoggedIn()` check. This `useState` initialiser
runs only once per mount — it never re-evaluates when localStorage changes.

**Secondary**: The 401 interceptor in `frontend/src/api/client.ts:35-38` clears
the token from localStorage and hard-redirects to `/login?expired=1`, but this
does **not** update React state. On the next mount the stale `isLoggedIn()` may
still return `true` if timing allows, or — more critically — the React state
from the previous render tree may persist through a soft navigation.

**Contributing**: `login()` in `useAuth` calls `setUser()` immediately after
`apiLogin()` resolves without verifying that the token was actually persisted to
localStorage.

## Analysis

The fundamental issue is a **split-brain** between two sources of truth:
- **localStorage** (token presence) — what the API client trusts
- **React state** (`user`) — what the UI trusts

These can diverge in three ways:
1. The 401 interceptor clears localStorage but React state stays authenticated
2. `login()` sets React state before confirming localStorage write succeeded
3. `isLoggedIn()` on mount reads stale localStorage state

## Impact

- **Severity**: P0 — users cannot use the app after logging out
- **Scope**: All users who log out and attempt to log back in
- **Frequency**: 100% reproducible

## Fix Strategy

**Recommended**: Make React state the single source of truth by:
1. Having `login()` verify token storage before setting user state
2. Having `logout()` ensure both localStorage and React state are cleared atomically
3. Adding a `storage` event listener so external token changes (401 handler, other tabs) sync to React state
4. Replacing the hard `window.location.href` redirect in the 401 handler with a token-clear-only approach, letting React's conditional rendering handle the redirect naturally

## Prevention

- Add integration test for the full logout → re-login → authenticated API call flow
- Add a `useAuth` unit test that exercises token/state synchronization

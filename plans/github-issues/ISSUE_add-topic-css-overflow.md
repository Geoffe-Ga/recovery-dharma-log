## Problem

The "Add Topic" button in Settings overflows its container frame, bleeding past the right edge. This also squishes the freeform text input field to its left, making it unusably narrow on smaller viewports.

## Root Cause

The `.rd-inline-form` uses `display: flex` with:
- Input: `flex: 3` (shrinks to accommodate button)
- Button: `flex: none` with `padding-inline: 1rem` and `white-space: nowrap`

When the container is narrow, the button refuses to shrink (`flex: none`) or wrap, pushing past the container boundary while the input gets compressed.

## Proposed Fix

```css
.rd-settings .rd-inline-form {
  display: flex;
  flex-wrap: wrap;           /* allow wrapping on narrow viewports */
  gap: var(--rd-space-sm);
  align-items: flex-end;
}

.rd-settings .rd-inline-form input {
  flex: 1 1 auto;            /* grow and shrink */
  min-width: 12rem;          /* minimum usable width before wrapping */
  margin-bottom: 0;
}

.rd-settings .rd-inline-form button {
  flex: 0 0 auto;            /* don't grow, don't shrink */
  white-space: nowrap;
  margin-bottom: 0;
  padding-inline: var(--rd-space-md);
}
```

## Key File

- `frontend/src/styles/rd-theme.css` — `.rd-inline-form` styles (lines 1183-1200)

## Acceptance Criteria

- [ ] "Add Topic" button stays within the container on all viewport sizes
- [ ] Text input maintains a usable minimum width
- [ ] On narrow screens, button wraps below the input instead of overflowing
- [ ] No visual regression on desktop-width viewports

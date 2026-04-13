# [Medium] No intra-group roles — every member is effectively an admin

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 6.3 — AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:L
**CWEs:** CWE-284 (Improper Access Control), CWE-250 (Execution with Unnecessary Privileges), CWE-863 (Incorrect Authorization)
**OWASP:** A01:2021 Broken Access Control, API5:2023 Broken Function-Level Authorization, ASVS V4.1 / V4.2

## Summary

Every authenticated user in a group can:

- Rename the group (`PUT /settings/`)
- Change the meeting day / time / format rotation
- Generate or revoke invite codes
- Create / delete topics
- Draw / undo / reshuffle the topic deck
- Schedule or remove speakers
- Create / edit / delete reading assignments and book positions
- Set per-date format overrides
- Edit or cancel past meeting logs (`PUT /meetings/log/{id}`)
- Update dana (financial) amounts
- Export the full meeting history

There is no distinction between "group admin" (the secretary) and "member" (a newcomer who just joined with an invite code). Once a user is authenticated and attached to a `group_id`, they are effectively a group administrator.

Combined with invite-code abuse ([#11](./11-medium-invite-code-abuse.md)), a single brute-forced or leaked code hands full admin authority over the group to an attacker, with no visible change to existing members other than the new row in `users`.

This is also the enabling condition for stored XSS ([#02](./02-critical-stored-xss-html-export.md)) and CSV injection ([#03](./03-high-csv-formula-injection.md)): a "member" can plant payloads under admin-level data without any friction.

## Where

- `backend/app/models.py:92-108` — `User` has no role column.
- `backend/app/auth.py:40-65` — `get_current_user` returns any authenticated user.
- All mutating endpoints across `backend/app/routers/*` — none check for admin role.

## Recommended fix

### Data model

```python
# backend/app/models.py
from enum import Enum

class Role(str, Enum):
    ADMIN = "admin"
    SECRETARY = "secretary"
    MEMBER = "member"


class User(Base):
    ...
    role: Mapped[str] = mapped_column(String(16), nullable=False, default=Role.MEMBER.value)
```

Migration path:
- The creator of a group (`register` path that creates a new group — `routers/auth.py:47-75`) gets `role="admin"`.
- Users joining via invite code get `role="member"`.
- An existing data migration sets every pre-existing user of a group to `"admin"` if they are the sole member, else the earliest-created user.

### Dependency helpers

```python
# backend/app/auth.py
def require_role(*roles: Role):
    def _inner(user: User = Depends(get_current_user)) -> User:
        if user.role not in {r.value for r in roles}:
            raise HTTPException(403, "Insufficient privileges")
        return user
    return _inner

require_admin = require_role(Role.ADMIN)
require_secretary = require_role(Role.ADMIN, Role.SECRETARY)
```

### Route annotation

| Endpoint | Role |
|----------|------|
| `GET` everywhere | any authenticated |
| `PUT /settings/` | admin |
| `POST/DELETE /settings/invite-code` | admin |
| `POST /setup/*` | admin |
| `POST /topics/` / `DELETE /topics/{id}` | secretary |
| `POST /topics/draw|undo|reshuffle` | secretary |
| `POST /speakers/schedule` / `DELETE /speakers/schedule/{date}` | secretary |
| `PUT|DELETE /overrides/*` | secretary |
| `PUT /meetings/log/*` | secretary |
| `POST /meetings/cancel` | secretary |
| `PUT /meetings/*/dana` | admin |
| Book/plan mutations | secretary |

(A "secretary" is an elevated member who runs meetings but can't change the group name or membership; the rotating person can be any member promoted by an admin. Tune as the community wants.)

### Admin-role audit

Every successful admin-only action is written to `ActivityLog` with `action="admin_<...>"` for high-signal review.

### UI

Hide buttons the current user lacks privileges for (defence-in-depth — server still enforces). Add a Members tab in Settings where admins can change roles, kick members, and see pending invites.

## Acceptance criteria

- [ ] `User.role` column exists with values in `{admin, secretary, member}`.
- [ ] Attempt to `PUT /settings/` as a non-admin returns HTTP 403.
- [ ] Frontend hides admin-only controls when `current_user.role != "admin"`.
- [ ] Integration tests verify role enforcement for each listed endpoint.
- [ ] Admin cannot downgrade themselves to non-admin if they are the sole admin of the group (prevent lockout).

## References

- OWASP "Access Control": https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html
- CWE-284: https://cwe.mitre.org/data/definitions/284.html
- NIST SP 800-162 (ABAC): https://csrc.nist.gov/publications/detail/sp/800-162/final

# Module 01: Authentication & Authorization

## Overview

The Auth module is the security foundation of Sear POS. It handles identity verification, session management, and access control for every user and device in the system. Every API request and page load flows through this module's middleware.

**Who uses it:** Every user (owners, managers, servers, bartenders, hosts, kitchen staff, cashiers, kiosk devices). Terminal registration is performed by admins during setup.

**Why it matters:** A restaurant POS handles money, employee data, and customer information. Auth must be fast (PIN login in under 1 second), secure (PCI DSS 4.0 compliant), and frictionless (servers should never wait on a login screen during rush).

---

## Database Tables

### Core Tables (from SCHEMA.md)

- **`users`** — Employee records with `pin_hash` (bcrypt), `role` (user_role enum), `location_ids`, `email`, `hourly_rate`, `is_active`, `deleted_at`
- **`organizations`** — Tenant container; every auth check scopes to `org_id`
- **`locations`** — Location-level access control; users have `location_ids[]`
- **`terminals`** — Device registration with `device_id`, `terminal_type`, `current_user_id`, `last_heartbeat_at`
- **`permissions`** — Permission definitions (`code`, `module_id`, `category`)
- **`role_permissions`** — Default permissions per role
- **`user_permission_overrides`** — Per-user grant/deny overrides
- **`audit_log`** — All auth events logged (login, logout, failed attempts, PIN verify, password changes)

### Auth-Specific Columns

- `users.pin_hash` — bcrypt hash of 4-6 digit PIN for quick POS login
- `users.role` — Enum: platform_admin, owner, admin, manager, server, bartender, host, kitchen, cashier, kiosk, readonly
- `terminals.device_id` — Browser fingerprint or assigned device identifier
- `terminals.current_user_id` — Who is currently logged in on this terminal

---

## API Routes

### Blueprint: `/api/v1/auth/`

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/login` | Email/password login, returns JWT + refresh token | No |
| POST | `/login/pin` | PIN-based quick login within terminal context | Terminal session |
| POST | `/refresh` | Refresh expired JWT using refresh token | Refresh token |
| POST | `/logout` | Invalidate session, clear cookies | Yes |
| POST | `/forgot-password` | Send password reset email via SendGrid | No |
| POST | `/reset-password` | Reset password using token from email | No |
| GET | `/me` | Get current user profile and permissions | Yes |
| PUT | `/me` | Update profile (name, avatar, password) | Yes |
| POST | `/verify-manager-pin` | Verify a manager PIN for override actions | Yes |
| POST | `/register-terminal` | Register a new terminal device | Admin+ |

### Rate Limiting

- `/login`: 10 per minute per IP
- `/login/pin`: 5 per minute per terminal (brute-force protection)
- `/forgot-password`: 3 per minute per email
- `/verify-manager-pin`: 10 per minute per terminal

---

## UI Pages / Components

### Login Page (`/login`)
- Email + password form with "Show password" toggle
- "Forgot password?" link
- Error messages for invalid credentials, locked accounts
- Redirects to POS or back-office based on role
- Rate limit feedback ("Too many attempts, try again in X seconds")

### PIN Login Page (`/pin-login`)
- Avatar grid showing on-duty staff at this location
- Tap avatar, then enter 4-6 digit PIN via numpad
- PIN dots mask input, "Clear" and "Backspace" buttons
- Lockout display after 5 failed attempts (15-minute lockout)
- Clock-in integration — if not clocked in, prompt to clock in first

### Clock In/Out Page (`/clock`)
- PIN entry numpad
- Shows current clock-in status
- Break start/end buttons
- Shift role selection (if user has multiple roles)

### Manager Override Modal (component, appears inline)
- Triggered by protected actions (void, comp, discount over threshold)
- Numpad for manager PIN entry
- Shows which action is being approved
- Timeout after 30 seconds of inactivity

### Profile Page (`/profile`)
- Edit name, avatar
- Change password (requires current password)
- Change PIN (requires current PIN or password)
- View assigned locations and permissions (read-only)

---

## Business Rules

1. **Password complexity:** Minimum 8 characters, must contain uppercase, lowercase, and a number. PCI DSS 4.0 recommends 12+ but system supports 8 minimum with enforcement configurable per org.

2. **PIN uniqueness:** PINs must be unique within an organization. No two active users can share the same PIN.

3. **PIN brute-force lockout:** After 5 consecutive failed PIN attempts, the account is locked for 15 minutes. The lockout counter resets on successful login. All failed attempts are logged to `audit_log`.

4. **JWT token lifecycle:**
   - Access token: 15-minute expiry
   - Refresh token: 7-day expiry
   - Tokens carry claims: `org_id`, `user_id`, `role`, `permissions[]`, `location_ids[]`
   - Local JWT verification (decode + verify signature) — no Supabase Auth API call on every request

5. **Terminal sessions:** The terminal itself has a long-lived session (device auth via `device_id`). Individual user sessions within the terminal are shorter-lived and PIN-gated. When a user clocks out or logs out, the terminal returns to the PIN login screen — not the email login screen.

6. **Manager override flow:** Certain actions require `X-Manager-PIN` header. The manager does not need to be the current user. Any user with `manager`, `admin`, or `owner` role can provide their PIN. The action is logged with both `performed_by` (the acting user) and `approved_by` (the manager).

7. **Role hierarchy:** platform_admin > owner > admin > manager > server/bartender/host > kitchen/cashier > kiosk > readonly. Higher roles inherit all permissions of lower roles unless explicitly denied via `user_permission_overrides`.

8. **Session cookies for page auth:** HTML page routes use `HttpOnly` secure cookies (not Bearer tokens) for authentication. API routes accept Bearer tokens. The login endpoint sets both.

9. **Audit logging:** Every auth event creates an `audit_log` entry: login success, login failure, logout, password change, PIN change, terminal registration, manager override approval/denial, permission change.

10. **Multi-location access:** Users can be assigned to multiple locations via `location_ids[]`. API requests include a `X-Location-ID` header to scope data. Users cannot access data from locations not in their `location_ids`.

---

## Dependencies

- **None** — Auth is the foundational module. All other modules depend on it.
- **External services:** Supabase Auth (JWT issuance), SendGrid (password reset emails), Redis DB 2 (session/rate limiting storage)

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `user.logged_in` | `events.auth` | `{user_id, terminal_id, location_id}` | Successful login |
| `user.logged_out` | `events.auth` | `{user_id, terminal_id}` | Logout or session expiry |
| `user.clocked_in` | `events.staff` | `{user_id, location_id, role}` | Clock-in via PIN |
| `user.clocked_out` | `events.staff` | `{user_id, location_id}` | Clock-out |
| `terminal.registered` | `events.settings` | `{terminal_id, location_id}` | New terminal registration |
| `user.locked_out` | `events.auth` | `{user_id, reason}` | Brute-force lockout triggered |

### Subscribed Events
- None (Auth is a publisher, not a subscriber)

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `expire_sessions` | Every 15 minutes | Clear expired sessions from Redis |
| `unlock_locked_accounts` | Every 5 minutes | Reset lockout for accounts past the 15-minute window |
| `audit_log_cleanup` | Daily at 3 AM | Archive audit_log entries older than retention period (configurable, default 90 days) |

---

## Acceptance Criteria

### Email Login
- [ ] User can log in with valid email and password and receives a JWT
- [ ] User sees "Invalid credentials" for wrong email or password (no indication of which is wrong)
- [ ] User is rate-limited after 10 failed login attempts per minute
- [ ] Login sets both a Bearer token (for API) and an HttpOnly cookie (for page auth)
- [ ] JWT contains `org_id`, `user_id`, `role`, `permissions`, `location_ids` claims
- [ ] Login event is written to `audit_log`

### PIN Login
- [ ] User can tap their avatar on the PIN login screen and enter their PIN to log in
- [ ] Only on-duty staff at the current location appear on the avatar grid
- [ ] After 5 failed PIN attempts, the user is locked out for 15 minutes
- [ ] Lockout state is displayed clearly with countdown timer
- [ ] Failed PIN attempts are logged to `audit_log`

### Token Refresh
- [ ] Access token can be refreshed using a valid refresh token
- [ ] Expired refresh tokens return 401
- [ ] Refresh returns a new access + refresh token pair

### Manager Override
- [ ] Protected actions prompt for manager PIN when `X-Manager-PIN` is not provided
- [ ] Valid manager PIN (from any manager/admin/owner) allows the action to proceed
- [ ] Invalid manager PIN returns 403
- [ ] Both `performed_by` and `approved_by` are recorded in audit/modification logs

### Terminal Registration
- [ ] Admin can register a new terminal with name, type, and location
- [ ] Terminal receives a `device_id` that persists across sessions
- [ ] Registered terminal appears in Settings > Terminals list
- [ ] Terminal heartbeat updates `last_heartbeat_at`

### Password Management
- [ ] User can change their password (requires current password)
- [ ] Password must meet complexity requirements (8+ chars, mixed case, number)
- [ ] Forgot password sends reset email via SendGrid
- [ ] Reset token expires after 1 hour
- [ ] Password change is logged to `audit_log`

### Authorization
- [ ] Routes decorated with `@require_auth` reject unauthenticated requests with 401
- [ ] Routes decorated with `@require_permission('x')` reject unauthorized users with 403
- [ ] Routes decorated with `@require_role('manager')` reject insufficient roles with 403
- [ ] RLS variables are set on every authenticated request (`org_id`, `user_id`, `role`)
- [ ] Users cannot access data from locations not in their `location_ids`

### Security
- [ ] PINs are stored as bcrypt hashes (never plaintext, never SHA-256)
- [ ] Passwords are stored as bcrypt hashes
- [ ] JWT verification is local (signature check, not Supabase API call)
- [ ] CSRF protection is active on all form submissions
- [ ] No secrets are hardcoded in source code

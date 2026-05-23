## MODIFIED Requirements

### Requirement: Login Logout And Me Routes

API SHALL provide minimal auth routes for browser cookie session use, with explicit refresh semantics.

#### Scenario: Login issues v2 HttpOnly session cookie

- **WHEN** a client posts valid local administrator credentials to `POST /api/v1/auth/login`
- **THEN** the response succeeds using `ApiResponse[T]`
- **AND** the response sets a v2 session cookie containing `v`, `sid`, `sub`, `actor_type`, `iat`, `exp`, `max_exp`, `capabilities`
- **AND** the session cookie is `HttpOnly`
- **AND** the response body contains a non-sensitive `csrf_token`
- **AND** the response body does not contain the raw session, cookie value, signing secret, password, or password hash

#### Scenario: Me returns actor data without unconditional refresh

- **WHEN** an authenticated client requests `GET /api/v1/me` with a valid v2 session
- **THEN** the response succeeds using `ApiResponse[T]`
- **AND** the response contains the current actor id, actor type, capability snapshot and `csrf_token`
- **AND** the response does not unconditionally re-sign the session cookie

#### Scenario: Me may upgrade a legacy v1 cookie once

- **WHEN** an authenticated client requests `GET /api/v1/me` with a valid legacy v1 session cookie
- **THEN** the implementation may upgrade that cookie to v2 exactly for compatibility
- **AND** the upgraded cookie does not extend beyond the legacy cookie's original expiration
- **AND** the response returns the actor snapshot and the upgraded stable `csrf_token`

#### Scenario: Explicit refresh extends idle expiration

- **WHEN** an authenticated client posts to `POST /api/v1/auth/refresh` with a valid session and valid `X-CSRF-Token`
- **THEN** the response succeeds using `ApiResponse[T]`
- **AND** it returns the current actor snapshot plus current `exp`/`max_exp` state
- **AND** it only extends `exp` when the remaining idle time is at or below the configured refresh threshold
- **AND** it never extends `exp` beyond `max_exp`

#### Scenario: Explicit refresh may skip Set-Cookie when no extension is needed

- **WHEN** an authenticated client posts to `POST /api/v1/auth/refresh`
- **AND** the remaining idle time is still above the configured refresh threshold
- **THEN** the response succeeds
- **AND** the implementation may return the current session state without re-signing or re-writing the cookie

### Requirement: CSRF Protection For Cookie Session Writes

Cookie-session write operations SHALL use CSRF protection with a stable header contract.

#### Scenario: Refresh keeps a stable v2 CSRF token

- **WHEN** a browser client refreshes a valid v2 session through `POST /api/v1/auth/refresh`
- **THEN** the response keeps the same `csrf_token` before and after refresh when the session identity is unchanged
- **AND** the token does not depend on `exp`

#### Scenario: Missing CSRF token rejects refresh

- **WHEN** an authenticated client sends `POST /api/v1/auth/refresh` without `X-CSRF-Token`
- **THEN** the response rejects the request
- **AND** the response uses the standard error envelope
- **AND** the response does not expose expected token material

#### Scenario: Invalid CSRF token rejects refresh

- **WHEN** an authenticated client sends `POST /api/v1/auth/refresh` with an invalid `X-CSRF-Token`
- **THEN** the response rejects the request
- **AND** the response uses the standard error envelope
- **AND** the response does not echo the submitted token

### Requirement: Auth OpenAPI And Tests

Auth routes and guards SHALL be covered by runtime behavior tests and OpenAPI contract tests.

#### Scenario: Auth OpenAPI includes explicit refresh route

- **WHEN** tests read development app `/openapi.json`
- **THEN** the schema contains `/api/v1/auth/login`
- **AND** the schema contains `/api/v1/auth/logout`
- **AND** the schema contains `/api/v1/auth/refresh`
- **AND** the schema contains `/api/v1/me`
- **AND** each route has explicit tags and envelope responses

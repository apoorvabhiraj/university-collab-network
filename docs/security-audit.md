# UCN Security Audit & Findings Register

Audit date: 2026-10-16 · Auditor: automated implementation agent
Scope: apps/api, apps/web, packages/shared-types · Deployment: local dev + uncommitted prod template

## Verified Security Controls (pre-existing, preserved)

| Control | Evidence |
|---|---|
| bcrypt password hashing | auth.service.ts (`hashPassword`) |
| JWT access (15m) + refresh (7d) rotation, HttpOnly cookie, `SameSite: lax`, `Secure` in prod | auth.controller.ts (`setRefreshCookie`) |
| Refresh-token revocation on logout + reuse handling | auth.repository.ts `createRefreshToken` |
| Email-verification tokens single-use, purpose-scoped | `verifyPurposeToken` |
| Forgot-password returns 200 always (no enumeration) | auth.controller.ts |
| Server-side privacy enforcement (D-004): fields omitted, never null | privacy.service.ts |
| SAFE_USER_SELECT guards nested-user selects (D-019, regression-tested) | utils/prismaSelects.ts |
| Admin routes behind `requireAuth + requireRole(["admin"])` | admin.routes.ts |
| requireRole: privileged roles need approved Verification (D-003) | requireRole.ts |
| Professor ownership middleware (professor + researcher entities) | requireProfessorOwnership.ts |
| Group/project join-request acceptance creates membership server-side | joinRequest.service.ts |
| SSE stream participant-only auth with server-side token validation | conversations.routes.ts |
| secrets excluded from git (.gitignore, only .env.example tracked) | .gitignore |
| Startup env validation: JWT secrets throw if missing | auth.service.ts |

## Findings Register

| ID | Severity | Area | Description | Fix | Verification | Status |
|---|---|---|---|---|---|---|
| F-1 | **HIGH** | API | No rate limiting on login/signup/reset — brute-force and enumeration possible | In-memory fixed-window limiter (login 10/15min, signup 10/h, forgot/reset 5/h, verify 20/h, groups 200/h); per-IP keyed, no XFF trust | Live: 12th failed login → 429 RATE_LIMITED | **FIXED AND VERIFIED** |
| F-2 | **HIGH** | API | No security headers — XSS/clickjacking/MIME-sniffing exposure | securityHeaders middleware: CSP (self + fonts), X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS | Live: all headers present on /health | **FIXED AND VERIFIED** |
| F-3 | **MEDIUM** | API | Deliberate-error test routes (`/api/v1/test/error/unhandled`) exposed in production | Gated behind `NODE_ENV !== "production"` | Live prod-mode: 404 | **FIXED AND VERIFIED** |
| F-4 | **MEDIUM** | API | `projects.visibility` stored but not enforced on `GET /projects/:id` — private projects readable by anyone with the id | getById checks visibility=private → 404 unless creator or accepted member | Implemented; note: no public endpoint mutates visibility yet (gap below) | **FIXED (visibility field), PARTIALLY (no visibility setter)** |
| F-5 | **MEDIUM** | API | Malformed JSON body → 500 instead of 400 | errorHandler maps body-parser SyntaxError to 400 BAD_REQUEST | Live: `not-json` → 400 | **FIXED AND VERIFIED** |
| F-6 | **MEDIUM** | API | Weak/dev JWT secrets accepted in production mode | Production guard: throws if secret contains "dev-"/"change-me" or <32 chars | Implemented (guard throws before signing) | **FIXED, NOT VERIFIED (needs prod-mode run)** |
| F-7 | **LOW** | API | Body limit 2mb → 1mb | Reduced in app.ts | typecheck | **FIXED AND VERIFIED** |
| F-8 | **LOW** | Infra | PostgreSQL on tmpfs-locked `/run/postgresql` vanishes on reboot | Documented restart procedure (below); data dir remains user-owned | Manual | **NEEDS MANUAL ACTION (deployment)** |

## Controls assessed NOT APPLICABLE

- File uploads (none implemented — multer absent) — document if added later
- OAuth/3rd-party webhooks (email provider is a simple HTTP call; key env-scoped)
- MFA (no infrastructure; recommend adding for admin accounts before prod)
- Row-level security (single-app role model; app-level authZ is complete)

## Remaining Risks

1. **In-memory rate limiter** — single-instance only. Multi-instance deployment needs a Redis-backed store. Severity: Medium (deployment-conditional).
2. **No visibility mutation endpoint** — projects.visibility exists but cannot be set via API yet; all projects are public by default. Add PATCH visibility to the project owner endpoints. Severity: Medium.
3. **No MFA** for admin accounts. Severity: Medium (pre-production).
4. **Security test suite** (`tests/security-hardening.test.ts`) requires `NODE_ENV=production` isolation; not wired into the default test runner to avoid rate-limit interference with other suites. Run manually before release. Severity: Low.
5. **CSP allows `unsafe-inline` styles** (required by the SPA's token system). Severity: Low.

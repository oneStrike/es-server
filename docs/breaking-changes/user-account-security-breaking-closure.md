# User Account Security Breaking Closure

> Date: 2026-06-07
> Scope: `apps/app-api/src/modules/auth`, `apps/admin-api/src/modules/*-user`, `libs/user`, `libs/identity`, `apps/web-ele`
> Type: destructive security contract update

## Decision

User account authentication and lifecycle operations now fail closed around SMS verification, password reset, token revocation, and privileged admin account changes.

This is a hard cutover. Old app clients and admin workflows that rely on registration without SMS verification, password reset without reset-code validation, default admin reset passwords, or manual ID entry in operator-facing assignment flows must be updated before release.

## App Auth Contract Changes

- App registration requires a valid SMS code for the `LOGIN_REGISTER` template.
- SMS-code login validates the same `LOGIN_REGISTER` template before issuing tokens.
- Forgot-password reset validates the `RESET_PASSWORD` SMS template before changing credentials.
- Forgot-password reset accepts the RSA-encrypted password contract used by the existing password path and hashes only the decrypted value.
- Successful forgot-password reset revokes all existing app user tokens for that user.
- SMS sending enforces concrete default rate limits from `app.auth.smsRateLimit`:
  - `phoneTemplateCooldownSeconds`: `60`
  - `phoneTemplateDailyLimit`: `10`
  - `ipTemplateMinuteLimit`: `30`
  - `phoneIpHourLimit`: `5`
- The default limits can be overridden with `SMS_PHONE_TEMPLATE_COOLDOWN_SECONDS`, `SMS_PHONE_TEMPLATE_DAILY_LIMIT`, `SMS_IP_TEMPLATE_MINUTE_LIMIT`, and `SMS_PHONE_IP_HOUR_LIMIT`.

## Account Lifecycle Changes

- App user disable, ban, permanent ban, and delete revoke all tokens for the affected app user.
- Mute and timed mute do not revoke tokens.
- Timed ban and mute state respects expired `banUntil` values instead of treating stale timestamps as active punishment.
- Admin-created random app accounts are generated through a bounded retry path.
- App user page queries support registration `startDate` and `endDate` filters.

## Admin Account Changes

- Admin users cannot disable or downgrade their own account through account management.
- The last enabled super admin cannot be disabled or downgraded.
- Disabling another admin revokes that admin user's tokens.
- Admin password reset no longer falls back to a shared default password.
- Admin password reset returns a one-time `temporaryPassword` in the response. Operators must copy it from the immediate reset result because it is not recoverable later.

## Admin UI Changes

- Account-manager edit/reset flows reflect the one-time temporary password contract.
- Current login account editing is blocked in account management.
- User growth and badge flows replace operator-hostile raw ID or raw key entry with selectors where the safe domain already exists.
- Derived app-user table columns such as points, experience, topic count, and reply count are not remote-sortable unless the server explicitly supports the sort field.

## Generated API Note

Admin generated API/type files remain generated-only. During this repair, `pnpm -F @vben/web-ele run att` was first checked against the remote generation source, then rerun against the current local admin OpenAPI contract because the remote source had not yet caught up with `temporaryPassword`.

The retained generated files are from:

```bash
OPENAPI_GENERATOR_URL=http://127.0.0.1:8080/api-doc-json OPENAPI_GENERATOR_METHOD=GET pnpm run att
```

Publish the updated admin OpenAPI source before the next ordinary remote `att` run, otherwise the remote generator source can drift back to the old boolean reset-password response.

## Verification

Required checks for this update:

```bash
pnpm type-check
pnpm test -- --runInBand --runTestsByPath apps/app-api/src/modules/auth/auth.service.spec.ts apps/app-api/src/modules/auth/sms.service.spec.ts apps/app-api/src/modules/auth/password.service.spec.ts
pnpm test -- --runInBand --runTestsByPath libs/user/src/user.service.spec.ts apps/admin-api/src/modules/app-user/app-user-command.service.spec.ts apps/admin-api/src/modules/app-user/app-user-query.service.spec.ts apps/admin-api/src/modules/admin-user/admin-user.service.spec.ts
pnpm -F @vben/web-ele run typecheck
```

The highest-risk runtime path remains real JWT denial after token revocation. Unit tests cover revocation calls and lifecycle boundaries; staging should additionally smoke a protected route with a token issued before disable, ban, delete, or reset.

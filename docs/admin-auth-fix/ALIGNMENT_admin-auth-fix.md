# Admin Auth Strategy Fix Alignment

## Project Context
The project is a NestJS Monorepo with `apps/admin-api` and `apps/app-api`. Authentication logic is centralized in `libs/base/src/modules/auth`.
- `AuthStrategy` (JWT) is implemented in `libs/base`.
- `AuthStrategy` depends on `ITokenStorageService` to validate tokens against storage (DB).
- `apps/app-api` implements this correctly.
- `apps/admin-api` currently **lacks** `AuthStrategy` registration and `ITokenStorageService` implementation.

## Problem Statement
The user pointed out that "Strategy is implemented in lib, check admin regarding this".
Investigation confirms that `apps/admin-api` imports `JwtAuthModule` (which provides `AuthService` but NOT `AuthStrategy`) and sets `JwtAuthGuard` globally.
However, since `AuthStrategy` is not provided in `admin-api`'s module context, authentication is likely broken or relying on some fallback (though `passport` usually throws if strategy is missing).
Actually, if `AuthStrategy` is not registered, `AuthGuard('jwt')` will fail.

Additionally, `admin-api` does not store tokens in the database, meaning `ITokenStorageService` cannot be implemented using the same pattern as `app-api` without schema changes.

## Goals
1.  Fix the missing `AuthStrategy` in `apps/admin-api`.
2.  Implement `AdminTokenStorageService` for `admin-api`.
3.  Ensure `admin-api` stores tokens in the database (requires schema update) to allow for token revocation and management (Consistency with App API).

## Proposed Solution
1.  **Schema Update**:
    - Create `AdminUserToken` model in `prisma/models/admin/admin-user-token.prisma`.
    - Update `AdminUser` in `prisma/models/admin/admin-user.prisma` to include relation to `AdminUserToken`.
    - Run `prisma migrate dev` (if environment allows) or `prisma generate`.

2.  **Implementation**:
    - Create `AdminTokenStorageService` in `apps/admin-api/src/modules/auth/admin-token-storage.service.ts` implementing `ITokenStorageService`.
    - Update `apps/admin-api/src/modules/auth/auth.module.ts`:
        - Import `AuthStrategy` from `@libs/base/modules/auth`.
        - Provide `AuthStrategy`.
        - Provide `ITokenStorageService` using `AdminTokenStorageService`.
    - Update `apps/admin-api/src/modules/auth/auth.service.ts`:
        - Call `AdminTokenStorageService.storeToken()` (or similar) after login to save the token.
        - Handle logout to revoke token.

## Questions/Decisions
- **Assumption**: We should align Admin API with App API's token storage mechanism (DB backed) for better security and consistency.
- **Action**: I will proceed with creating the schema and service.

## Verification
- Verify `admin-api` can start without errors.
- Verify login works and token is stored in DB.
- Verify protected routes work.

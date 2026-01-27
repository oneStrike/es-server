# Token Storage Service Refactoring

## 1. Context Analysis
- **Goal**: Unify `AdminTokenStorageService` and `AppTokenStorageService` to reduce code duplication.
- **Current State**:
    - `AppTokenStorageService`: `apps/app-api/src/modules/auth/token-storage.service.ts`
    - `AdminTokenStorageService`: `apps/admin-api/src/modules/auth/token-storage.service.ts`
    - Both share ~80% identical logic.
    - `App` side has better caching in `isTokenValid`.
    - `App` side has extra methods: `revokeByJtis`, `revokeAllByUserId`, `findActiveTokensByUserId`, `getUserDevices`.
- **Constraint**:
    - Different Prisma models: `AdminUserToken` vs `AppUserToken`.
    - Different database tables.

## 2. Proposed Solution
- Create `BaseTokenStorageService` in `libs/base/src/modules/auth/base-token-storage.service.ts`.
- `BaseTokenStorageService` will inherit from `BaseService` and implement `ITokenStorageService`.
- It will be an abstract class requiring subclasses to provide the `tokenDelegate` (the Prisma model delegate).
- Common methods to move to Base:
    - `createToken`
    - `createTokens`
    - `findByJti`
    - `isTokenValid` (incorporating the caching logic from App side)
    - `revokeByJti`
    - `cleanupExpiredTokens`
    - `deleteOldRevokedTokens`
    - `revokeByJtis` (Generic enough)
    - `revokeAllByUserId` (Generic enough)
    - `findActiveTokensByUserId` (Generic enough)
    - `getUserDevices` (Generic enough, assuming schema consistency)

## 3. Implementation Steps
1.  **Create Base Class**: `libs/base/src/modules/auth/base-token-storage.service.ts`.
2.  **Refactor Admin Service**: Update `apps/admin-api/src/modules/auth/token-storage.service.ts` to extend Base.
3.  **Refactor App Service**: Update `apps/app-api/src/modules/auth/token-storage.service.ts` to extend Base.
4.  **Verification**: Ensure both services compile and run.

## 4. Questions/Decisions
- **Caching**: We will promote the Redis caching logic from `App` to `Base` so `Admin` also benefits from it.
- **Extra Methods**: We will move generic extra methods to Base. `getUserDevices` relies on `deviceInfo`, `ipAddress`, `createdAt` fields which exist in both models (checked via `AdminUserToken.ts` snippet).

# Token Storage Service Refactoring Tasks

## Task 1: Create BaseTokenStorageService
- **File**: `libs/base/src/modules/auth/base-token-storage.service.ts`
- **Description**: Implement the abstract base class with all common logic and caching.
- **Dependencies**: None.

## Task 2: Refactor AdminTokenStorageService
- **File**: `apps/admin-api/src/modules/auth/token-storage.service.ts`
- **Description**: Extend `BaseTokenStorageService`, implement `tokenDelegate`.
- **Dependencies**: Task 1.

## Task 3: Refactor AppTokenStorageService
- **File**: `apps/app-api/src/modules/auth/token-storage.service.ts`
- **Description**: Extend `BaseTokenStorageService`, implement `tokenDelegate`.
- **Dependencies**: Task 1.

## Task 4: Verification
- **Description**: Compile and check for type errors.
- **Dependencies**: Task 2, Task 3.

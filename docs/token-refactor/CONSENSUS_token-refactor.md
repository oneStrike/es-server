# Token Storage Service Refactoring Consensus

## 1. Requirements
- Refactor `AdminTokenStorageService` and `AppTokenStorageService` to share common logic.
- Reduce code redundancy.
- Maintain existing functionality.
- Apply caching optimizations to both services.

## 2. Technical Solution
- **Base Class**: `BaseTokenStorageService` in `libs/base/src/modules/auth`.
- **Abstraction**: Use an abstract getter `get tokenDelegate()` to handle different Prisma models.
- **Functionality**:
    - Move all CRUD and Cache logic to Base.
    - Subclasses only define the specific Prisma delegate.

## 3. Verification Plan
- Check compilation.
- Verify that `AdminTokenStorageService` and `AppTokenStorageService` still export the required methods.
- (Optional) Run tests if available, or manual check via code review of the generated files.

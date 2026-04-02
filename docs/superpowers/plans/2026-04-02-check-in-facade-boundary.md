# Check-In Facade Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `CheckInService` as the check-in module's single public entry while shrinking `CheckInServiceSupport` by moving runtime/execution-specific helpers back into their owning services.

**Architecture:** Preserve the existing facade plus definition/runtime/execution split, but stop publicly exporting `CheckInRuntimeService` and relocate service-specific helper methods out of the shared support base. Keep only genuinely shared date, snapshot, lookup, and mapping primitives in `CheckInServiceSupport`.

**Tech Stack:** NestJS, TypeScript, Jest, Drizzle ORM

---

### Task 1: Lock The Boundary With Tests

**Files:**
- Modify: `libs/growth/src/check-in/test/check-in.service.spec.ts`

- [ ] Add a failing test that asserts `CheckInModule` no longer exports `CheckInRuntimeService`.
- [ ] Add a failing test that asserts the public barrel no longer re-exports `CheckInRuntimeService`.
- [ ] Add a failing test that asserts `CheckInDefinitionService` no longer exposes runtime or execution helper methods that belong in sibling services.

### Task 2: Narrow The Public API

**Files:**
- Modify: `libs/growth/src/check-in/check-in.module.ts`
- Modify: `libs/growth/src/check-in/index.ts`
- Modify: `libs/growth/src/check-in/check-in.service.ts`

- [ ] Remove `CheckInRuntimeService` from the module exports list.
- [ ] Remove `CheckInRuntimeService` from the public barrel.
- [ ] Tighten the facade comment so it clearly states that `CheckInService` is the module's public application entry.

### Task 3: Move Execution-Specific Helpers Down

**Files:**
- Modify: `libs/growth/src/check-in/check-in-execution.service.ts`
- Modify: `libs/growth/src/check-in/check-in.service.support.ts`

- [ ] Move cycle creation, record/grant lookup, aggregation recompute, grant candidate resolution, reward biz-key builders, and insert payload builders into `CheckInExecutionService`.
- [ ] Keep shared low-level utilities in support only when they are reused by multiple services.

### Task 4: Move Runtime-Specific Helpers Down

**Files:**
- Modify: `libs/growth/src/check-in/check-in-runtime.service.ts`
- Modify: `libs/growth/src/check-in/check-in.service.support.ts`

- [ ] Move current-cycle view assembly, next reward resolution, record-to-grant map construction, calendar day assembly, and record view mapping into `CheckInRuntimeService`.
- [ ] Leave only shared date/snapshot/plan helpers in support.

### Task 5: Verify The Refactor

**Files:**
- Modify: `libs/growth/src/check-in/test/check-in.service.spec.ts`

- [ ] Run `pnpm test libs/growth/src/check-in/test/check-in.service.spec.ts --runInBand` and confirm the new boundary tests pass.
- [ ] Run `pnpm type-check` if the targeted Jest run surfaces no unresolved typing issues outside the touched module; otherwise run the narrowest check that proves the touched files compile.

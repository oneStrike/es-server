---
name: es-server-standards
description: Repository-specific enforcement workflow for `.trae` standards in this `es-server` monorepo. Use when planning/reviewing/implementing code under `apps/*`, `libs/*`, or `db/*` that must follow controller, comment, DTO, service, type, and Drizzle rules.
---

# ES Server Standards

## Overview

Use this skill whenever work touches `apps/admin-api`, `apps/app-api`, `libs/*`, or `db/*`.
Treat `.trae/rules/*` as first-class constraints and align implementation to rule documents instead of generic NestJS habits.

## Workflow

1. Identify touched layers first: controller, comment/docs, DTO, service/resolver, type file, schema/Drizzle.
2. Read matching rule docs before editing:
   - controller: `../../../.trae/rules/CONTROLLER_SPEC.md`
   - comment: `../../../.trae/rules/COMMENT_SPEC.md`
   - dto: `../../../.trae/rules/DTO_SPEC.md`
   - service: `../../../.trae/rules/drizzle-guidelines.md` and `../../../.trae/rules/ERROR_HANDLING_SPEC.md`
   - type: `../../../.trae/rules/TS_TYPE_SPEC.md`
   - drizzle: `../../../.trae/rules/drizzle-guidelines.md`
3. If service change touches counters, also read `../../../.trae/rules/COUNTER_SPEC.md`.
4. Inspect sibling modules and shared abstractions with `rg` before introducing a new pattern.
5. Implement with existing platform helpers and public APIs; avoid deep imports.
6. Run validation with the narrowest useful commands from `references/repo-map.md`.
7. Report any rule conflict explicitly in delivery notes; do not silently spread inconsistent legacy patterns.

## Layer Checklists

### Controller

- Keep controller thin: receive input, apply auth or audit decorators, declare Swagger, call service.
- Use RPC-style paths and `kebab-case` segments.
- Use response DTOs or primitives in `ApiDoc` and `ApiPageDoc`.
- Do not place database logic or multi-step business orchestration in controllers.

### Comment (Code Comments)

- Follow `COMMENT_SPEC.md`: explain rationale, constraints, side effects, risk.
- Do not duplicate Swagger/validator/DTO obvious semantics in controller and DTO comments.
- For service/resolver comments, focus on transaction boundaries, idempotency, retry/compensation, and failure semantics.
- For `db/schema` comments, follow Drizzle guideline section about field comments when schema changes are involved.

### DTO

- Make entity base DTOs mirror Drizzle tables exactly.
- Build scene DTOs in `libs/*` with mapped types before manually redeclaring fields.
- Keep service public signatures 1:1 with `libs/*` DTO contracts.
- Reuse `IdDto`, `IdsDto`, `BaseDto`, `PageDto` before adding new common shapes.
- Keep scenario DTOs (`Create/Update/Query/Response`) in `libs/*`; avoid duplicating the same contract in `apps/*`.
- For enum arrays, use `ArrayProperty + itemEnum`, and type fields as `XxxEnum[]`.

### Drizzle / Service / Resolver

- Inject `DrizzleService` instead of raw database clients or Prisma leftovers.
- Wrap writes in `withErrorHandling`; use `assertAffectedRows` when existence matters.
- Use `drizzle.ext.findPagination` for paging and `SQL[] + and(...)` for dynamic conditions.
- Pass `tx` through the entire call chain if a transaction starts.
- Keep raw SQL parameterized and localized to helper methods.
- Keep error semantics aligned with `ERROR_HANDLING_SPEC.md` (layered responsibility, clear business exceptions, degradable side effects).

### Type

- Reuse entity fields via `Pick/Omit/Partial` from `@db/schema` inferred types.
- Use `import type` for type-only imports.
- Put non-DTO internal domain types in `*.type.ts` near the owning module.
- Do not keep mirrored `Input/View` types when they are isomorphic to DTOs; prefer direct DTO usage or type aliases.

## Validation Baseline

- Type-check is required: `pnpm type-check`.
- Run targeted compile checks for touched app(s) when needed.
- Run `eslint` on touched files when rule-sensitive layers change (controller/DTO/type/schema/service).
- Add or update tests when behavior/contract/error semantics change.

## Repo Notes

- Global HTTP prefix is `/api`; controller decorators do not include it.
- `findPagination` and `PageDto` now use a shared 1-based `pageIndex` contract. Reuse that behavior instead of translating page numbers locally.
- `apps/*` are entry layers; reusable domain logic usually belongs in `libs/*`.
- Define and export Drizzle inferred types close to the corresponding `db/schema` files.
- For repo libs, import via named public APIs instead of root barrels. Multi-domain libs use `@libs/<lib>/<domain>`, aggregate Nest modules use `@libs/<lib>/module`, and single-domain aggregate exports use `@libs/<lib>/core`. Avoid file-level deep imports except for established platform namespaces such as `@libs/platform/modules/auth`.

## References

- Read `references/repo-map.md` for directory map, aliases, and validation commands.
- Read `references/rule-index.md` for quick rule lookup and known repo-specific inconsistencies.

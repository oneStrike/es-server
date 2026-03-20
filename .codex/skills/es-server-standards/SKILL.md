---
name: es-server-standards
description: Repository-specific workflow for working in this `es-server` NestJS + Fastify + Drizzle monorepo. Use when planning or implementing changes to controllers, DTOs, services, resolvers, Swagger docs, schema-adjacent types, or module structure under `apps/*`, `libs/*`, or `db/*`.
---

# ES Server Standards

## Overview

Use this skill whenever work touches `apps/admin-api`, `apps/app-api`, `libs/*`, or `db/*` in this repository. Rebuild context from the nearby module first, then align the change with the repo's controller, DTO, and Drizzle rules instead of applying generic NestJS defaults.

## Workflow

1. Identify the layer you are changing: controller, DTO, service, resolver, schema, or bootstrap.
2. Read the matching rule source before editing:
   - controller or Swagger work: `../../../.trae/rules/CONTROLLER_SPEC.md`
   - DTO work: `../../../.trae/rules/DTO_SPEC.md`
   - Drizzle, service, or resolver work: `../../../.trae/rules/drizzle-guidelines.md`
   - repo-wide expectations and conflict handling: `../../../AGENTS.md`
3. Inspect sibling modules and shared abstractions with `rg` before introducing a new pattern.
4. Reuse existing platform helpers: `ApiDoc`, `ApiPageDoc`, `CurrentUser`, `Public`, `libs/platform/src/dto/*`, `DrizzleService`, `drizzle.schema`, `drizzle.ext`.
5. Validate with the narrowest useful command from `references/repo-map.md`.

## Layer Checklists

### Controller

- Keep controller thin: receive input, apply auth or audit decorators, declare Swagger, call service.
- Use RPC-style paths and `kebab-case` segments.
- Use response DTOs or primitives in `ApiDoc` and `ApiPageDoc`.
- Do not place database logic or multi-step business orchestration in controllers.

### DTO

- Make entity base DTOs mirror Drizzle tables exactly.
- Build app DTOs with mapped types before manually redeclaring fields.
- Keep service signatures on Drizzle or domain types, not app DTOs.
- Reuse `IdDto`, `IdsDto`, `BaseDto`, `PageDto` before adding new common shapes.

### Drizzle / Service / Resolver

- Inject `DrizzleService` instead of raw database clients or Prisma leftovers.
- Wrap writes in `withErrorHandling`; use `assertAffectedRows` when existence matters.
- Use `drizzle.ext.findPagination` for paging and `drizzle.buildWhere` or `SQL[]` for dynamic conditions.
- Pass `tx` through the entire call chain if a transaction starts.
- Keep raw SQL parameterized and localized to helper methods.

## Repo-Specific Notes

- Global HTTP prefix is `/api`; controller decorators do not include it.
- `findPagination` currently accepts both 0-based and 1-based `pageIndex` inputs. Reuse that behavior instead of translating page numbers locally.
- `apps/*` are entry layers; reusable domain logic usually belongs in `libs/*`.
- Define and export Drizzle inferred types close to the corresponding `db/schema` files.

## References

- Read `references/repo-map.md` for directory map, aliases, and validation commands.
- Read `references/rule-index.md` for quick rule lookup and known repo-specific inconsistencies.

# Forum Topic Module Service Split

> Date: 2026-06-02
> Scope: `libs/forum/src/topic`
> Type: destructive internal architecture update

## Decision

`ForumTopicService` is now the forum topic module public API facade. It keeps controller and cross-module call sites stable while delegating all read paths to `ForumTopicQueryService` and all write or transaction side-effect paths to `ForumTopicCommandService`.

The facade is not a compatibility shell and must not contain Drizzle access, DTO mapping, permission branching, or side-effect orchestration. Those responsibilities belong to the query/command owner services and their shared support base.

## Boundary

- `apps/*` controllers and cross-module consumers should continue injecting `ForumTopicService`.
- `ForumTopicQueryService` owns detail/page/feed read models and read-side hydration.
- `ForumTopicCommandService` owns create/update/delete/governance transactions, counters, logs, mentions, hashtags, and growth side effects.
- `ForumTopicServiceSupport` is shared implementation support for query/command only.

## Contract Changes

- Admin/public topic output DTO nullable fields are required nullable fields, so JSON responses keep stable keys and use `null` instead of omitting fields.
- Topic service mappers normalize nullable values explicitly before returning DTOs.
- Admin topic pagination has deterministic default sorting: `updatedAt desc, id desc`.
- Following feed no longer materializes all followed user/section/hashtag IDs in application memory; it uses database-side `exists` conditions.

## Verification

Required checks for this update:

```bash
pnpm type-check
pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/dto/forum-topic.dto.spec.ts libs/forum/src/topic/forum-topic.service.spec.ts libs/forum/src/topic/forum-topic-query.service.spec.ts libs/forum/src/topic/forum-topic-command.service.spec.ts
pnpm test -- --runInBand --runTestsByPath libs/forum/src/moderator/moderator-governance.service.spec.ts
```

Representative database `EXPLAIN ANALYZE` checks for following feed and admin keyword queries still need a staging dataset and are not covered by local unit tests.

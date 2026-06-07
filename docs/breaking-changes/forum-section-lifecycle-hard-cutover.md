# Forum Section Lifecycle Hard Cutover

## Scope

This cutover makes the forum domain the only owner of `forum_section` lifecycle writes. The work domain may request a managed section for a work, sync managed metadata, or release the managed section, but it must not insert, update, or delete `forum_section` rows directly.

## Breaking Contract

- Admin repair routes moved from follow-only repair to full counter repair:
  - `POST /api/admin/forum/sections/rebuild-counts`
  - `POST /api/admin/forum/sections/rebuild-counts-all`
- The single-section repair response now returns the repaired counter snapshot: `topicCount`, `commentCount`, `lastTopicId`, `lastPostAt`, and `followersCount`.
- Work-driven section changes go through `ForumSectionService` owner APIs:
  - `createManagedSectionForWork`
  - `syncManagedSectionForWork`
  - `releaseManagedSectionForWork`
- Section deletion now refuses sections referenced by live topics, active work bindings, or moderator section scope rows. Moderator scope rows are not silently removed by section deletion.

## Consistency Rules

- Topic moves and section deletion take stable section advisory locks before mutating section counters or validating final section state.
- Counter repair recalculates topic count, comment count, last topic, last post time, and follower count in one owner operation.
- `rebuild-counts-all` processes sections in batches and logs batch progress. The admin HTTP path has a synchronous section-count limit; when production volume exceeds that limit, the operation fails explicitly and must be run through a background job rather than weakening the repair contract or allowing an unbounded request.

## Admin Operations

- Admin API code must be generated with `pnpm -F @vben/web-ele run att`.
- The forum section page exposes group selection as a dropdown, including the ungrouped option, so operators do not need to enter raw group ids.
- Tree selection syncs the same group selector used by the search form; the backend query receives normalized `groupId` or `isUngrouped`.

## Migration Notes

No schema migration is required for this cutover. Deployment still runs `pnpm db:migrate:prod` to prove the current production migration chain is clean before release.

## Rollback Notes

Rollback must restore the old admin generated API and server routes together. Do not roll back only the admin page or only the server controller, because the repair endpoint names and response DTO changed as a pair.

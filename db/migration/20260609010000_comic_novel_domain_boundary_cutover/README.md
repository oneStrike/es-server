# Comic/Novel Domain Boundary Cutover

This migration is a destructive cutover gate for the comic/novel boundary:

- `work.type` is immutable after creation.
- Admin comic routes only operate `COMIC` works and chapters.
- Admin novel routes only operate `NOVEL` works and chapters.
- Chapter content routes are bound to their expected content domain.

`migration.sql` blocks production migration when live chapters do not match the
owning work type, or when live chapters point at a missing/deleted work. After
that gate passes, it installs database triggers that reject new live chapter
domain drift, any work type changes, and work soft-deletes with live chapters.

Run this cutover while the migrator wraps the file in one transaction, or pause
content write traffic until the migration finishes. The preflight gate and
trigger installation must be observed as one deployment step so no new drift can
be written between the check and the trigger creation.

`reconcile.sql` reports the same blocking counts plus a non-blocking
`content_shape_review_required_count` for human review of suspicious stored
chapter content shapes.

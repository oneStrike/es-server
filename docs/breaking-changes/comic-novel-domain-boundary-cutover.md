# Comic/Novel Domain Boundary Cutover

Comic and novel management are now hard-separated at the server boundary.

- `UpdateWorkDto` no longer accepts `type`; runtime `type` payloads are ignored.
- Comic admin work/detail/update/status/flag/delete calls require `COMIC`.
- Novel admin work/detail/update/status/flag/delete calls require `NOVEL`.
- Admin chapter list/detail/update/delete/batch-delete/sort/status calls require
  the route's expected work type.
- Comic content upload/list/update/delete/move/clear only touches comic chapters.
- Novel content upload/detail/delete only touches novel chapters.
- Third-party comic import and sync create/update/rollback only touch comic
  works and chapters.

Before deployment, run the reconcile query in
`db/migration/20260609010000_comic_novel_domain_boundary_cutover/reconcile.sql`.
Deployment is blocked unless `chapter_type_mismatch_count=0` and
`orphan_chapter_count=0`. `content_shape_review_required_count` is informational
and should be reviewed by operations.

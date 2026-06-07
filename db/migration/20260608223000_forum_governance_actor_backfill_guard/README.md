# Forum Governance Actor Backfill Guard

Repairs environments that already ran the first recoverable-delete migration
before the actor backfill guard was tightened.

The migration rewrites moderator governance actors from `forum_moderator.user_id`
and then fails fast if any moderator log still cannot prove that
`actor_user_id` is the moderator user's id.

# Forum Topic Recoverable Delete Governance

Introduces the destructive recoverable-delete contract for forum topics:

- marks topic-cascade-deleted comments with `user_comment.topic_delete_cascade_id`;
- widens `forum_moderator_action_log` into the shared forum governance log with actor fields;
- adds restore action type `16`;
- adds admin topic indexes for active/deleted review filters and stable ordering.

Existing moderator logs are backfilled as `actor_type=1` using
`forum_moderator.user_id`. Rows whose `moderator_id` cannot be mapped to a
real moderator user fail the migration instead of fabricating an actor.

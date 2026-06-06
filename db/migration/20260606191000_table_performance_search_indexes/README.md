# Table Performance Search Indexes

This migration is handwritten because the optimization uses `pg_trgm` operator
classes, expression indexes, and a partial live-message predicate. The active
worktree also already contains an unrelated untracked `forum_topic` migration,
so this package avoids regenerating or rewriting that pending work.

Indexes:

- `user_comment_forum_topic_content_trgm_idx` supports existing forum comment
  `ILIKE '%keyword%'` search on live forum comments.
- `forum_hashtag_slug_lower_trgm_idx` and
  `forum_hashtag_display_name_lower_trgm_idx` support existing normalized
  hashtag contains search without changing result semantics.
- `chat_message_conversation_live_seq_idx` supports conversation message
  initial/before/after cursor reads over readable statuses `NORMAL` and
  `REVOKED`.

Large-table rollout still needs target database evidence. If target tables are
large and continuously written, use a DBA/maintenance-window runbook instead of
silently relying on ordinary transactional migration behavior.

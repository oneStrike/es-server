# Forum Moderator Breaking Closure

Adds an independent moderator lifecycle log and composite log indexes used by
admin audit pages and moderator action-log lookups.

The migration is intentionally additive for data shape and only replaces the
single-column `created_at` action-log index with a descending equivalent that
matches the schema declaration.

# Level Rule Business Boundary Check

Adds the database boundary for canonical level business domains.

## Contract

- Normalizes existing blank or padded `user_level_rule.business` values to the canonical persisted form.
- Enforces `business` as either `NULL` or a trimmed nonblank string.


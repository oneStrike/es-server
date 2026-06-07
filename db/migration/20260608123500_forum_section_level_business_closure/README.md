# Forum Section Level Business Closure

Closes the business-domain boundary for forum section access level rules.

## Contract

- Clears legacy `forum_section.user_level_rule_id` values that do not point to `business = 'forum'`.
- Rejects future forum section bindings to non-forum level rules.
- Prevents referenced forum level rules from being moved out of the forum business or deleted.


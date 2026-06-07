# Emoji Contract Hard Cutover

This destructive migration aligns `emoji_asset` with the server/admin contract.

## Conversion Rules

- `unicode_sequence` codepoint notation such as `1F600`, `U+1F600`, `0x1F600`, and separated multi-codepoint values is converted to rendered glyph text.
- Remaining invalid unicode assets are disabled by setting `is_enabled=false`.
- `keywords` objects are normalized to `Record<locale,string[]>`.
- `keywords` strings become `{ "und": ["value"] }`.
- `keywords` string arrays become `{ "und": [...] }`.
- Empty, mixed, malformed, or unsupported keyword values become `null`.
- FK constraints are added as `NOT VALID`: new writes are enforced, while historical orphan cleanup can be audited before later validation.

## Preflight SQL

```sql
SELECT jsonb_typeof(keywords) AS keyword_shape, count(*)
FROM emoji_asset
GROUP BY jsonb_typeof(keywords)
ORDER BY keyword_shape;

SELECT count(*) AS keyword_strings
FROM emoji_asset
WHERE jsonb_typeof(keywords) = 'string';

SELECT count(*) AS keyword_arrays
FROM emoji_asset
WHERE jsonb_typeof(keywords) = 'array';

SELECT count(*) AS malformed_keyword_objects
FROM emoji_asset
WHERE jsonb_typeof(keywords) = 'object'
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(keywords) AS entry(locale, value)
    WHERE btrim(locale) = '' OR jsonb_typeof(value) <> 'array'
  );

SELECT count(*) AS unicode_codepoint_notation
FROM emoji_asset
WHERE kind = 1
  AND unicode_sequence ~* '^(U\+|0x)?[0-9a-f]{4,6}([,;_\s+-]+(U\+|0x)?[0-9a-f]{4,6})*$';

SELECT id, pack_id, unicode_sequence
FROM emoji_asset
WHERE kind = 1
  AND is_enabled = false
  AND (unicode_sequence IS NULL OR btrim(unicode_sequence) = '')
ORDER BY id
LIMIT 100;

SELECT emoji_asset.id, emoji_asset.pack_id
FROM emoji_asset
LEFT JOIN emoji_pack ON emoji_pack.id = emoji_asset.pack_id
WHERE emoji_pack.id IS NULL
LIMIT 100;

SELECT recent.user_id, recent.scene, recent.emoji_asset_id
FROM emoji_recent_usage AS recent
LEFT JOIN app_user ON app_user.id = recent.user_id
LEFT JOIN emoji_asset ON emoji_asset.id = recent.emoji_asset_id
WHERE app_user.id IS NULL OR emoji_asset.id IS NULL
LIMIT 100;
```

## Follow-up Validation

After historical orphan cleanup, validate the FKs explicitly:

```sql
ALTER TABLE emoji_asset VALIDATE CONSTRAINT emoji_asset_pack_id_fkey;
ALTER TABLE emoji_recent_usage VALIDATE CONSTRAINT emoji_recent_usage_user_id_fkey;
ALTER TABLE emoji_recent_usage VALIDATE CONSTRAINT emoji_recent_usage_emoji_asset_id_fkey;
```

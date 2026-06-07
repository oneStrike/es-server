# Emoji Contract Hard Cutover

## Decision

Emoji assets now have one canonical server contract.

- `unicodeSequence` is stored as the rendered Unicode glyph sequence.
- `keywords` is stored as `Record<string, string[]>`.
- `shortcode` is lowercase `[a-z0-9_]{2,32}`.
- New writes reject malformed unicode, shortcode, and keyword payloads.

## Removed Shapes

The write API no longer accepts these persistent shapes:

- `unicodeSequence` stored as `U+1F600`, `1F600`, `0x1F600`, or separated codepoint text.
- `keywords` as a JSON string.
- `keywords` as a JSON array.
- `keywords` objects whose values are not string arrays.

Historical data is converted only by migration. Runtime writes do not keep a compatibility layer.

## Database Integrity

The migration adds `NOT VALID` foreign keys:

- `emoji_asset.pack_id -> emoji_pack.id`
- `emoji_recent_usage.user_id -> app_user.id`
- `emoji_recent_usage.emoji_asset_id -> emoji_asset.id`

They enforce new writes immediately. Existing orphan rows must be audited with the migration README SQL before constraint validation.

## Operator Impact

Admin operators should use pack selectors, friendly unicode input with preview, and structured keyword rows. Raw pack IDs and free-form keyword JSON are no longer the intended authoring path.

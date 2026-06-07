CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION normalize_emoji_keywords_contract(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  normalized jsonb;
BEGIN
  IF value IS NULL OR value = 'null'::jsonb THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(value) = 'string' THEN
    IF btrim(value #>> '{}') = '' THEN
      RETURN NULL;
    END IF;
    RETURN jsonb_build_object('und', jsonb_build_array(btrim(value #>> '{}')));
  END IF;

  IF jsonb_typeof(value) = 'array' THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(value) AS item
      WHERE jsonb_typeof(item) <> 'string' OR btrim(item #>> '{}') = ''
    ) THEN
      RETURN NULL;
    END IF;

    SELECT jsonb_agg(keyword)
    INTO normalized
    FROM (
      SELECT DISTINCT btrim(item #>> '{}') AS keyword
      FROM jsonb_array_elements(value) AS item
      WHERE btrim(item #>> '{}') <> ''
      ORDER BY keyword
    ) AS keywords;

    IF normalized IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN jsonb_build_object('und', normalized);
  END IF;

  IF jsonb_typeof(value) = 'object' THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_each(value) AS entry(locale, keywords)
      WHERE btrim(locale) = ''
        OR jsonb_typeof(keywords) <> 'array'
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(keywords) AS item
          WHERE jsonb_typeof(item) <> 'string'
        )
    ) THEN
      RETURN NULL;
    END IF;

    SELECT jsonb_object_agg(locale, keyword_array)
    INTO normalized
    FROM (
      SELECT
        btrim(entry.locale) AS locale,
        jsonb_agg(DISTINCT btrim(item #>> '{}')) FILTER (
          WHERE btrim(item #>> '{}') <> ''
        ) AS keyword_array
      FROM jsonb_each(value) AS entry(locale, keywords)
      CROSS JOIN LATERAL jsonb_array_elements(entry.keywords) AS item
      GROUP BY btrim(entry.locale)
    ) AS normalized_locale
    WHERE jsonb_array_length(COALESCE(keyword_array, '[]'::jsonb)) > 0;

    RETURN normalized;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_emoji_unicode_sequence_contract(value text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned text;
  tokens text[];
  token text;
  result text := '';
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;

  cleaned := btrim(value);
  cleaned := regexp_replace(cleaned, '(?i)(U\+|0x)', '', 'g');
  cleaned := regexp_replace(cleaned, '[\[\]"'']', '', 'g');

  tokens := regexp_split_to_array(cleaned, '[^0-9A-Fa-f]+');
  tokens := ARRAY(SELECT t FROM unnest(tokens) AS t WHERE t <> '');

  IF cardinality(tokens) = 0 OR EXISTS (
    SELECT 1 FROM unnest(tokens) AS t WHERE t !~ '^[0-9A-Fa-f]{4,6}$'
  ) THEN
    RETURN btrim(value);
  END IF;

  FOREACH token IN ARRAY tokens LOOP
    result := result || chr(('x' || lpad(token, 8, '0'))::bit(32)::int);
  END LOOP;

  RETURN result;
END;
$$;

UPDATE emoji_asset
SET
  unicode_sequence = normalize_emoji_unicode_sequence_contract(unicode_sequence),
  updated_at = now()
WHERE kind = 1
  AND unicode_sequence IS NOT NULL;

UPDATE emoji_asset
SET
  is_enabled = false,
  updated_at = now()
WHERE kind = 1
  AND (
    unicode_sequence IS NULL
    OR btrim(unicode_sequence) = ''
    OR unicode_sequence ~* '^(U\+|0x)?[0-9a-f]{4,6}([,;_\s+-]+(U\+|0x)?[0-9a-f]{4,6})*$'
  );

UPDATE emoji_asset
SET
  keywords = normalize_emoji_keywords_contract(keywords),
  updated_at = now()
WHERE keywords IS NOT NULL;

ALTER TABLE emoji_asset
  ADD CONSTRAINT emoji_asset_pack_id_fkey
  FOREIGN KEY (pack_id)
  REFERENCES emoji_pack(id)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE emoji_recent_usage
  ADD CONSTRAINT emoji_recent_usage_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES app_user(id)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE emoji_recent_usage
  ADD CONSTRAINT emoji_recent_usage_emoji_asset_id_fkey
  FOREIGN KEY (emoji_asset_id)
  REFERENCES emoji_asset(id)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT
  NOT VALID;

CREATE INDEX IF NOT EXISTS emoji_asset_shortcode_trgm_idx
  ON emoji_asset USING gin (shortcode gin_trgm_ops)
  WHERE deleted_at IS NULL AND shortcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS emoji_asset_category_trgm_idx
  ON emoji_asset USING gin (category gin_trgm_ops)
  WHERE deleted_at IS NULL AND category IS NOT NULL;

CREATE INDEX IF NOT EXISTS emoji_asset_unicode_sequence_trgm_idx
  ON emoji_asset USING gin (unicode_sequence gin_trgm_ops)
  WHERE deleted_at IS NULL AND unicode_sequence IS NOT NULL;

CREATE INDEX IF NOT EXISTS emoji_asset_keywords_trgm_idx
  ON emoji_asset USING gin ((keywords::text) gin_trgm_ops)
  WHERE deleted_at IS NULL AND keywords IS NOT NULL;

DROP FUNCTION normalize_emoji_keywords_contract(jsonb);
DROP FUNCTION normalize_emoji_unicode_sequence_contract(text);

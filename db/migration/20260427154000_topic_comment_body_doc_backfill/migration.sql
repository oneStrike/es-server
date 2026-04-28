CREATE OR REPLACE FUNCTION __body_decode_html_entities(raw_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(
            replace(coalesce(raw_text, ''), '&nbsp;', ' '),
            '&amp;',
            '&'
          ),
          '&lt;',
          '<'
        ),
        '&gt;',
        '>'
      ),
      '&quot;',
      '"'
    ),
    '&apos;',
    ''''
  );
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_unescape_json_string(raw_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(
            replace(coalesce(raw_text, ''), E'\\n', E'\n'),
            E'\\r',
            E'\r'
          ),
          E'\\t',
          E'\t'
        ),
        E'\\"',
        '"'
      ),
      E'\\/',
      '/'
    ),
    E'\\\\',
    E'\\'
  );
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_normalize_rich_text_plain_text(raw_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT btrim(
    regexp_replace(
      __body_decode_html_entities(coalesce(raw_text, '')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_extract_plain_text_from_json_rich_text(raw_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT coalesce(
    string_agg(__body_unescape_json_string(match[1]), E'\n'),
    ''
  )
  FROM regexp_matches(
    coalesce(raw_text, ''),
    E'"(?:text|insert)"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"',
    'g'
  ) AS match;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_extract_plain_text_from_html_rich_text(raw_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT __body_normalize_rich_text_plain_text(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(raw_text, ''),
          E'<(?:br|hr)\\s*/?>',
          E'\n',
          'gi'
        ),
        E'</?(?:p|div|li|tr|blockquote|h[1-6])\\b[^>]*>',
        E'\n',
        'gi'
      ),
      E'<[^>]+>',
      '',
      'g'
    )
  );
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_extract_plain_text_from_legacy_content(raw_content text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  normalized_content text := btrim(coalesce(raw_content, ''));
  json_text text;
  html_text text;
BEGIN
  IF normalized_content = '' THEN
    RETURN '';
  END IF;

  IF left(normalized_content, 1) IN ('{', '[', '"') THEN
    json_text := __body_extract_plain_text_from_json_rich_text(normalized_content);
    IF json_text <> '' THEN
      RETURN __body_normalize_rich_text_plain_text(json_text);
    END IF;
  END IF;

  IF normalized_content ~ '[<&]' THEN
    html_text := __body_extract_plain_text_from_html_rich_text(normalized_content);
    IF html_text <> '' THEN
      RETURN html_text;
    END IF;
  END IF;

  RETURN __body_normalize_rich_text_plain_text(normalized_content);
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_create_inline_nodes_from_paragraph_text(paragraph_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  normalized_text text := coalesce(paragraph_text, '');
  lines text[];
  nodes jsonb := '[]'::jsonb;
  current_line text;
  line_count integer;
  line_index integer;
BEGIN
  IF normalized_text = '' THEN
    RETURN nodes;
  END IF;

  lines := regexp_split_to_array(normalized_text, E'\n');
  line_count := coalesce(array_length(lines, 1), 0);

  FOR line_index IN 1..line_count LOOP
    current_line := coalesce(lines[line_index], '');

    IF current_line <> '' THEN
      nodes := nodes || jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', current_line)
      );
    END IF;

    IF line_index < line_count THEN
      nodes := nodes || jsonb_build_array(
        jsonb_build_object('type', 'hardBreak')
      );
    END IF;
  END LOOP;

  RETURN nodes;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_create_doc_from_plain_text(raw_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  normalized_text text := regexp_replace(coalesce(raw_text, ''), E'\r\n?', E'\n', 'g');
  paragraphs text[];
  blocks jsonb := '[]'::jsonb;
  paragraph_text text;
BEGIN
  paragraphs := regexp_split_to_array(normalized_text, E'\n{2,}');

  FOREACH paragraph_text IN ARRAY paragraphs LOOP
    blocks := blocks || jsonb_build_array(
      jsonb_build_object(
        'type',
        'paragraph',
        'content',
        __body_create_inline_nodes_from_paragraph_text(paragraph_text)
      )
    );
  END LOOP;

  RETURN jsonb_build_object('type', 'doc', 'content', blocks);
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_create_legacy_wrapped_doc(raw_text text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT jsonb_build_object(
    'type',
    'doc',
    'content',
    jsonb_build_array(
      jsonb_build_object(
        'type',
        'paragraph',
        'content',
        jsonb_build_array(
          jsonb_build_object(
            'type',
            'text',
            'text',
            coalesce(raw_text, '')
          )
        )
      )
    )
  );
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_extract_segments_from_legacy_body_tokens(raw_body_tokens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  segments jsonb := '[]'::jsonb;
  raw_token jsonb;
  token_type text;
  nickname text;
  shortcode text;
  unicode_sequence text;
  text_value text;
BEGIN
  IF raw_body_tokens IS NULL OR jsonb_typeof(raw_body_tokens) <> 'array' THEN
    RETURN NULL;
  END IF;

  FOR raw_token IN
    SELECT value
    FROM jsonb_array_elements(raw_body_tokens)
  LOOP
    IF jsonb_typeof(raw_token) <> 'object' THEN
      CONTINUE;
    END IF;

    token_type := raw_token->>'type';

    CASE token_type
      WHEN 'text' THEN
        text_value := raw_token->>'text';
        IF text_value IS NOT NULL THEN
          segments := segments || jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', text_value)
          );
        END IF;
      WHEN 'mentionUser' THEN
        nickname := btrim(coalesce(raw_token->>'nickname', ''));
        IF (raw_token->>'userId') ~ '^\d+$' AND nickname <> '' THEN
          segments := segments || jsonb_build_array(
            jsonb_build_object(
              'type',
              'mentionUser',
              'userId',
              (raw_token->>'userId')::integer,
              'nickname',
              nickname
            )
          );
        END IF;
      WHEN 'emojiUnicode' THEN
        unicode_sequence := raw_token->>'unicodeSequence';
        IF coalesce(unicode_sequence, '') <> '' THEN
          segments := segments || jsonb_build_array(
            jsonb_build_object(
              'type',
              'emojiUnicode',
              'unicodeSequence',
              unicode_sequence
            )
          );
        END IF;
      WHEN 'emojiCustom' THEN
        shortcode := raw_token->>'shortcode';
        IF coalesce(shortcode, '') <> '' THEN
          segments := segments || jsonb_build_array(
            jsonb_build_object(
              'type',
              'emojiCustom',
              'shortcode',
              shortcode
            )
          );
        END IF;
      ELSE
        CONTINUE;
    END CASE;
  END LOOP;

  IF jsonb_array_length(segments) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN segments;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_extract_segments_from_content_and_mentions(
  raw_content text,
  raw_mentions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  normalized_content text := coalesce(raw_content, '');
  segments jsonb := '[]'::jsonb;
  cursor_offset integer := 0;
  mention_record record;
  mention_text text;
  nickname text;
BEGIN
  FOR mention_record IN
    SELECT
      (value->>'userId')::integer AS user_id,
      (value->>'start')::integer AS start_offset,
      (value->>'end')::integer AS end_offset
    FROM jsonb_array_elements(coalesce(raw_mentions, '[]'::jsonb)) AS value
    WHERE jsonb_typeof(value) = 'object'
      AND (value->>'userId') ~ '^\d+$'
      AND (value->>'start') ~ '^\d+$'
      AND (value->>'end') ~ '^\d+$'
      AND (value->>'start')::integer >= 0
      AND (value->>'end')::integer > (value->>'start')::integer
      AND (value->>'end')::integer <= char_length(normalized_content)
    ORDER BY start_offset, end_offset
  LOOP
    IF mention_record.start_offset > cursor_offset THEN
      segments := segments || jsonb_build_array(
        jsonb_build_object(
          'type',
          'text',
          'text',
          substring(
            normalized_content
            FROM cursor_offset + 1
            FOR mention_record.start_offset - cursor_offset
          )
        )
      );
    END IF;

    mention_text := substring(
      normalized_content
      FROM mention_record.start_offset + 1
      FOR mention_record.end_offset - mention_record.start_offset
    );
    nickname := btrim(
      CASE
        WHEN left(mention_text, 1) = '@' THEN substring(mention_text FROM 2)
        ELSE mention_text
      END
    );

    IF nickname <> '' THEN
      segments := segments || jsonb_build_array(
        jsonb_build_object(
          'type',
          'mentionUser',
          'userId',
          mention_record.user_id,
          'nickname',
          nickname
        )
      );
    ELSE
      segments := segments || jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', mention_text)
      );
    END IF;

    cursor_offset := mention_record.end_offset;
  END LOOP;

  IF cursor_offset < char_length(normalized_content) THEN
    segments := segments || jsonb_build_array(
      jsonb_build_object(
        'type',
        'text',
        'text',
        substring(normalized_content FROM cursor_offset + 1)
      )
    );
  END IF;

  RETURN segments;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_segments_to_plain_text(segments jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  plain_text text := '';
  segment jsonb;
  segment_type text;
BEGIN
  IF segments IS NULL OR jsonb_typeof(segments) <> 'array' THEN
    RETURN plain_text;
  END IF;

  FOR segment IN
    SELECT value
    FROM jsonb_array_elements(segments)
  LOOP
    IF jsonb_typeof(segment) <> 'object' THEN
      CONTINUE;
    END IF;

    segment_type := segment->>'type';

    CASE segment_type
      WHEN 'text' THEN
        plain_text := plain_text || coalesce(segment->>'text', '');
      WHEN 'mentionUser' THEN
        plain_text := plain_text || '@' || coalesce(segment->>'nickname', '');
      WHEN 'emojiUnicode' THEN
        plain_text := plain_text || coalesce(segment->>'unicodeSequence', '');
      WHEN 'emojiCustom' THEN
        plain_text := plain_text || ':' || coalesce(segment->>'shortcode', '') || ':';
      ELSE
        CONTINUE;
    END CASE;
  END LOOP;

  RETURN plain_text;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_create_doc_from_segments(segments jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  blocks jsonb := '[]'::jsonb;
  current_paragraph jsonb := '[]'::jsonb;
  segment jsonb;
  segment_type text;
  normalized_text text;
  lines text[];
  line_count integer;
  line_index integer;
  current_line text;
BEGIN
  FOR segment IN
    SELECT value
    FROM jsonb_array_elements(coalesce(segments, '[]'::jsonb))
  LOOP
    IF jsonb_typeof(segment) <> 'object' THEN
      CONTINUE;
    END IF;

    segment_type := segment->>'type';

    IF segment_type <> 'text' THEN
      current_paragraph := current_paragraph || jsonb_build_array(segment);
      CONTINUE;
    END IF;

    normalized_text := regexp_replace(coalesce(segment->>'text', ''), E'\r\n?', E'\n', 'g');
    lines := regexp_split_to_array(normalized_text, E'\n');
    line_count := coalesce(array_length(lines, 1), 0);
    line_index := 1;

    WHILE line_index <= line_count LOOP
      current_line := coalesce(lines[line_index], '');

      IF current_line <> '' THEN
        current_paragraph := current_paragraph || jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', current_line)
        );
      END IF;

      IF line_index < line_count THEN
        IF current_line = '' AND coalesce(lines[line_index + 1], '') = '' THEN
          blocks := blocks || jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'content', current_paragraph)
          );
          current_paragraph := '[]'::jsonb;

          WHILE line_index < line_count
            AND coalesce(lines[line_index + 1], '') = ''
          LOOP
            line_index := line_index + 1;
          END LOOP;
        ELSE
          current_paragraph := current_paragraph || jsonb_build_array(
            jsonb_build_object('type', 'hardBreak')
          );
        END IF;
      END IF;

      line_index := line_index + 1;
    END LOOP;
  END LOOP;

  IF jsonb_array_length(blocks) = 0 OR jsonb_array_length(current_paragraph) > 0 THEN
    blocks := blocks || jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', current_paragraph)
    );
  END IF;

  RETURN jsonb_build_object('type', 'doc', 'content', blocks);
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_minimal_body_tokens_from_plain_text(plain_text text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN coalesce(plain_text, '') = '' THEN NULL
    ELSE jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', plain_text)
    )
  END;
$fn$;
--> statement-breakpoint
WITH topic_mentions AS (
  SELECT
    "source_id",
    jsonb_agg(
      jsonb_build_object(
        'userId',
        "mentioned_user_id",
        'start',
        "start_offset",
        'end',
        "end_offset"
      )
      ORDER BY "start_offset", "end_offset"
    ) AS mentions
  FROM "user_mention"
  WHERE "source_type" = 2
  GROUP BY "source_id"
),
topic_backfill AS (
  SELECT
    topic."id",
    __body_extract_segments_from_legacy_body_tokens(topic."body_tokens") AS token_segments,
    CASE
      WHEN mention.mentions IS NULL THEN NULL
      ELSE __body_extract_segments_from_content_and_mentions(
        topic."content",
        mention.mentions
      )
    END AS mention_segments,
    __body_extract_plain_text_from_legacy_content(topic."content") AS fallback_plain_text
  FROM "forum_topic" AS topic
  LEFT JOIN topic_mentions AS mention
    ON mention."source_id" = topic."id"
)
UPDATE "forum_topic" AS topic
SET
  "body" = CASE
    WHEN backfill.token_segments IS NOT NULL THEN
      __body_create_doc_from_segments(backfill.token_segments)
    WHEN backfill.mention_segments IS NOT NULL THEN
      __body_create_doc_from_segments(backfill.mention_segments)
    ELSE
      __body_create_doc_from_plain_text(backfill.fallback_plain_text)
  END,
  "content" = CASE
    WHEN backfill.token_segments IS NOT NULL THEN
      __body_segments_to_plain_text(backfill.token_segments)
    WHEN backfill.mention_segments IS NOT NULL THEN
      __body_segments_to_plain_text(backfill.mention_segments)
    ELSE
      backfill.fallback_plain_text
  END,
  "body_tokens" = CASE
    WHEN backfill.token_segments IS NOT NULL THEN
      topic."body_tokens"
    WHEN backfill.mention_segments IS NOT NULL THEN
      nullif(backfill.mention_segments, '[]'::jsonb)
    ELSE
      __body_minimal_body_tokens_from_plain_text(backfill.fallback_plain_text)
  END,
  "body_version" = 1
FROM topic_backfill AS backfill
WHERE topic."id" = backfill."id"
  AND topic."body" = __body_create_legacy_wrapped_doc(topic."content");
--> statement-breakpoint
WITH comment_mentions AS (
  SELECT
    "source_id",
    jsonb_agg(
      jsonb_build_object(
        'userId',
        "mentioned_user_id",
        'start',
        "start_offset",
        'end',
        "end_offset"
      )
      ORDER BY "start_offset", "end_offset"
    ) AS mentions
  FROM "user_mention"
  WHERE "source_type" = 1
  GROUP BY "source_id"
),
comment_backfill AS (
  SELECT
    comment_row."id",
    __body_extract_segments_from_legacy_body_tokens(comment_row."body_tokens") AS token_segments,
    CASE
      WHEN mention.mentions IS NULL THEN NULL
      ELSE __body_extract_segments_from_content_and_mentions(
        comment_row."content",
        mention.mentions
      )
    END AS mention_segments,
    __body_extract_plain_text_from_legacy_content(comment_row."content") AS fallback_plain_text
  FROM "user_comment" AS comment_row
  LEFT JOIN comment_mentions AS mention
    ON mention."source_id" = comment_row."id"
)
UPDATE "user_comment" AS comment_row
SET
  "body" = CASE
    WHEN backfill.token_segments IS NOT NULL THEN
      __body_create_doc_from_segments(backfill.token_segments)
    WHEN backfill.mention_segments IS NOT NULL THEN
      __body_create_doc_from_segments(backfill.mention_segments)
    ELSE
      __body_create_doc_from_plain_text(backfill.fallback_plain_text)
  END,
  "content" = CASE
    WHEN backfill.token_segments IS NOT NULL THEN
      __body_segments_to_plain_text(backfill.token_segments)
    WHEN backfill.mention_segments IS NOT NULL THEN
      __body_segments_to_plain_text(backfill.mention_segments)
    ELSE
      backfill.fallback_plain_text
  END,
  "body_tokens" = CASE
    WHEN backfill.token_segments IS NOT NULL THEN
      comment_row."body_tokens"
    WHEN backfill.mention_segments IS NOT NULL THEN
      nullif(backfill.mention_segments, '[]'::jsonb)
    ELSE
      __body_minimal_body_tokens_from_plain_text(backfill.fallback_plain_text)
  END,
  "body_version" = 1
FROM comment_backfill AS backfill
WHERE comment_row."id" = backfill."id"
  AND comment_row."body" = __body_create_legacy_wrapped_doc(comment_row."content");
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_minimal_body_tokens_from_plain_text(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_create_doc_from_segments(jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_segments_to_plain_text(jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_extract_segments_from_content_and_mentions(text, jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_extract_segments_from_legacy_body_tokens(jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_create_legacy_wrapped_doc(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_create_doc_from_plain_text(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_create_inline_nodes_from_paragraph_text(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_extract_plain_text_from_legacy_content(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_extract_plain_text_from_html_rich_text(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_extract_plain_text_from_json_rich_text(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_normalize_rich_text_plain_text(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_unescape_json_string(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_decode_html_entities(text);

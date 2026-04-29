ALTER TABLE "forum_topic"
ADD COLUMN "html" text;
--> statement-breakpoint
ALTER TABLE "user_comment"
ADD COLUMN "html" text;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_escape_html_text(raw_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(coalesce(raw_text, ''), '&', '&amp;'),
          '<',
          '&lt;'
        ),
        '>',
        '&gt;'
      ),
      '"',
      '&quot;'
    ),
    '''',
    '&#39;'
  );
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_is_safe_link_href(raw_href text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  normalized_href text := btrim(coalesce(raw_href, ''));
  char_index integer;
  current_char text;
  current_code integer;
  protocol text;
BEGIN
  IF normalized_href = '' THEN
    RETURN false;
  END IF;

  FOR char_index IN 1..length(normalized_href)
  LOOP
    current_char := substr(normalized_href, char_index, 1);
    current_code := ascii(current_char);
    IF current_code <= 31 OR current_code = 127 OR current_char ~ '^[[:space:]]$' THEN
      RETURN false;
    END IF;
  END LOOP;

  IF left(normalized_href, 2) = '//' OR left(normalized_href, 1) = chr(92) THEN
    RETURN false;
  END IF;

  protocol := lower(substring(normalized_href from '^([A-Za-z][A-Za-z0-9+.-]*):'));
  IF protocol IS NOT NULL AND protocol NOT IN ('http', 'https', 'mailto') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_render_html_from_marks(raw_text text, raw_marks jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  rendered text := __body_escape_html_text(raw_text);
  raw_mark jsonb;
  mark_type text;
  href text;
BEGIN
  IF raw_marks IS NULL OR jsonb_typeof(raw_marks) <> 'array' THEN
    RETURN rendered;
  END IF;

  FOR raw_mark IN
    SELECT value
    FROM jsonb_array_elements(raw_marks)
  LOOP
    IF jsonb_typeof(raw_mark) <> 'object' THEN
      CONTINUE;
    END IF;

    mark_type := lower(coalesce(raw_mark->>'type', ''));

    IF mark_type = 'bold' THEN
      rendered := format('<strong>%s</strong>', rendered);
    ELSIF mark_type = 'italic' THEN
      rendered := format('<em>%s</em>', rendered);
    ELSIF mark_type = 'underline' THEN
      rendered := format('<u>%s</u>', rendered);
    ELSIF mark_type = 'link' THEN
      href := btrim(coalesce(raw_mark->>'href', ''));
      IF href <> '' AND __body_is_safe_link_href(href) THEN
        rendered := format(
          '<a href="%s">%s</a>',
          __body_escape_html_text(href),
          rendered
        );
      END IF;
    END IF;
  END LOOP;

  RETURN rendered;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_render_html_from_inline_nodes(raw_nodes jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  rendered text := '';
  raw_node jsonb;
  node_type text;
  nickname text;
  shortcode text;
  unicode_sequence text;
  hashtag_id text;
  slug text;
  display_name text;
BEGIN
  IF raw_nodes IS NULL OR jsonb_typeof(raw_nodes) <> 'array' THEN
    RETURN '';
  END IF;

  FOR raw_node IN
    SELECT value
    FROM jsonb_array_elements(raw_nodes)
  LOOP
    IF jsonb_typeof(raw_node) <> 'object' THEN
      CONTINUE;
    END IF;

    node_type := lower(coalesce(raw_node->>'type', ''));

    IF node_type = 'text' THEN
      rendered := rendered || __body_render_html_from_marks(
        coalesce(raw_node->>'text', ''),
        raw_node->'marks'
      );
    ELSIF node_type = 'hardbreak' THEN
      rendered := rendered || '<br />';
    ELSIF node_type = 'mentionuser' THEN
      nickname := btrim(coalesce(raw_node->>'nickname', ''));
      rendered := rendered || format(
        '<span data-node="mention" data-user-id="%s" data-nickname="%s">@%s</span>',
        coalesce(raw_node->>'userId', ''),
        __body_escape_html_text(nickname),
        __body_escape_html_text(nickname)
      );
    ELSIF node_type = 'emojiunicode' THEN
      unicode_sequence := coalesce(raw_node->>'unicodeSequence', '');
      rendered := rendered || format(
        '<span data-node="emoji" data-unicode-sequence="%s">%s</span>',
        __body_escape_html_text(unicode_sequence),
        __body_escape_html_text(unicode_sequence)
      );
    ELSIF node_type = 'emojicustom' THEN
      shortcode := btrim(coalesce(raw_node->>'shortcode', ''));
      rendered := rendered || format(
        '<img data-node="emoji" data-shortcode="%s" alt=":%s:" />',
        __body_escape_html_text(shortcode),
        __body_escape_html_text(shortcode)
      );
    ELSIF node_type = 'forumhashtag' THEN
      hashtag_id := coalesce(raw_node->>'hashtagId', '');
      slug := btrim(coalesce(raw_node->>'slug', ''));
      display_name := btrim(coalesce(raw_node->>'displayName', ''));
      rendered := rendered || format(
        '<span data-node="hashtag" data-hashtag-id="%s" data-slug="%s">#%s</span>',
        hashtag_id,
        __body_escape_html_text(slug),
        __body_escape_html_text(display_name)
      );
    END IF;
  END LOOP;

  RETURN rendered;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_render_html_from_list_items(raw_items jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  rendered text := '';
  raw_item jsonb;
BEGIN
  IF raw_items IS NULL OR jsonb_typeof(raw_items) <> 'array' THEN
    RETURN '';
  END IF;

  FOR raw_item IN
    SELECT value
    FROM jsonb_array_elements(raw_items)
  LOOP
    IF jsonb_typeof(raw_item) <> 'object' THEN
      CONTINUE;
    END IF;

    IF lower(coalesce(raw_item->>'type', '')) <> 'listitem' THEN
      CONTINUE;
    END IF;

    rendered := rendered || format(
      '<li>%s</li>',
      __body_render_html_from_inline_nodes(raw_item->'content')
    );
  END LOOP;

  RETURN rendered;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_render_html_from_doc(raw_body jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  rendered text := '';
  raw_block jsonb;
  block_type text;
  heading_level text;
BEGIN
  IF raw_body IS NULL OR jsonb_typeof(raw_body) <> 'object' THEN
    RETURN '<p></p>';
  END IF;

  IF jsonb_typeof(raw_body->'content') <> 'array' THEN
    RETURN '<p></p>';
  END IF;

  FOR raw_block IN
    SELECT value
    FROM jsonb_array_elements(raw_body->'content')
  LOOP
    IF jsonb_typeof(raw_block) <> 'object' THEN
      CONTINUE;
    END IF;

    block_type := lower(coalesce(raw_block->>'type', ''));

    IF block_type = 'paragraph' THEN
      rendered := rendered || format(
        '<p>%s</p>',
        __body_render_html_from_inline_nodes(raw_block->'content')
      );
    ELSIF block_type = 'heading' THEN
      heading_level := coalesce(raw_block->>'level', '1');
      rendered := rendered || format(
        '<h%s>%s</h%s>',
        heading_level,
        __body_render_html_from_inline_nodes(raw_block->'content'),
        heading_level
      );
    ELSIF block_type = 'blockquote' THEN
      rendered := rendered || format(
        '<blockquote>%s</blockquote>',
        __body_render_html_from_inline_nodes(raw_block->'content')
      );
    ELSIF block_type = 'bulletlist' THEN
      rendered := rendered || format(
        '<ul>%s</ul>',
        __body_render_html_from_list_items(raw_block->'content')
      );
    ELSIF block_type = 'orderedlist' THEN
      rendered := rendered || format(
        '<ol>%s</ol>',
        __body_render_html_from_list_items(raw_block->'content')
      );
    ELSIF block_type = 'listitem' THEN
      rendered := rendered || format(
        '<li>%s</li>',
        __body_render_html_from_inline_nodes(raw_block->'content')
      );
    END IF;
  END LOOP;

  RETURN CASE
    WHEN rendered = '' THEN '<p></p>'
    ELSE rendered
  END;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_hex_entity_to_codepoint(raw_hex text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  result integer := 0;
  index integer;
  digit text;
  value integer;
BEGIN
  IF raw_hex IS NULL OR raw_hex = '' THEN
    RETURN NULL;
  END IF;
  IF length(raw_hex) > 6 THEN
    RETURN NULL;
  END IF;

  FOR index IN 1..length(raw_hex)
  LOOP
    digit := lower(substr(raw_hex, index, 1));
    value := strpos('0123456789abcdef', digit) - 1;
    IF value < 0 THEN
      RETURN NULL;
    END IF;
    result := result * 16 + value;
  END LOOP;

  RETURN result;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_decode_html_entities(raw_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  decoded text := coalesce(raw_text, '');
  entity_match text[];
  entity_value text;
  codepoint integer;
BEGIN
  decoded := regexp_replace(decoded, '&nbsp;', ' ', 'gi');
  decoded := regexp_replace(decoded, '&lt;', '<', 'gi');
  decoded := regexp_replace(decoded, '&gt;', '>', 'gi');
  decoded := regexp_replace(decoded, '&quot;', '"', 'gi');
  decoded := regexp_replace(decoded, '&#39;|&apos;', '''', 'gi');

  LOOP
    entity_match := regexp_match(decoded, '&#([0-9]+);');
    EXIT WHEN entity_match IS NULL;
    entity_value := '&#' || entity_match[1] || ';';
    IF length(entity_match[1]) > 7 THEN
      decoded := replace(decoded, entity_value, '');
      CONTINUE;
    END IF;
    codepoint := entity_match[1]::integer;
    IF codepoint BETWEEN 1 AND 1114111 AND codepoint NOT BETWEEN 55296 AND 57343 THEN
      decoded := replace(decoded, entity_value, chr(codepoint));
    ELSE
      decoded := replace(decoded, entity_value, '');
    END IF;
  END LOOP;

  LOOP
    entity_match := regexp_match(decoded, '&#x([0-9a-f]+);', 'i');
    EXIT WHEN entity_match IS NULL;
    entity_value := '&#x' || entity_match[1] || ';';
    codepoint := __body_hex_entity_to_codepoint(entity_match[1]);
    IF codepoint BETWEEN 1 AND 1114111 AND codepoint NOT BETWEEN 55296 AND 57343 THEN
      decoded := regexp_replace(decoded, entity_value, chr(codepoint), 'i');
    ELSE
      decoded := regexp_replace(decoded, entity_value, '', 'i');
    END IF;
  END LOOP;

  decoded := regexp_replace(decoded, '&amp;', '&', 'gi');

  RETURN decoded;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION __body_extract_plain_text_from_html_content(raw_html text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT trim(
    regexp_replace(
      __body_decode_html_entities(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(raw_html, ''), '<(?:br|hr)\s*/?>', E'\n', 'gi'),
            '</?(?:p|div|li|tr|blockquote|h[1-6]|ul|ol)\b[^>]*>',
            E'\n',
            'gi'
          ),
          '<[^>]+>',
          '',
          'g'
        )
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$fn$;
--> statement-breakpoint
UPDATE "forum_topic" AS topic
SET
  "html" = __body_render_html_from_doc(topic."body"),
  "content" = __body_extract_plain_text_from_html_content(
    __body_render_html_from_doc(topic."body")
  )
WHERE topic."html" IS NULL;
--> statement-breakpoint
UPDATE "user_comment" AS comment_row
SET
  "html" = __body_render_html_from_doc(comment_row."body"),
  "content" = __body_extract_plain_text_from_html_content(
    __body_render_html_from_doc(comment_row."body")
  )
WHERE comment_row."html" IS NULL;
--> statement-breakpoint
ALTER TABLE "forum_topic"
ALTER COLUMN "html" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_comment"
ALTER COLUMN "html" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "forum_topic"
DROP COLUMN "body_tokens";
--> statement-breakpoint
ALTER TABLE "user_comment"
DROP COLUMN "body_tokens";
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_extract_plain_text_from_html_content(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_decode_html_entities(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_hex_entity_to_codepoint(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_render_html_from_doc(jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_render_html_from_list_items(jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_render_html_from_inline_nodes(jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_render_html_from_marks(text, jsonb);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_is_safe_link_href(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS __body_escape_html_text(text);

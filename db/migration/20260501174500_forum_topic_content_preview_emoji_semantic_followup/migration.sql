CREATE OR REPLACE FUNCTION "__forum_topic_append_content_preview_segment"(
  preview jsonb,
  next_segment jsonb,
  preview_max_length integer,
  preview_max_segments integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  plain_text text := COALESCE(preview->>'plainText', '');
  segments jsonb := COALESCE(preview->'segments', '[]'::jsonb);
  segment_text text := COALESCE(next_segment->>'text', '');
  remaining_length integer;
  clipped_text text;
  output_segment jsonb;
  last_segment_index integer;
  last_segment_text text;
BEGIN
  IF next_segment IS NULL
    OR segment_text = ''
    OR char_length(plain_text) >= preview_max_length
    OR jsonb_array_length(segments) >= preview_max_segments THEN
    RETURN jsonb_build_object('plainText', plain_text, 'segments', segments);
  END IF;

  remaining_length := preview_max_length - char_length(plain_text);
  clipped_text := left(segment_text, remaining_length);

  IF clipped_text = '' THEN
    RETURN jsonb_build_object('plainText', plain_text, 'segments', segments);
  END IF;

  IF char_length(clipped_text) = char_length(segment_text) THEN
    output_segment := next_segment;
  ELSE
    output_segment := jsonb_build_object(
      'type',
      'text',
      'text',
      clipped_text
    );
  END IF;

  IF output_segment->>'type' = 'text'
    AND jsonb_array_length(segments) > 0
    AND segments->(jsonb_array_length(segments) - 1)->>'type' = 'text' THEN
    last_segment_index := jsonb_array_length(segments) - 1;
    last_segment_text := COALESCE(segments->last_segment_index->>'text', '');
    segments := jsonb_set(
      segments,
      ARRAY[last_segment_index::text, 'text'],
      to_jsonb(last_segment_text || clipped_text),
      false
    );
  ELSE
    segments := segments || jsonb_build_array(output_segment);
  END IF;

  RETURN jsonb_build_object(
    'plainText',
    plain_text || clipped_text,
    'segments',
    segments
  );
END;
$$;

CREATE OR REPLACE FUNCTION "__forum_topic_preview_segment_from_inline"(
  node jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  node_type text := COALESCE(node->>'type', '');
  node_text text;
  node_user_id text;
  node_hashtag_id text;
BEGIN
  CASE node_type
    WHEN 'text' THEN
      node_text := COALESCE(node->>'text', '');
      IF node_text = '' THEN
        RETURN NULL;
      END IF;
      RETURN jsonb_build_object('type', 'text', 'text', node_text);
    WHEN 'hardBreak' THEN
      RETURN jsonb_build_object('type', 'text', 'text', E'\n');
    WHEN 'mentionUser' THEN
      node_text := trim(COALESCE(node->>'nickname', ''));
      node_user_id := COALESCE(node->>'userId', '');
      IF node_text = '' OR node_user_id !~ '^[0-9]+$' THEN
        RETURN NULL;
      END IF;
      RETURN jsonb_build_object(
        'type',
        'mention',
        'text',
        '@' || node_text,
        'userId',
        node_user_id::integer,
        'nickname',
        node_text
      );
    WHEN 'emojiUnicode' THEN
      node_text := COALESCE(node->>'unicodeSequence', '');
      IF node_text = '' THEN
        RETURN NULL;
      END IF;
      RETURN jsonb_build_object(
        'type',
        'emoji',
        'text',
        node_text,
        'kind',
        1,
        'unicodeSequence',
        node_text
      );
    WHEN 'emojiCustom' THEN
      node_text := COALESCE(node->>'shortcode', '');
      IF node_text = '' THEN
        RETURN NULL;
      END IF;
      RETURN jsonb_build_object(
        'type',
        'emoji',
        'text',
        ':' || node_text || ':',
        'kind',
        2,
        'shortcode',
        node_text
      );
    WHEN 'forumHashtag' THEN
      node_text := trim(COALESCE(node->>'displayName', ''));
      node_hashtag_id := COALESCE(node->>'hashtagId', '');
      IF node_text = '' OR node_hashtag_id !~ '^[0-9]+$' THEN
        RETURN NULL;
      END IF;
      RETURN jsonb_build_object(
        'type',
        'hashtag',
        'text',
        '#' || node_text,
        'hashtagId',
        node_hashtag_id::integer,
        'slug',
        COALESCE(node->>'slug', ''),
        'displayName',
        node_text
      );
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION "__forum_topic_build_content_preview"(
  raw_body jsonb,
  fallback_content text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  preview jsonb := jsonb_build_object('plainText', '', 'segments', '[]'::jsonb);
  preview_max_length integer := 60;
  preview_max_segments integer := 30;
  root_content jsonb;
  block jsonb;
  block_index integer := 0;
  block_type text;
  block_content jsonb;
  node jsonb;
  item jsonb;
  item_content jsonb;
  item_index integer;
  fallback_text text;
BEGIN
  root_content := CASE
    WHEN jsonb_typeof(raw_body->'content') = 'array' THEN raw_body->'content'
    ELSE '[]'::jsonb
  END;

  FOR block IN SELECT value FROM jsonb_array_elements(root_content)
  LOOP
    IF char_length(COALESCE(preview->>'plainText', '')) >= preview_max_length
      OR jsonb_array_length(COALESCE(preview->'segments', '[]'::jsonb)) >= preview_max_segments THEN
      EXIT;
    END IF;

    IF block_index > 0 THEN
      preview := "__forum_topic_append_content_preview_segment"(
        preview,
        jsonb_build_object('type', 'text', 'text', E'\n\n'),
        preview_max_length,
        preview_max_segments
      );
    END IF;

    block_type := COALESCE(block->>'type', '');

    IF block_type IN ('paragraph', 'heading', 'blockquote', 'listItem') THEN
      block_content := CASE
        WHEN jsonb_typeof(block->'content') = 'array' THEN block->'content'
        ELSE '[]'::jsonb
      END;

      FOR node IN SELECT value FROM jsonb_array_elements(block_content)
      LOOP
        preview := "__forum_topic_append_content_preview_segment"(
          preview,
          "__forum_topic_preview_segment_from_inline"(node),
          preview_max_length,
          preview_max_segments
        );
      END LOOP;
    ELSIF block_type IN ('bulletList', 'orderedList') THEN
      block_content := CASE
        WHEN jsonb_typeof(block->'content') = 'array' THEN block->'content'
        ELSE '[]'::jsonb
      END;
      item_index := 0;

      FOR item IN SELECT value FROM jsonb_array_elements(block_content)
      LOOP
        IF item_index > 0 THEN
          preview := "__forum_topic_append_content_preview_segment"(
            preview,
            jsonb_build_object('type', 'text', 'text', E'\n'),
            preview_max_length,
            preview_max_segments
          );
        END IF;

        item_content := CASE
          WHEN jsonb_typeof(item->'content') = 'array' THEN item->'content'
          ELSE '[]'::jsonb
        END;

        FOR node IN SELECT value FROM jsonb_array_elements(item_content)
        LOOP
          preview := "__forum_topic_append_content_preview_segment"(
            preview,
            "__forum_topic_preview_segment_from_inline"(node),
            preview_max_length,
            preview_max_segments
          );
        END LOOP;

        item_index := item_index + 1;
      END LOOP;
    END IF;

    block_index := block_index + 1;
  END LOOP;

  fallback_text := left(trim(COALESCE(fallback_content, '')), preview_max_length);
  IF COALESCE(preview->>'plainText', '') = '' AND fallback_text <> '' THEN
    preview := "__forum_topic_append_content_preview_segment"(
      preview,
      jsonb_build_object('type', 'text', 'text', fallback_text),
      preview_max_length,
      preview_max_segments
    );
  END IF;

  RETURN preview;
END;
$$;

UPDATE "forum_topic" AS topic
SET "content_preview" = "__forum_topic_build_content_preview"(
  topic."body",
  topic."content"
);

DROP FUNCTION IF EXISTS "__forum_topic_build_content_preview"(jsonb, text);
DROP FUNCTION IF EXISTS "__forum_topic_preview_segment_from_inline"(jsonb);
DROP FUNCTION IF EXISTS "__forum_topic_append_content_preview_segment"(jsonb, jsonb, integer, integer);

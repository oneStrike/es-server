ALTER TABLE "app_update_release"
ADD COLUMN "store_links" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "app_update_release" AS release
SET "store_links" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'channelCode',
        link."channel_code",
        'storeUrl',
        link."store_url"
      )
      ORDER BY
        CASE
          WHEN link."channel_code" = 'default' THEN 0
          ELSE 1
        END,
        link."channel_code",
        link."id"
    )
    FROM "app_update_store_link" AS link
    WHERE link."release_id" = release."id"
  ),
  '[]'::jsonb
);

DROP TABLE IF EXISTS "app_update_store_link";

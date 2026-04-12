CREATE TABLE "user_mention" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "source_type" smallint NOT NULL,
  "source_id" integer NOT NULL,
  "mentioned_user_id" integer NOT NULL,
  "start_offset" integer NOT NULL,
  "end_offset" integer NOT NULL,
  "notified_at" timestamp (6) with time zone,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL
);

CREATE UNIQUE INDEX "user_mention_source_user_offset_key"
ON "user_mention" (
  "source_type",
  "source_id",
  "mentioned_user_id",
  "start_offset",
  "end_offset"
);

CREATE INDEX "user_mention_source_idx"
ON "user_mention" ("source_type", "source_id");

CREATE INDEX "user_mention_receiver_created_at_idx"
ON "user_mention" ("mentioned_user_id", "created_at");

CREATE INDEX "user_mention_notified_at_idx"
ON "user_mention" ("notified_at");

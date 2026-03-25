ALTER TABLE "forum_topic"
  ADD COLUMN "images" varchar(500)[] DEFAULT ARRAY[]::varchar[] NOT NULL,
  ADD COLUMN "videos" varchar(500)[] DEFAULT ARRAY[]::varchar[] NOT NULL;

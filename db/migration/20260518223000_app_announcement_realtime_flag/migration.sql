ALTER TABLE "app_announcement"
  ADD COLUMN "is_realtime" boolean DEFAULT false NOT NULL;

CREATE INDEX "app_announcement_is_realtime_is_published_idx"
  ON "app_announcement" ("is_realtime", "is_published");

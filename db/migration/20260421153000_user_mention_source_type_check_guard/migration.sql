ALTER TABLE "user_mention"
  ADD CONSTRAINT "user_mention_source_type_valid_chk"
  CHECK ("source_type" in (1, 2));

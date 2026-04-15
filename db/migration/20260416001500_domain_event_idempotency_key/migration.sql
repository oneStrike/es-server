ALTER TABLE "domain_event"
  ADD COLUMN "idempotency_key" varchar(180);

ALTER TABLE "domain_event"
  ADD CONSTRAINT "domain_event_domain_idempotency_key_key"
  UNIQUE ("domain", "idempotency_key");

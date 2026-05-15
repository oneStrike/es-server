ALTER TABLE "app_user" ADD COLUMN "last_login_geo_country" varchar(100);--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "last_login_geo_province" varchar(100);--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "last_login_geo_city" varchar(100);--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "last_login_geo_isp" varchar(100);

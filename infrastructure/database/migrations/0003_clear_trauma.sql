ALTER TABLE "events" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "data_classification" "data_classification";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "evidence_ref" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "provider_event_id" text;
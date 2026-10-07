DO $$ BEGIN
 CREATE TYPE "public"."actor_type" AS ENUM('USER', 'AGENT', 'SYSTEM', 'CONNECTOR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."alert_severity" AS ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."approval_level" AS ENUM('A', 'B', 'C', 'D');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'AUTO_APPROVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."audit_result" AS ENUM('SUCCESS', 'FAILURE', 'PARTIAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."channel" AS ENUM('email', 'sms', 'voice', 'voicemail', 'website_chat', 'social', 'internal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."customer_status" AS ENUM('LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED', 'BLOCKED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."data_classification" AS ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'SECRET');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."deployment_environment" AS ENUM('local', 'dev', 'preview', 'staging', 'production');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."deployment_status" AS ENUM('PENDING', 'BUILDING', 'PREVIEW_READY', 'APPROVED', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'ROLLED_BACK');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."knowledge_status" AS ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."knowledge_type" AS ENUM('POLICY', 'SOP', 'BUSINESS_FACT', 'SERVICE', 'PRICING', 'CUSTOMER_PATTERN', 'MARKETING_INSIGHT', 'GOVCON_INTELLIGENCE', 'TECHNICAL', 'LEGAL_BOUNDARY', 'OWNER_DECISION', 'BRAND_RULE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."message_direction" AS ENUM('INBOUND', 'OUTBOUND');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."veteran_filing_state" AS ENUM('LEAD', 'ELIGIBILITY_REVIEW', 'ELIGIBLE', 'VVL_VERIFICATION', 'INTAKE_PENDING', 'INTAKE_COMPLETE', 'DOCUMENT_COLLECTION', 'FILING_PREPARATION', 'INTERNAL_REVIEW', 'CUSTOMER_APPROVAL', 'READY_TO_FILE', 'SUBMITTED', 'STATE_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED', 'RESUBMITTED', 'DOCUMENT_DELIVERY', 'FORMATION_COMPLETE', 'POST_FORMATION', 'BUSINESS_LAUNCH', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."assignment_status" AS ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."consent_state" AS ENUM('GRANTED', 'REVOKED', 'UNKNOWN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."contact_point_kind" AS ENUM('email', 'phone', 'social', 'postal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."exception_reason" AS ENUM('TENANT_BINDING_UNRESOLVED', 'POLICY_DENIED', 'APPROVAL_REQUIRED', 'APPROVAL_REJECTED', 'PROVIDER_FAILURE', 'PROVIDER_TIMEOUT', 'EVIDENCE_MISSING', 'SIGNATURE_INVALID', 'CREDENTIAL_REVOKED', 'RESTRICTED_DATA_BLOCKED', 'UNSUPPORTED_REQUEST', 'AGENT_ERROR', 'SLA_BREACHED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."exception_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DEAD_LETTER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scan_status" AS ENUM('PENDING', 'CLEAN', 'INFECTED', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scheduled_action_status" AS ENUM('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."service_lane" AS ENUM('free_filing', 'contact_consultation', 'membership', 'filing_tracking', 'registered_agent_compliance', 'launch_services', 'govcon', 'research_marketing', 'website_signal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sla_status" AS ENUM('ACTIVE', 'SATISFIED', 'BREACHED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"triggered_by" text,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"correlation_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"entity_type" text,
	"entity_id" uuid,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by_user_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"level" "approval_level" NOT NULL,
	"requested_by_user_id" uuid,
	"requested_by_agent_id" text,
	"approved_by_user_id" uuid,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"correlation_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"action_type" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"result" "audit_result" NOT NULL,
	"error_message" text,
	"correlation_id" text,
	"causation_id" text,
	"source" text,
	"ip_address" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "autopilot_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"title" text NOT NULL,
	"agent_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"thread_id" uuid,
	"signal_id" text,
	"due_at" timestamp with time zone NOT NULL,
	"escalated_at" timestamp with time zone,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"audience_id" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"budget" real,
	"owned_by_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_state_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_id" uuid NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"actor_id" uuid,
	"actor_type" "actor_type",
	"notes" text,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"veteran_filing_state" "veteran_filing_state",
	"assigned_to_user_id" uuid,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"due_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"person_id" uuid,
	"channel" "channel" NOT NULL,
	"subject" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"assigned_to_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"organization_id" uuid,
	"status" "customer_status" DEFAULT 'LEAD' NOT NULL,
	"customer_class" text NOT NULL,
	"owned_by_user_id" uuid,
	"source" text,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deployments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"environment" "deployment_environment" NOT NULL,
	"version" text NOT NULL,
	"git_ref" text,
	"git_sha" text,
	"status" "deployment_status" DEFAULT 'PENDING' NOT NULL,
	"deployed_by_user_id" uuid,
	"approval_id" uuid,
	"url" text,
	"error" text,
	"deployed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"case_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"classification" "data_classification" DEFAULT 'CONFIDENTIAL' NOT NULL,
	"storage_ref" text NOT NULL,
	"mime_type" text,
	"uploaded_by_person_id" uuid,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"suppressed" boolean DEFAULT false NOT NULL,
	"suppressed_reason" text,
	"last_acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid,
	"kind" text NOT NULL,
	"to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"in_reply_to" text,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_id" uuid,
	"status" text NOT NULL,
	"generated_by" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"kind" text,
	"from_address" text NOT NULL,
	"to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text NOT NULL,
	"text_redacted" text NOT NULL,
	"internet_message_id" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_messages_internet_message_id_unique" UNIQUE("internet_message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_name" text,
	"subject" text NOT NULL,
	"subject_key" text NOT NULL,
	"intent" text NOT NULL,
	"sensitivity" "data_classification" DEFAULT 'INTERNAL' NOT NULL,
	"status" text DEFAULT 'awaiting_team' NOT NULL,
	"source" text NOT NULL,
	"signal_id" text,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"follow_ups_sent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_threads_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"business_id" text DEFAULT 'hutchrok-solutions-group' NOT NULL,
	"source" text NOT NULL,
	"actor" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_level" "risk_level" DEFAULT 'LOW' NOT NULL,
	"schema_version" text DEFAULT '1.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "government_opportunities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"solicitation_number" text,
	"agency" text NOT NULL,
	"naics_code" text,
	"set_aside" text,
	"estimated_value" real,
	"response_deadline" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"source_url" text,
	"status" text DEFAULT 'IDENTIFIED' NOT NULL,
	"score" real,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_order_id" uuid,
	"stripe_invoice_id" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"amount_due" real NOT NULL,
	"amount_paid" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "knowledge_type" NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source" text,
	"source_event" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"effective_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes" uuid,
	"status" "knowledge_status" DEFAULT 'DRAFT' NOT NULL,
	"approved_by_user_id" uuid,
	"division" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding_ref" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_candidates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_event_id" text,
	"source_type" text NOT NULL,
	"suggested_knowledge_type" "knowledge_type",
	"title" text NOT NULL,
	"content" text NOT NULL,
	"confidence" real NOT NULL,
	"contradicts" uuid,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sender_person_id" uuid,
	"sender_label" text,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_message_id" text,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text NOT NULL,
	"title" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"entity_type" text,
	"state_of_formation" text,
	"ein_encrypted" text,
	"website" text,
	"phone" text,
	"email" text,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"classification" "data_classification" DEFAULT 'INTERNAL' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid NOT NULL,
	"stripe_payment_intent_id" text,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"failure_reason" text,
	"refunded_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"is_veteran" boolean DEFAULT false NOT NULL,
	"veteran_verified" boolean DEFAULT false NOT NULL,
	"classification" "data_classification" DEFAULT 'INTERNAL' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_signals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"signal_id" text NOT NULL,
	"signal_type" text NOT NULL,
	"source" text DEFAULT 'hutchrok.com' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"entity_ref" text,
	"event_id" uuid,
	"correlation_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_signals_signal_id_unique" UNIQUE("signal_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"session_id" text,
	"person_id" uuid,
	"page" text,
	"referrer" text,
	"ip" text,
	"user_agent" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"objective" text NOT NULL,
	"triggering_event_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"controller" text NOT NULL,
	"lane" "service_lane" NOT NULL,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classification" "data_classification" DEFAULT 'INTERNAL' NOT NULL,
	"credential_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_level" "approval_level" DEFAULT 'A' NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sla_id" uuid,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_required" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"handoff_target" text,
	"retry_policy" jsonb DEFAULT '{"maxAttempts":3,"backoffMs":30000}'::jsonb NOT NULL,
	"exception_owner" text NOT NULL,
	"status" "assignment_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"correlation_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachment_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"storage_ref" text NOT NULL,
	"sha256" text NOT NULL,
	"classification" "data_classification" DEFAULT 'CONFIDENTIAL' NOT NULL,
	"scan_status" "scan_status" DEFAULT 'PENDING' NOT NULL,
	"activity_event_id" uuid,
	"message_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"contact_point_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"state" "consent_state" DEFAULT 'UNKNOWN' NOT NULL,
	"basis" text,
	"captured_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"evidence_ref" text,
	"revoked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_points" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"kind" "contact_point_kind" NOT NULL,
	"value" text NOT NULL,
	"person_id" uuid,
	"customer_id" uuid,
	"verified" boolean DEFAULT false NOT NULL,
	"classification" "data_classification" DEFAULT 'INTERNAL' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credential_bindings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"provider" text NOT NULL,
	"secret_ref" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"environment" "deployment_environment" NOT NULL,
	"account_ref" text,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"classification" "data_classification" DEFAULT 'SECRET' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exception_queue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"reason" "exception_reason" NOT NULL,
	"severity" "risk_level" DEFAULT 'MEDIUM' NOT NULL,
	"summary" text NOT NULL,
	"detail" text,
	"assignment_id" uuid,
	"activity_event_id" uuid,
	"owner_role" text NOT NULL,
	"status" "exception_status" DEFAULT 'OPEN' NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"correlation_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_event_receipts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"replay_count" integer DEFAULT 0 NOT NULL,
	"activity_event_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"kind" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "scheduled_action_status" DEFAULT 'PENDING' NOT NULL,
	"locked_until" timestamp with time zone,
	"locked_by" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"assignment_id" uuid,
	"idempotency_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sla_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" text NOT NULL,
	"assignment_id" uuid NOT NULL,
	"lane" "service_lane" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"satisfied_at" timestamp with time zone,
	"breached_at" timestamp with time zone,
	"status" "sla_status" DEFAULT 'ACTIVE' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "autopilot_tasks" ADD CONSTRAINT "autopilot_tasks_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_state_history" ADD CONSTRAINT "case_state_history_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cases" ADD CONSTRAINT "cases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_person_id_persons_id_fk" FOREIGN KEY ("uploaded_by_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_candidates" ADD CONSTRAINT "learning_candidates_contradicts_knowledge_items_id_fk" FOREIGN KEY ("contradicts") REFERENCES "public"."knowledge_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_person_id_persons_id_fk" FOREIGN KEY ("sender_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "website_events" ADD CONSTRAINT "website_events_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachment_evidence" ADD CONSTRAINT "attachment_evidence_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_contact_point_id_contact_points_id_fk" FOREIGN KEY ("contact_point_id") REFERENCES "public"."contact_points"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_points" ADD CONSTRAINT "contact_points_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_points" ADD CONSTRAINT "contact_points_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exception_queue" ADD CONSTRAINT "exception_queue_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_actions" ADD CONSTRAINT "scheduled_actions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_records" ADD CONSTRAINT "sla_records_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_tenant_status_idx" ON "assignments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_lane_idx" ON "assignments" USING btree ("lane","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_agent_idx" ON "assignments" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_correlation_idx" ON "assignments" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachment_evidence_hash_idx" ON "attachment_evidence" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachment_evidence_scan_idx" ON "attachment_evidence" USING btree ("scan_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consent_records_point_channel_uq" ON "consent_records" USING btree ("contact_point_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_points_tenant_kind_value_uq" ON "contact_points" USING btree ("tenant_id","kind","value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_points_person_idx" ON "contact_points" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credential_bindings_scope_uq" ON "credential_bindings" USING btree ("tenant_id","provider","environment");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exception_queue_open_idx" ON "exception_queue" USING btree ("status","severity","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exception_queue_owner_idx" ON "exception_queue" USING btree ("owner_role","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exception_queue_tenant_idx" ON "exception_queue" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_event_receipts_provider_event_uq" ON "provider_event_receipts" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_event_receipts_idempotency_uq" ON "provider_event_receipts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_event_receipts_tenant_idx" ON "provider_event_receipts" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_actions_tenant_idempotency_uq" ON "scheduled_actions" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_actions_due_idx" ON "scheduled_actions" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_actions_kind_idx" ON "scheduled_actions" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sla_records_active_idx" ON "sla_records" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sla_records_assignment_idx" ON "sla_records" USING btree ("assignment_id");
CREATE TYPE "public"."conversion_status" AS ENUM('pending', 'processing', 'review', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('free', 'pro', 'canceled', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."template_category" AS ENUM('finance', 'inventory', 'hr', 'general');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TABLE "anonymous_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"usage_date" date NOT NULL,
	"conversion_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"anonymous_id" varchar(64),
	"ip_address" varchar(45),
	"original_filename" varchar(255) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"file_hash" varchar(64),
	"page_count" integer,
	"status" "conversion_status" DEFAULT 'pending' NOT NULL,
	"extracted_tables" json,
	"table_count" integer,
	"row_count" integer,
	"processing_time_ms" integer,
	"ai_confidence_score" numeric(3, 2),
	"ai_warnings" json,
	"detected_issues" json,
	"error_code" varchar(64),
	"error_message" text,
	"error_details" json,
	"pdf_storage_path" text,
	"xlsx_storage_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"category" "template_category",
	"column_definitions" json NOT NULL,
	"sample_data" json,
	"formatting" json,
	"icon" varchar(64),
	"color" varchar(20),
	"is_premium" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"email" varchar(320),
	"name" text,
	"avatar_url" text,
	"login_method" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_price_id" varchar(255),
	"subscription_status" "subscription_status" DEFAULT 'free' NOT NULL,
	"current_period_end" timestamp,
	"conversions_today" integer DEFAULT 0 NOT NULL,
	"conversions_this_month" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"last_conversion_at" timestamp,
	"last_usage_reset_date" date,
	"preferred_template" varchar(64) DEFAULT 'general',
	"theme" "theme" DEFAULT 'system',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
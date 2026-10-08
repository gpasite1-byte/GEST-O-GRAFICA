CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"contact" text,
	"email" varchar(320),
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sample_approval_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"version_id" integer NOT NULL,
	"token" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sample_approval_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "artwork_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"version" integer NOT NULL,
	"file_name" text NOT NULL,
	"object_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"content_type" text NOT NULL,
	"status" varchar(32) DEFAULT 'RASCUNHO' NOT NULL,
	"notes" text,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decision_comment" text
);
--> statement-breakpoint
CREATE TABLE "order_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"method" varchar(32),
	"responsible" text,
	"dispatch_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"proof" text,
	"signature" text,
	"photo_path" text,
	CONSTRAINT "order_deliveries_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "production_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" varchar(32),
	"ticket_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"product" text NOT NULL,
	"quantity" integer NOT NULL,
	"format" text,
	"material" text,
	"colors" text,
	"finishing" text,
	"due_date" date NOT NULL,
	"amount" numeric(14, 2),
	"approved_version" integer NOT NULL,
	"approved_file_name" text NOT NULL,
	"approved_object_path" text NOT NULL,
	"status" varchar(48) DEFAULT 'A_PRODUZIR' NOT NULL,
	"current_stage" varchar(48) DEFAULT 'PRE_IMPRESSAO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_orders_order_code_unique" UNIQUE("order_code"),
	CONSTRAINT "production_orders_ticket_id_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "production_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"stage" varchar(48) NOT NULL,
	"status" varchar(24) DEFAULT 'PENDENTE' NOT NULL,
	"responsible" text,
	"machine" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"quantity_produced" integer,
	"waste" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "quality_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"checklist" jsonb NOT NULL,
	"decision" varchar(24) NOT NULL,
	"notes" text,
	"checked_by" varchar(255) NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_code" varchar(32),
	"client_id" integer NOT NULL,
	"status" varchar(48) DEFAULT 'NOVO' NOT NULL,
	"product" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"format" text,
	"material" text,
	"colors" text,
	"finishing" text,
	"due_date" date NOT NULL,
	"priority" varchar(16) DEFAULT 'NORMAL' NOT NULL,
	"amount" numeric(14, 2),
	"responsible" text,
	"assigned_designer" text,
	"observations" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_tickets_ticket_code_unique" UNIQUE("ticket_code")
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"order_id" integer,
	"actor_id" varchar(255),
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"previous_state" text,
	"new_state" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"role" varchar(32) DEFAULT 'ATENDIMENTO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sample_approval_links" ADD CONSTRAINT "sample_approval_links_ticket_id_print_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."print_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_approval_links" ADD CONSTRAINT "sample_approval_links_version_id_artwork_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."artwork_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_versions" ADD CONSTRAINT "artwork_versions_ticket_id_print_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."print_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_versions" ADD CONSTRAINT "artwork_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_order_id_production_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_ticket_id_print_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."print_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_stages" ADD CONSTRAINT "production_stages_order_id_production_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_order_id_production_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_tickets" ADD CONSTRAINT "print_tickets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_tickets" ADD CONSTRAINT "print_tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_ticket_id_print_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."print_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_order_id_production_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."production_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "artwork_versions_ticket_version_idx" ON "artwork_versions" USING btree ("ticket_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "production_orders_order_code_idx" ON "production_orders" USING btree ("order_code");--> statement-breakpoint
CREATE UNIQUE INDEX "production_stages_order_stage_idx" ON "production_stages" USING btree ("order_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "print_tickets_ticket_code_idx" ON "print_tickets" USING btree ("ticket_code");
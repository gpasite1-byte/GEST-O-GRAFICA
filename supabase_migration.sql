-- ==============================================================================
-- GRÁFICA FLOW - MIGRAÇÃO COMPLETA PARA SUPABASE (POSTGRESQL)
-- Project Ref: czcptgunvyxdajotbyfb
-- ==============================================================================

-- 1. TABELAS DE SESSÃO E UTILIZADORES
CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "staff_members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"role" varchar(32) DEFAULT 'ATENDIMENTO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"contact" text,
	"email" varchar(320),
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. TICKETS DE IMPRESSÃO
CREATE TABLE IF NOT EXISTS "print_tickets" (
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

-- 4. ARTES FINAIS E APROVAÇÃO DE AMOSTRAS
CREATE TABLE IF NOT EXISTS "artwork_versions" (
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

CREATE TABLE IF NOT EXISTS "sample_approval_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"version_id" integer NOT NULL,
	"token" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sample_approval_links_token_unique" UNIQUE("token")
);

-- 5. ORDENS DE PRODUÇÃO (OP) E ETAPAS
CREATE TABLE IF NOT EXISTS "production_orders" (
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

CREATE TABLE IF NOT EXISTS "production_stages" (
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

-- 6. CONTROLO DE QUALIDADE E EXPEDIÇÃO
CREATE TABLE IF NOT EXISTS "quality_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"checklist" jsonb NOT NULL,
	"decision" varchar(24) NOT NULL,
	"notes" text,
	"checked_by" varchar(255) NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "order_deliveries" (
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

-- 7. AUDITORIA E TIMELINE
CREATE TABLE IF NOT EXISTS "timeline_events" (
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

-- 8. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" USING btree ("expire");
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_versions_ticket_version_idx" ON "artwork_versions" USING btree ("ticket_id","version");
CREATE UNIQUE INDEX IF NOT EXISTS "production_orders_order_code_idx" ON "production_orders" USING btree ("order_code");
CREATE UNIQUE INDEX IF NOT EXISTS "production_stages_order_stage_idx" ON "production_stages" USING btree ("order_id","stage");
CREATE UNIQUE INDEX IF NOT EXISTS "print_tickets_ticket_code_idx" ON "print_tickets" USING btree ("ticket_code");

-- 9. POPULAR UTILIZADORES E EQUIPA INICIAIS
INSERT INTO "users" ("id", "first_name", "last_name", "email") VALUES
  ('usr_admin', 'Gestor', 'Produção', 'gestor@graficaflow.ao'),
  ('usr_atend', 'Ana Paula', 'Atendimento', 'ana@graficaflow.ao'),
  ('usr_des', 'Mateus', 'Designer', 'mateus@graficaflow.ao'),
  ('usr_prod', 'João', 'Baptista', 'joao@graficaflow.ao'),
  ('usr_qual', 'Teresa', 'Qualidade', 'teresa@graficaflow.ao'),
  ('usr_exp', 'Carlos', 'Expedição', 'carlos@graficaflow.ao')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "staff_members" ("id", "role") VALUES
  ('usr_admin', 'ADMIN'),
  ('usr_atend', 'ATENDIMENTO'),
  ('usr_des', 'DESIGNER'),
  ('usr_prod', 'PRODUCAO'),
  ('usr_qual', 'QUALIDADE'),
  ('usr_exp', 'EXPEDICAO')
ON CONFLICT ("id") DO UPDATE SET "role" = EXCLUDED."role";

-- 10. FUNÇÃO RPC PARA EXECUÇÃO SQL REMOTA VIA SUPABASE (OPCIONAL)
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
  RETURN json_build_object('success', true);
END;
$$;

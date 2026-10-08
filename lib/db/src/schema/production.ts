import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { usersTable } from "./auth";

export const ticketsTable = pgTable(
  "print_tickets",
  {
    id: serial("id").primaryKey(),
    ticketCode: varchar("ticket_code", { length: 32 }).unique(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id),
    status: varchar("status", { length: 48 }).notNull().default("NOVO"),
    product: text("product").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    format: text("format"),
    material: text("material"),
    colors: text("colors"),
    finishing: text("finishing"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("NORMAL"),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }),
    responsible: text("responsible"),
    assignedDesigner: text("assigned_designer"),
    observations: text("observations"),
    files: jsonb("files").notNull().default(sql`'[]'::jsonb`),
    createdBy: varchar("created_by", { length: 255 })
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("print_tickets_ticket_code_idx").on(table.ticketCode)],
);

export const artworkVersionsTable = pgTable(
  "artwork_versions",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticketsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    fileName: text("file_name").notNull(),
    objectPath: text("object_path").notNull(),
    fileSize: integer("file_size").notNull(),
    contentType: text("content_type").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("RASCUNHO"),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 255 })
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionComment: text("decision_comment"),
  },
  (table) => [
    uniqueIndex("artwork_versions_ticket_version_idx").on(
      table.ticketId,
      table.version,
    ),
  ],
);

export const approvalLinksTable = pgTable("sample_approval_links", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  versionId: integer("version_id")
    .notNull()
    .references(() => artworkVersionsTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productionOrdersTable = pgTable(
  "production_orders",
  {
    id: serial("id").primaryKey(),
    orderCode: varchar("order_code", { length: 32 }).unique(),
    ticketId: integer("ticket_id")
      .notNull()
      .unique()
      .references(() => ticketsTable.id),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id),
    product: text("product").notNull(),
    quantity: integer("quantity").notNull(),
    format: text("format"),
    material: text("material"),
    colors: text("colors"),
    finishing: text("finishing"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }),
    approvedVersion: integer("approved_version").notNull(),
    approvedFileName: text("approved_file_name").notNull(),
    approvedObjectPath: text("approved_object_path").notNull(),
    status: varchar("status", { length: 48 }).notNull().default("A_PRODUZIR"),
    currentStage: varchar("current_stage", { length: 48 })
      .notNull()
      .default("PRE_IMPRESSAO"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("production_orders_order_code_idx").on(table.orderCode)],
);

export const productionStagesTable = pgTable(
  "production_stages",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => productionOrdersTable.id, { onDelete: "cascade" }),
    stage: varchar("stage", { length: 48 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("PENDENTE"),
    responsible: text("responsible"),
    machine: text("machine"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    quantityProduced: integer("quantity_produced"),
    waste: integer("waste"),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("production_stages_order_stage_idx").on(
      table.orderId,
      table.stage,
    ),
  ],
);

export const qualityChecksTable = pgTable("quality_checks", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => productionOrdersTable.id, { onDelete: "cascade" }),
  checklist: jsonb("checklist").notNull(),
  decision: varchar("decision", { length: 24 }).notNull(),
  notes: text("notes"),
  checkedBy: varchar("checked_by", { length: 255 })
    .notNull()
    .references(() => usersTable.id),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deliveriesTable = pgTable("order_deliveries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .unique()
    .references(() => productionOrdersTable.id, { onDelete: "cascade" }),
  method: varchar("method", { length: 32 }),
  responsible: text("responsible"),
  dispatchAt: timestamp("dispatch_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  proof: text("proof"),
  signature: text("signature"),
  photoPath: text("photo_path"),
});

export const timelineEventsTable = pgTable("timeline_events", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => productionOrdersTable.id, {
    onDelete: "set null",
  }),
  actorId: varchar("actor_id", { length: 255 }),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  previousState: text("previous_state"),
  newState: text("new_state"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  ticketCode: true,
  createdAt: true,
  updatedAt: true,
});
export const insertArtworkVersionSchema = createInsertSchema(
  artworkVersionsTable,
).omit({ id: true, createdAt: true, decidedAt: true, decisionComment: true });
export const insertProductionOrderSchema = createInsertSchema(
  productionOrdersTable,
).omit({ id: true, orderCode: true, createdAt: true, updatedAt: true });

export type Ticket = typeof ticketsTable.$inferSelect;
export type ArtworkVersion = typeof artworkVersionsTable.$inferSelect;
export type ProductionOrder = typeof productionOrdersTable.$inferSelect;
export type ProductionStage = typeof productionStagesTable.$inferSelect;
export type QualityCheck = typeof qualityChecksTable.$inferSelect;
export type Delivery = typeof deliveriesTable.$inferSelect;
export type TimelineEvent = typeof timelineEventsTable.$inferSelect;

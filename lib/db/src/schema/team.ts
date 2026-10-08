import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const staffTable = pgTable("staff_members", {
  id: varchar("id", { length: 255 }).primaryKey(),
  role: varchar("role", { length: 32 }).notNull().default("ATENDIMENTO"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertStaff = typeof staffTable.$inferInsert;
export type Staff = typeof staffTable.$inferSelect;

export const STAFF_ROLES = [
  "ADMIN",
  "GESTAO",
  "ATENDIMENTO",
  "DESIGNER",
  "PRODUCAO",
  "QUALIDADE",
  "EXPEDICAO",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

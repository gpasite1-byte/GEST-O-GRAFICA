import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company"),
  contact: text("contact"),
  email: varchar("email", { length: 320 }),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertClient = typeof clientsTable.$inferInsert;
export type Client = typeof clientsTable.$inferSelect;

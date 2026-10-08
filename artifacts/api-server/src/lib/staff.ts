import { count, eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { db, staffTable, type StaffRole } from "@workspace/db";

export function staffDisplayName(user: NonNullable<Request["user"]>): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "Colaborador";
}

async function ensureStaffMember(user: NonNullable<Request["user"]>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(64201877)`);
    const [existing] = await tx
      .select()
      .from(staffTable)
      .where(eq(staffTable.id, user.id));
    if (existing) return existing;

    const [total] = await tx.select({ value: count() }).from(staffTable);
    const [created] = await tx
      .insert(staffTable)
      .values({
        id: user.id,
        role: Number(total.value) === 0 ? "ADMIN" : "ATENDIMENTO",
      })
      .returning();
    return created;
  });
}

export async function requireStaff(
  req: Request,
  res: Response,
): Promise<{ id: string; name: string; role: StaffRole } | null> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "É necessário iniciar sessão." });
    return null;
  }
  const member = await ensureStaffMember(req.user);
  return {
    id: member.id,
    name: staffDisplayName(req.user),
    role: member.role as StaffRole,
  };
}

export async function requireRole(
  req: Request,
  res: Response,
  allowedRoles: StaffRole[],
): Promise<{ id: string; name: string; role: StaffRole } | null> {
  const member = await requireStaff(req, res);
  if (!member) return null;
  if (!allowedRoles.includes(member.role)) {
    res.status(403).json({ error: "O seu perfil não permite esta acção." });
    return null;
  }
  return member;
}

export function luandaYear(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Africa/Luanda",
    }).format(date),
  );
}

export function luandaDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Luanda",
  }).format(date);
}

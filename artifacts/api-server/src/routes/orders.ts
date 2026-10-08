import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetOrderParams,
  GetOrderResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  SubmitQualityCheckBody,
  SubmitQualityCheckParams,
  SubmitQualityCheckResponse,
  UpdateOrderDeliveryBody,
  UpdateOrderDeliveryParams,
  UpdateOrderDeliveryResponse,
  UpdateOrderStageBody,
  UpdateOrderStageParams,
  UpdateOrderStageResponse,
} from "@workspace/api-zod";
import {
  clientsTable,
  db,
  deliveriesTable,
  productionOrdersTable,
  productionStagesTable,
  qualityChecksTable,
  ticketsTable,
  timelineEventsTable,
} from "@workspace/db";
import { requireRole, requireStaff } from "../lib/staff";

const router: IRouter = Router();

async function getOrderDetails(orderId: number) {
  const [row] = await db
    .select({
      order: productionOrdersTable,
      ticket: ticketsTable,
      client: clientsTable,
    })
    .from(productionOrdersTable)
    .innerJoin(ticketsTable, eq(ticketsTable.id, productionOrdersTable.ticketId))
    .innerJoin(clientsTable, eq(clientsTable.id, productionOrdersTable.clientId))
    .where(eq(productionOrdersTable.id, orderId));
  if (!row) return null;

  const [stages, qualityRows, delivery, events] = await Promise.all([
    db
      .select()
      .from(productionStagesTable)
      .where(eq(productionStagesTable.orderId, orderId))
      .orderBy(asc(productionStagesTable.id)),
    db
      .select()
      .from(qualityChecksTable)
      .where(eq(qualityChecksTable.orderId, orderId))
      .orderBy(desc(qualityChecksTable.checkedAt))
      .limit(1),
    db
      .select()
      .from(deliveriesTable)
      .where(eq(deliveriesTable.orderId, orderId))
      .limit(1),
    db
      .select()
      .from(timelineEventsTable)
      .where(eq(timelineEventsTable.orderId, orderId))
      .orderBy(asc(timelineEventsTable.createdAt)),
  ]);
  const order = row.order;
  return {
    id: order.id,
    orderCode: order.orderCode ?? `OP-${order.id}`,
    ticketId: order.ticketId,
    ticketCode: row.ticket.ticketCode ?? `PG-${row.ticket.id}`,
    clientName: row.client.name,
    product: order.product,
    quantity: order.quantity,
    status: order.status,
    currentStage: order.currentStage,
    dueDate: order.dueDate,
    approvedVersion: order.approvedVersion,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    approvedFileName: order.approvedFileName,
    approvedObjectPath: order.approvedObjectPath,
    stages: stages.map((stage) => ({
      id: stage.id,
      stage: stage.stage,
      status: stage.status,
      responsible: stage.responsible,
      machine: stage.machine,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      quantityProduced: stage.quantityProduced,
      waste: stage.waste,
      notes: stage.notes,
    })),
    qualityCheck: qualityRows[0] ?? null,
    delivery: {
      method: delivery[0]?.method ?? null,
      responsible: delivery[0]?.responsible ?? null,
      dispatchAt: delivery[0]?.dispatchAt ?? null,
      deliveredAt: delivery[0]?.deliveredAt ?? null,
      proof: delivery[0]?.proof ?? null,
      signature: delivery[0]?.signature ?? null,
      photoPath: delivery[0]?.photoPath ?? null,
    },
    events: events.map((event) => ({
      id: event.id,
      ticketId: event.ticketId,
      ticketCode: row.ticket.ticketCode ?? `PG-${row.ticket.id}`,
      orderId: event.orderId,
      actorName: event.actorName,
      action: event.action,
      previousState: event.previousState,
      newState: event.newState,
      note: event.note,
      createdAt: event.createdAt,
    })),
  };
}

router.get("/orders", async (req: Request, res: Response) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.status) {
    filters.push(eq(productionOrdersTable.status, parsed.data.status));
  }
  const search = parsed.data.search?.trim();
  if (search) {
    filters.push(
      or(
        ilike(productionOrdersTable.orderCode, `%${search}%`),
        ilike(ticketsTable.ticketCode, `%${search}%`),
        ilike(productionOrdersTable.product, `%${search}%`),
        ilike(clientsTable.name, `%${search}%`),
      ),
    );
  }
  const rows = await db
    .select({ order: productionOrdersTable, ticket: ticketsTable, client: clientsTable })
    .from(productionOrdersTable)
    .innerJoin(ticketsTable, eq(ticketsTable.id, productionOrdersTable.ticketId))
    .innerJoin(clientsTable, eq(clientsTable.id, productionOrdersTable.clientId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(productionOrdersTable.createdAt));
  res.json(
    ListOrdersResponse.parse(
      rows.map(({ order, ticket, client }) => ({
        id: order.id,
        orderCode: order.orderCode ?? `OP-${order.id}`,
        ticketId: order.ticketId,
        ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
        clientName: client.name,
        product: order.product,
        quantity: order.quantity,
        status: order.status,
        currentStage: order.currentStage,
        dueDate: order.dueDate,
        approvedVersion: order.approvedVersion,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
    ),
  );
});

router.get("/orders/:orderId", async (req: Request, res: Response) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const order = await getOrderDetails(params.data.orderId);
  if (!order) {
    res.status(404).json({ error: "Ordem de produção não encontrada." });
    return;
  }
  res.json(GetOrderResponse.parse(order));
});

router.post("/orders/:orderId/stages", async (req: Request, res: Response) => {
  const staff = await requireRole(req, res, ["ADMIN", "PRODUCAO"]);
  if (!staff) return;
  const params = UpdateOrderStageParams.safeParse(req.params);
  const parsed = UpdateOrderStageBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  const [order] = await db
    .select()
    .from(productionOrdersTable)
    .where(eq(productionOrdersTable.id, params.data.orderId));
  if (!order) {
    res.status(404).json({ error: "Ordem de produção não encontrada." });
    return;
  }
  if (order.currentStage !== parsed.data.stage) {
    res.status(400).json({ error: "A etapa escolhida não é a próxima etapa da ordem." });
    return;
  }
  const [step] = await db
    .select()
    .from(productionStagesTable)
    .where(
      and(
        eq(productionStagesTable.orderId, order.id),
        eq(productionStagesTable.stage, parsed.data.stage),
      ),
    );
  if (!step) {
    res.status(400).json({ error: "Etapa não encontrada nesta ordem." });
    return;
  }
  const now = new Date();
  if (parsed.data.action === "INICIAR" && step.status === "EM_ANDAMENTO") {
    res.status(400).json({ error: "Esta etapa já está em curso." });
    return;
  }
  if (parsed.data.action === "INICIAR" && step.status === "CONCLUIDO") {
    res.status(400).json({ error: "Esta etapa já foi concluída." });
    return;
  }
  if (parsed.data.action === "CONCLUIR" && step.status !== "EM_ANDAMENTO") {
    res.status(400).json({ error: "Inicie a etapa antes de a concluir." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.action === "INICIAR") {
    updates.status = "EM_ANDAMENTO";
    updates.startedAt = now;
    updates.responsible = parsed.data.responsible ?? staff.name;
    updates.machine = parsed.data.machine ?? null;
    updates.notes = parsed.data.notes ?? step.notes;
  } else {
    updates.status = "CONCLUIDO";
    updates.completedAt = now;
    updates.responsible = parsed.data.responsible ?? step.responsible ?? staff.name;
    updates.machine = parsed.data.machine ?? step.machine;
    updates.quantityProduced = parsed.data.quantityProduced ?? order.quantity;
    updates.waste = parsed.data.waste ?? 0;
    updates.notes = parsed.data.notes ?? step.notes;
  }

  const nextStage =
    parsed.data.action === "INICIAR"
      ? parsed.data.stage
      : parsed.data.stage === "PRE_IMPRESSAO"
        ? "IMPRESSAO"
        : parsed.data.stage === "IMPRESSAO"
          ? "ACABAMENTO"
          : parsed.data.stage === "ACABAMENTO"
            ? "CONTROLO_QUALIDADE"
            : "EXPEDICAO";
  const nextStatus =
    parsed.data.action === "INICIAR"
      ? parsed.data.stage === "ACABAMENTO"
        ? "EM_ACABAMENTO"
        : parsed.data.stage === "EMBALAGEM"
          ? "EM_EMBALAGEM"
          : "EM_PRODUCAO"
      : parsed.data.stage === "ACABAMENTO"
        ? "AGUARDA_CONTROLO_QUALIDADE"
        : parsed.data.stage === "EMBALAGEM"
          ? "PRONTO_PARA_ENTREGA"
          : "A_PRODUZIR";
  await db.transaction(async (tx) => {
    await tx
      .update(productionStagesTable)
      .set(updates)
      .where(eq(productionStagesTable.id, step.id));
    await tx
      .update(productionOrdersTable)
      .set({ status: nextStatus, currentStage: nextStage })
      .where(eq(productionOrdersTable.id, order.id));
    await tx.insert(timelineEventsTable).values({
      ticketId: order.ticketId,
      orderId: order.id,
      actorId: staff.id,
      actorName: staff.name,
      action:
        parsed.data.action === "INICIAR"
          ? "ETAPA_INICIADA"
          : "ETAPA_CONCLUIDA",
      previousState: order.status,
      newState: nextStatus,
      note: `${parsed.data.stage}: ${parsed.data.action.toLowerCase()}.`,
      createdAt: now,
    });
  });
  const updated = await getOrderDetails(order.id);
  res.json(UpdateOrderStageResponse.parse(updated));
});

router.post(
  "/orders/:orderId/quality-check",
  async (req: Request, res: Response) => {
    const staff = await requireRole(req, res, ["ADMIN", "QUALIDADE"]);
    if (!staff) return;
    const params = SubmitQualityCheckParams.safeParse(req.params);
    const parsed = SubmitQualityCheckBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
      return;
    }
    const [order] = await db
      .select()
      .from(productionOrdersTable)
      .where(eq(productionOrdersTable.id, params.data.orderId));
    if (!order) {
      res.status(404).json({ error: "Ordem de produção não encontrada." });
      return;
    }
    if (
      order.status !== "AGUARDA_CONTROLO_QUALIDADE" ||
      order.currentStage !== "CONTROLO_QUALIDADE"
    ) {
      res.status(400).json({ error: "O controlo de qualidade só pode ocorrer após o acabamento." });
      return;
    }
    const checklistPasses = Object.values(parsed.data.checklist).every(Boolean);
    if (parsed.data.decision === "APROVADO" && !checklistPasses) {
      res.status(400).json({ error: "Todos os itens do checklist devem passar para aprovar a qualidade." });
      return;
    }
    const now = new Date();
    const passed = parsed.data.decision === "APROVADO";
    await db.transaction(async (tx) => {
      await tx.insert(qualityChecksTable).values({
        orderId: order.id,
        checklist: parsed.data.checklist,
        decision: parsed.data.decision,
        notes: parsed.data.notes ?? null,
        checkedBy: staff.id,
        checkedAt: now,
      });
      if (passed) {
        await tx
          .update(productionOrdersTable)
          .set({ status: "A_PRODUZIR", currentStage: "EMBALAGEM" })
          .where(eq(productionOrdersTable.id, order.id));
      } else {
        await tx
          .update(productionOrdersTable)
          .set({ status: "REPROCESSAR", currentStage: "ACABAMENTO" })
          .where(eq(productionOrdersTable.id, order.id));
        await tx
          .update(productionStagesTable)
          .set({
            status: "PENDENTE",
            startedAt: null,
            completedAt: null,
            quantityProduced: null,
            waste: null,
          })
          .where(
            and(
              eq(productionStagesTable.orderId, order.id),
              eq(productionStagesTable.stage, "ACABAMENTO"),
            ),
          );
      }
      await tx.insert(timelineEventsTable).values({
        ticketId: order.ticketId,
        orderId: order.id,
        actorId: staff.id,
        actorName: staff.name,
        action: passed
          ? "CONTROLO_QUALIDADE_APROVADO"
          : "CONTROLO_QUALIDADE_REPROCESSAR",
        previousState: order.status,
        newState: passed ? "A_PRODUZIR" : "REPROCESSAR",
        note: parsed.data.notes ?? null,
        createdAt: now,
      });
    });
    const updated = await getOrderDetails(order.id);
    res.json(SubmitQualityCheckResponse.parse(updated));
  },
);

router.post(
  "/orders/:orderId/delivery",
  async (req: Request, res: Response) => {
    const staff = await requireRole(req, res, ["ADMIN", "EXPEDICAO"]);
    if (!staff) return;
    const params = UpdateOrderDeliveryParams.safeParse(req.params);
    const parsed = UpdateOrderDeliveryBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
      return;
    }
    const [order] = await db
      .select()
      .from(productionOrdersTable)
      .where(eq(productionOrdersTable.id, params.data.orderId));
    if (!order) {
      res.status(404).json({ error: "Ordem de produção não encontrada." });
      return;
    }
    const [existingDelivery] = await db
      .select()
      .from(deliveriesTable)
      .where(eq(deliveriesTable.orderId, order.id));
    const now = new Date();
    if (parsed.data.action === "EXPEDIR") {
      if (order.status !== "PRONTO_PARA_ENTREGA") {
        res.status(400).json({ error: "A ordem ainda não está pronta para expedição." });
        return;
      }
      if (!parsed.data.method) {
        res.status(400).json({ error: "Seleccione o método de entrega." });
        return;
      }
      if (existingDelivery?.dispatchAt) {
        res.status(400).json({ error: "A ordem já foi expedida." });
        return;
      }
      await db.transaction(async (tx) => {
        if (existingDelivery) {
          await tx
            .update(deliveriesTable)
            .set({
              method: parsed.data.method,
              responsible: parsed.data.responsible ?? staff.name,
              dispatchAt: now,
              proof: parsed.data.proof ?? null,
              signature: parsed.data.signature ?? null,
              photoPath: parsed.data.photoPath ?? null,
            })
            .where(eq(deliveriesTable.id, existingDelivery.id));
        } else {
          await tx.insert(deliveriesTable).values({
            orderId: order.id,
            method: parsed.data.method,
            responsible: parsed.data.responsible ?? staff.name,
            dispatchAt: now,
            proof: parsed.data.proof ?? null,
            signature: parsed.data.signature ?? null,
            photoPath: parsed.data.photoPath ?? null,
          });
        }
        await tx
          .update(productionOrdersTable)
          .set({ status: "EM_EXPEDICAO", currentStage: "EXPEDICAO" })
          .where(eq(productionOrdersTable.id, order.id));
        await tx.insert(timelineEventsTable).values({
          ticketId: order.ticketId,
          orderId: order.id,
          actorId: staff.id,
          actorName: staff.name,
          action: "OP_EXPEDIDA",
          previousState: order.status,
          newState: "EM_EXPEDICAO",
          note: parsed.data.method,
          createdAt: now,
        });
      });
    } else {
      if (order.status !== "EM_EXPEDICAO" || !existingDelivery?.dispatchAt) {
        res.status(400).json({ error: "Registe primeiro a expedição da ordem." });
        return;
      }
      await db.transaction(async (tx) => {
        await tx
          .update(deliveriesTable)
          .set({
            deliveredAt: now,
            responsible: parsed.data.responsible ?? existingDelivery.responsible ?? staff.name,
            proof: parsed.data.proof ?? existingDelivery.proof,
            signature: parsed.data.signature ?? existingDelivery.signature,
            photoPath: parsed.data.photoPath ?? existingDelivery.photoPath,
          })
          .where(eq(deliveriesTable.id, existingDelivery.id));
        await tx
          .update(productionOrdersTable)
          .set({ status: "ENTREGUE", currentStage: "ENTREGUE" })
          .where(eq(productionOrdersTable.id, order.id));
        await tx.insert(timelineEventsTable).values({
          ticketId: order.ticketId,
          orderId: order.id,
          actorId: staff.id,
          actorName: staff.name,
          action: "PRODUTO_ENTREGUE",
          previousState: order.status,
          newState: "ENTREGUE",
          note: parsed.data.proof ?? null,
          createdAt: now,
        });
      });
    }
    const updated = await getOrderDetails(order.id);
    res.json(UpdateOrderDeliveryResponse.parse(updated));
  },
);

export default router;

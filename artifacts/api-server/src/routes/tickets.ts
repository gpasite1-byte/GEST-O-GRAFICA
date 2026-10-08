import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  AnalyzeTicketBody,
  AnalyzeTicketParams,
  AnalyzeTicketResponse,
  CreateArtworkVersionBody,
  CreateArtworkVersionParams,
  CreateArtworkVersionResponse,
  CreateClientBody,
  CreateClientResponse,
  CreateTicketBody,
  CreateTicketResponse,
  DecideTicketProductionBody,
  DecideTicketProductionParams,
  DecideTicketProductionResponse,
  GetDashboardResponse,
  GetTicketParams,
  GetTicketResponse,
  ListActivityQueryParams,
  ListActivityResponse,
  ListTeamMembersResponse,
  ListClientsQueryParams,
  ListClientsResponse,
  ListTicketsQueryParams,
  ListTicketsResponse,
  UpdateTeamRoleBody,
  UpdateTeamRoleParams,
  UpdateTeamRoleResponse,
} from "@workspace/api-zod";
import {
  approvalLinksTable,
  artworkVersionsTable,
  clientsTable,
  db,
  productionOrdersTable,
  productionStagesTable,
  staffTable,
  ticketsTable,
  timelineEventsTable,
  usersTable,
} from "@workspace/db";
import { luandaDate, requireRole, requireStaff } from "../lib/staff";

const router: IRouter = Router();

async function getTicketDetails(ticketId: number) {
  const [row] = await db
    .select({ ticket: ticketsTable, client: clientsTable, order: productionOrdersTable })
    .from(ticketsTable)
    .innerJoin(clientsTable, eq(ticketsTable.clientId, clientsTable.id))
    .leftJoin(productionOrdersTable, eq(productionOrdersTable.ticketId, ticketsTable.id))
    .where(eq(ticketsTable.id, ticketId));
  if (!row) return null;

  const versions = await db
    .select()
    .from(artworkVersionsTable)
    .where(eq(artworkVersionsTable.ticketId, ticketId))
    .orderBy(asc(artworkVersionsTable.version));
  const events = await db
    .select()
    .from(timelineEventsTable)
    .where(eq(timelineEventsTable.ticketId, ticketId))
    .orderBy(asc(timelineEventsTable.createdAt));
  const [approvalLink] = await db
    .select()
    .from(approvalLinksTable)
    .where(
      and(
        eq(approvalLinksTable.ticketId, ticketId),
        isNull(approvalLinksTable.usedAt),
      ),
    )
    .orderBy(desc(approvalLinksTable.createdAt))
    .limit(1);

  const ticket = row.ticket;
  return {
    id: ticket.id,
    ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
    status: ticket.status,
    clientName: row.client.name,
    company: row.client.company,
    product: ticket.product,
    quantity: ticket.quantity,
    dueDate: ticket.dueDate,
    priority: ticket.priority,
    amount: ticket.amount,
    responsible: ticket.responsible,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    orderId: row.order?.id ?? null,
    clientId: ticket.clientId,
    contact: row.client.contact,
    email: row.client.email,
    phone: row.client.phone,
    description: ticket.description,
    format: ticket.format,
    material: ticket.material,
    colors: ticket.colors,
    finishing: ticket.finishing,
    observations: ticket.observations,
    createdBy: ticket.createdBy,
    assignedDesigner: ticket.assignedDesigner,
    versions,
    events: events.map((event) => ({
      id: event.id,
      ticketId: event.ticketId,
      ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
      orderId: event.orderId,
      actorName: event.actorName,
      action: event.action,
      previousState: event.previousState,
      newState: event.newState,
      note: event.note,
      createdAt: event.createdAt,
    })),
    sampleApprovalUrl: approvalLink
      ? `/aprovar/${approvalLink.token}`
      : null,
  };
}

function eventValues(input: {
  ticketId: number;
  ticketCode: string;
  actorId: string | null;
  actorName: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  note?: string | null;
  orderId?: number | null;
}) {
  return {
    ticketId: input.ticketId,
    orderId: input.orderId ?? null,
    actorId: input.actorId,
    actorName: input.actorName,
    action: input.action,
    previousState: input.previousState,
    newState: input.newState,
    note: input.note ?? null,
  };
}

router.get("/dashboard", async (req: Request, res: Response) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;

  const [tickets, orders, events] = await Promise.all([
    db.select().from(ticketsTable),
    db.select().from(productionOrdersTable),
    db.select().from(timelineEventsTable).orderBy(asc(timelineEventsTable.createdAt)),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const openStatuses = new Set(["ENTREGUE", "CANCELADO", "RECUSADO"]);
  const overdue = tickets.filter(
    (ticket) => ticket.dueDate < today && !openStatuses.has(ticket.status),
  ).length;
  const approvalDurations: number[] = [];
  const productionDurations: number[] = [];
  const eventTimes = new Map<number, Map<string, Date>>();
  for (const event of events) {
    let byAction = eventTimes.get(event.ticketId);
    if (!byAction) {
      byAction = new Map();
      eventTimes.set(event.ticketId, byAction);
    }
    byAction.set(event.action, event.createdAt);
  }
  for (const byAction of eventTimes.values()) {
    const created = byAction.get("TICKET_CRIADO");
    const sampleApproved = byAction.get("AMOSTRA_APROVADA");
    if (created && sampleApproved) {
      approvalDurations.push(
        Math.max(0, (sampleApproved.getTime() - created.getTime()) / 60_000),
      );
    }
    const orderCreated = byAction.get("OP_CRIADA_AUTOMATICAMENTE");
    const delivered = byAction.get("PRODUTO_ENTREGUE");
    if (orderCreated && delivered) {
      productionDurations.push(
        Math.max(0, (delivered.getTime() - orderCreated.getTime()) / 60_000),
      );
    }
  }
  const average = (values: number[]) =>
    values.length ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length) : 0;
  const recentRows = await db
    .select({
      id: timelineEventsTable.id,
      ticketId: timelineEventsTable.ticketId,
      ticketCode: ticketsTable.ticketCode,
      orderId: timelineEventsTable.orderId,
      actorName: timelineEventsTable.actorName,
      action: timelineEventsTable.action,
      previousState: timelineEventsTable.previousState,
      newState: timelineEventsTable.newState,
      note: timelineEventsTable.note,
      createdAt: timelineEventsTable.createdAt,
    })
    .from(timelineEventsTable)
    .leftJoin(ticketsTable, eq(ticketsTable.id, timelineEventsTable.ticketId))
    .orderBy(desc(timelineEventsTable.createdAt))
    .limit(8);

  res.json(
    GetDashboardResponse.parse({
      openTickets: tickets.filter((ticket) => !openStatuses.has(ticket.status)).length,
      inDesign: tickets.filter((ticket) => ["APROVADO_PARA_DESIGN", "EM_DESIGN", "AMOSTRA_REJEITADA"].includes(ticket.status)).length,
      awaitingSample: tickets.filter((ticket) => ticket.status === "AGUARDA_APROVACAO_AMOSTRA").length,
      awaitingManagement: tickets.filter((ticket) => ticket.status === "AGUARDA_APROVACAO_GESTAO").length,
      inProduction: orders.filter((order) => ["A_PRODUZIR", "EM_PRODUCAO"].includes(order.status)).length,
      finishing: orders.filter((order) => order.status === "EM_ACABAMENTO").length,
      readyForDelivery: orders.filter((order) => order.status === "PRONTO_PARA_ENTREGA").length,
      overdue,
      deliveredToday: events.filter(
        (event) =>
          event.action === "PRODUTO_ENTREGUE" &&
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Luanda",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(event.createdAt) === today,
      ).length,
      averageApprovalMinutes: average(approvalDurations),
      averageProductionMinutes: average(productionDurations),
      recentActivity: recentRows.map((event) => ({
        ...event,
        ticketCode: event.ticketCode ?? `PG-${event.ticketId}`,
      })),
    }),
  );
});

router.get("/activity", async (req: Request, res: Response) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;
  const parsed = ListActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select({
      id: timelineEventsTable.id,
      ticketId: timelineEventsTable.ticketId,
      ticketCode: ticketsTable.ticketCode,
      orderId: timelineEventsTable.orderId,
      actorName: timelineEventsTable.actorName,
      action: timelineEventsTable.action,
      previousState: timelineEventsTable.previousState,
      newState: timelineEventsTable.newState,
      note: timelineEventsTable.note,
      createdAt: timelineEventsTable.createdAt,
    })
    .from(timelineEventsTable)
    .leftJoin(ticketsTable, eq(ticketsTable.id, timelineEventsTable.ticketId))
    .orderBy(desc(timelineEventsTable.createdAt))
    .limit(parsed.data.limit ?? 20);
  res.json(
    ListActivityResponse.parse(
      rows.map((event) => ({
        ...event,
        ticketCode: event.ticketCode ?? `PG-${event.ticketId}`,
      })),
    ),
  );
});

router.get("/clients", async (req: Request, res: Response) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;
  const parsed = ListClientsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const search = parsed.data.search?.trim();
  const rows = await db
    .select()
    .from(clientsTable)
    .where(
      search
        ? or(
            ilike(clientsTable.name, `%${search}%`),
            ilike(clientsTable.company, `%${search}%`),
            ilike(clientsTable.contact, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(asc(clientsTable.name));
  res.json(ListClientsResponse.parse(rows));
});

router.post("/clients", async (req: Request, res: Response) => {
  const staff = await requireRole(req, res, ["ADMIN", "GESTAO", "ATENDIMENTO"]);
  if (!staff) return;
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db.insert(clientsTable).values(parsed.data).returning();
  res.status(201).json(CreateClientResponse.parse(client));
});

router.get("/tickets", async (req: Request, res: Response) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;
  const parsed = ListTicketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions = [];
  if (parsed.data.status) conditions.push(eq(ticketsTable.status, parsed.data.status));
  const search = parsed.data.search?.trim();
  if (search) {
    conditions.push(
      or(
        ilike(ticketsTable.ticketCode, `%${search}%`),
        ilike(ticketsTable.product, `%${search}%`),
        ilike(clientsTable.name, `%${search}%`),
        ilike(clientsTable.company, `%${search}%`),
      ),
    );
  }
  const rows = await db
    .select({ ticket: ticketsTable, client: clientsTable, order: productionOrdersTable })
    .from(ticketsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, ticketsTable.clientId))
    .leftJoin(productionOrdersTable, eq(productionOrdersTable.ticketId, ticketsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(ticketsTable.createdAt));
  res.json(
    ListTicketsResponse.parse(
      rows.map(({ ticket, client, order }) => ({
        id: ticket.id,
        ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
        status: ticket.status,
        clientName: client.name,
        company: client.company,
        product: ticket.product,
        quantity: ticket.quantity,
        dueDate: ticket.dueDate,
        priority: ticket.priority,
        amount: ticket.amount,
        responsible: ticket.responsible,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        orderId: order?.id ?? null,
      })),
    ),
  );
});

router.post("/tickets", async (req: Request, res: Response) => {
  const staff = await requireRole(req, res, ["ADMIN", "GESTAO", "ATENDIMENTO"]);
  if (!staff) return;
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.id, parsed.data.clientId));
  if (!client) {
    res.status(400).json({ error: "Seleccione um cliente válido." });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(ticketsTable)
      .values({
        ...parsed.data,
        dueDate: luandaDate(parsed.data.dueDate),
        files: parsed.data.files ?? [],
        createdBy: staff.id,
      })
      .returning();
    const ticketCode = `PG-${new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Africa/Luanda",
    }).format(new Date())}-${String(inserted.id).padStart(6, "0")}`;
    const [ticket] = await tx
      .update(ticketsTable)
      .set({ ticketCode })
      .where(eq(ticketsTable.id, inserted.id))
      .returning();
    await tx.insert(timelineEventsTable).values(
      eventValues({
        ticketId: ticket.id,
        ticketCode,
        actorId: staff.id,
        actorName: staff.name,
        action: "TICKET_CRIADO",
        previousState: null,
        newState: "NOVO",
        note: `Pedido aberto: ${ticket.product}`,
      }),
    );
    return ticket;
  });

  const details = await getTicketDetails(created.id);
  res.status(201).json(CreateTicketResponse.parse(details));
});

router.get("/tickets/:ticketId", async (req: Request, res: Response) => {
  const staff = await requireStaff(req, res);
  if (!staff) return;
  const params = GetTicketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const details = await getTicketDetails(params.data.ticketId);
  if (!details) {
    res.status(404).json({ error: "Ticket não encontrado." });
    return;
  }
  res.json(GetTicketResponse.parse(details));
});

router.post("/tickets/:ticketId/analysis", async (req: Request, res: Response) => {
  const staff = await requireRole(req, res, ["ADMIN", "GESTAO", "ATENDIMENTO"]);
  if (!staff) return;
  const params = AnalyzeTicketParams.safeParse(req.params);
  const parsed = AnalyzeTicketBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, params.data.ticketId));
  if (!ticket) {
    res.status(404).json({ error: "Ticket não encontrado." });
    return;
  }
  if (!["NOVO", "AGUARDA_INFORMACAO"].includes(ticket.status)) {
    res.status(400).json({ error: "Este pedido já não pode ser analisado." });
    return;
  }
  const nextStatus =
    parsed.data.decision === "APROVAR_DESIGN"
      ? "APROVADO_PARA_DESIGN"
      : parsed.data.decision === "PEDIR_INFORMACAO"
        ? "AGUARDA_INFORMACAO"
        : "RECUSADO";
  const action =
    parsed.data.decision === "APROVAR_DESIGN"
      ? "PEDIDO_ANALISADO"
      : parsed.data.decision === "PEDIR_INFORMACAO"
        ? "INFORMACAO_PEDIDA"
        : "PEDIDO_RECUSADO";
  await db.transaction(async (tx) => {
    await tx
      .update(ticketsTable)
      .set({
        status: nextStatus,
        assignedDesigner:
          parsed.data.assignedDesigner ?? ticket.assignedDesigner,
      })
      .where(eq(ticketsTable.id, ticket.id));
    await tx.insert(timelineEventsTable).values(
      eventValues({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
        actorId: staff.id,
        actorName: staff.name,
        action,
        previousState: ticket.status,
        newState: nextStatus,
        note: parsed.data.comment,
      }),
    );
  });
  const details = await getTicketDetails(ticket.id);
  res.json(AnalyzeTicketResponse.parse(details));
});

router.post("/tickets/:ticketId/versions", async (req: Request, res: Response) => {
  const staff = await requireRole(req, res, ["ADMIN", "DESIGNER"]);
  if (!staff) return;
  const params = CreateArtworkVersionParams.safeParse(req.params);
  const parsed = CreateArtworkVersionBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, params.data.ticketId));
  if (!ticket) {
    res.status(404).json({ error: "Ticket não encontrado." });
    return;
  }
  if (
    ![
      "APROVADO_PARA_DESIGN",
      "EM_DESIGN",
      "AMOSTRA_REJEITADA",
    ].includes(ticket.status)
  ) {
    res.status(400).json({ error: "O pedido ainda não está disponível para design." });
    return;
  }
  const token = randomBytes(32).toString("hex");
  const approvalUrl = `/aprovar/${token}`;
  const result = await db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(artworkVersionsTable)
      .where(eq(artworkVersionsTable.ticketId, ticket.id))
      .orderBy(desc(artworkVersionsTable.version))
      .limit(1);
    const versionNumber = (previous?.version ?? 0) + 1;
    await tx
      .update(ticketsTable)
      .set({ status: "EM_DESIGN", assignedDesigner: ticket.assignedDesigner ?? staff.name })
      .where(eq(ticketsTable.id, ticket.id));
    await tx
      .update(approvalLinksTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(approvalLinksTable.ticketId, ticket.id),
          isNull(approvalLinksTable.usedAt),
        ),
      );
    const [version] = await tx
      .insert(artworkVersionsTable)
      .values({
        ticketId: ticket.id,
        version: versionNumber,
        fileName: parsed.data.fileName,
        objectPath: parsed.data.objectPath,
        fileSize: parsed.data.fileSize,
        contentType: parsed.data.contentType,
        status: "AGUARDA_APROVACAO",
        notes: parsed.data.notes ?? null,
        createdBy: staff.id,
      })
      .returning();
    await tx.insert(approvalLinksTable).values({
      ticketId: ticket.id,
      versionId: version.id,
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await tx
      .update(ticketsTable)
      .set({ status: "AGUARDA_APROVACAO_AMOSTRA" })
      .where(eq(ticketsTable.id, ticket.id));
    await tx.insert(timelineEventsTable).values(
      eventValues({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
        actorId: staff.id,
        actorName: staff.name,
        action: "VERSAO_ENVIADA",
        previousState: ticket.status,
        newState: "AGUARDA_APROVACAO_AMOSTRA",
        note: `Amostra V${versionNumber} enviada para aprovação.`,
      }),
    );
    return version;
  });
  res
    .status(201)
    .json(CreateArtworkVersionResponse.parse({ version: result, approvalUrl }));
});

router.post(
  "/tickets/:ticketId/management-decision",
  async (req: Request, res: Response) => {
    const staff = await requireRole(req, res, ["ADMIN", "GESTAO"]);
    if (!staff) return;
    const params = DecideTicketProductionParams.safeParse(req.params);
    const parsed = DecideTicketProductionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
      return;
    }
    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, params.data.ticketId));
    if (!ticket) {
      res.status(404).json({ error: "Ticket não encontrado." });
      return;
    }
    if (ticket.status !== "AGUARDA_APROVACAO_GESTAO") {
      res.status(400).json({ error: "O ticket aguarda primeiro a aprovação da amostra." });
      return;
    }

    const [approvedVersion] = await db
      .select()
      .from(artworkVersionsTable)
      .where(
        and(
          eq(artworkVersionsTable.ticketId, ticket.id),
          eq(artworkVersionsTable.status, "APROVADA"),
        ),
      )
      .orderBy(desc(artworkVersionsTable.version))
      .limit(1);
    if (parsed.data.decision === "APROVAR_PRODUCAO" && !approvedVersion) {
      res.status(400).json({ error: "Não existe amostra aprovada para produção." });
      return;
    }

    await db.transaction(async (tx) => {
      if (parsed.data.decision === "APROVAR_PRODUCAO" && approvedVersion) {
        const [createdOrder] = await tx
          .insert(productionOrdersTable)
          .values({
            ticketId: ticket.id,
            clientId: ticket.clientId,
            product: ticket.product,
            quantity: ticket.quantity,
            format: ticket.format,
            material: ticket.material,
            colors: ticket.colors,
            finishing: ticket.finishing,
            dueDate: ticket.dueDate,
            amount: ticket.amount,
            approvedVersion: approvedVersion.version,
            approvedFileName: approvedVersion.fileName,
            approvedObjectPath: approvedVersion.objectPath,
            status: "A_PRODUZIR",
            currentStage: "PRE_IMPRESSAO",
          })
          .returning();
        const orderCode = `OP-${new Intl.DateTimeFormat("en", {
          year: "numeric",
          timeZone: "Africa/Luanda",
        }).format(new Date())}-${String(createdOrder.id).padStart(6, "0")}`;
        await tx
          .update(productionOrdersTable)
          .set({ orderCode })
          .where(eq(productionOrdersTable.id, createdOrder.id));
        await tx.insert(productionStagesTable).values(
          ["PRE_IMPRESSAO", "IMPRESSAO", "ACABAMENTO", "EMBALAGEM"].map(
            (stage) => ({
              orderId: createdOrder.id,
              stage,
              status: stage === "PRE_IMPRESSAO" ? "PENDENTE" : "PENDENTE",
            }),
          ),
        );
        await tx.insert(timelineEventsTable).values([
          eventValues({
            ticketId: ticket.id,
            ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
            actorId: staff.id,
            actorName: staff.name,
            action: "GESTAO_APROVOU_PRODUCAO",
            previousState: ticket.status,
            newState: "OP_CRIADA",
            note: parsed.data.comment,
            orderId: createdOrder.id,
          }),
          eventValues({
            ticketId: ticket.id,
            ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
            actorId: null,
            actorName: "Sistema",
            action: "OP_CRIADA_AUTOMATICAMENTE",
            previousState: null,
            newState: "A_PRODUZIR",
            note: `${orderCode} criada a partir do ticket ${ticket.ticketCode}.`,
            orderId: createdOrder.id,
          }),
        ]);
        await tx
          .update(ticketsTable)
          .set({ status: "OP_CRIADA" })
          .where(eq(ticketsTable.id, ticket.id));
        return;
      }

      const nextStatus =
        parsed.data.decision === "DEVOLVER" ? "EM_DESIGN" : "CANCELADO";
      await tx
        .update(ticketsTable)
        .set({ status: nextStatus })
        .where(eq(ticketsTable.id, ticket.id));
      await tx.insert(timelineEventsTable).values(
        eventValues({
          ticketId: ticket.id,
          ticketCode: ticket.ticketCode ?? `PG-${ticket.id}`,
          actorId: staff.id,
          actorName: staff.name,
          action:
            parsed.data.decision === "DEVOLVER"
              ? "GESTAO_DEVOLVEU"
              : "GESTAO_CANCELA",
          previousState: ticket.status,
          newState: nextStatus,
          note: parsed.data.comment,
        }),
      );
    });

    const details = await getTicketDetails(ticket.id);
    res.json(DecideTicketProductionResponse.parse(details));
  },
);

router.get("/team", async (req: Request, res: Response) => {
  const requester = await requireStaff(req, res);
  if (!requester) return;
  const members = await db
    .select({
      id: staffTable.id,
      name: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      role: staffTable.role,
      createdAt: staffTable.createdAt,
    })
    .from(staffTable)
    .innerJoin(usersTable, eq(usersTable.id, staffTable.id))
    .orderBy(asc(staffTable.createdAt));
  res.json(
      ListTeamMembersResponse.parse(
      members.map(({ name, lastName, email, ...member }) => ({
        ...member,
        name: [name, lastName].filter(Boolean).join(" ") || email || "Colaborador",
        email,
      })),
    ),
  );
});

router.patch("/team/:staffId/role", async (req: Request, res: Response) => {
  const requester = await requireRole(req, res, ["ADMIN"]);
  if (!requester) return;
  const params = UpdateTeamRoleParams.safeParse(req.params);
  const parsed = UpdateTeamRoleBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
    return;
  }
  const [member] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.id, params.data.staffId));
  if (!member) {
    res.status(404).json({ error: "Colaborador não encontrado." });
    return;
  }
  if (member.role === "ADMIN" && parsed.data.role !== "ADMIN") {
    const [admins] = await db
      .select({ value: count() })
      .from(staffTable)
      .where(eq(staffTable.role, "ADMIN"));
    if (Number(admins.value) <= 1) {
      res.status(400).json({ error: "O sistema precisa de pelo menos um administrador." });
      return;
    }
  }
  const [updated] = await db
    .update(staffTable)
    .set({ role: parsed.data.role })
    .where(eq(staffTable.id, member.id))
    .returning();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, updated.id));
  req.log.info(
    {
      actorId: requester.id,
      staffId: updated.id,
      previousRole: member.role,
      newRole: updated.role,
    },
    "Team member role updated",
  );
  const response = UpdateTeamRoleResponse.parse({
    id: updated.id,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Colaborador",
    email: user?.email ?? null,
    role: updated.role,
    createdAt: updated.createdAt,
  });
  res.json(response);
});

export default router;

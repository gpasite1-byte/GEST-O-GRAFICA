import { Readable } from "node:stream";
import { and, eq, isNull } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  DecideSampleApprovalBody,
  DecideSampleApprovalParams,
  DecideSampleApprovalResponse,
  GetSampleApprovalParams,
  GetSampleApprovalResponse,
} from "@workspace/api-zod";
import {
  approvalLinksTable,
  artworkVersionsTable,
  clientsTable,
  db,
  ticketsTable,
  timelineEventsTable,
} from "@workspace/db";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

async function findApproval(token: string) {
  const [row] = await db
    .select({
      link: approvalLinksTable,
      version: artworkVersionsTable,
      ticket: ticketsTable,
      client: clientsTable,
    })
    .from(approvalLinksTable)
    .innerJoin(
      artworkVersionsTable,
      eq(artworkVersionsTable.id, approvalLinksTable.versionId),
    )
    .innerJoin(ticketsTable, eq(ticketsTable.id, approvalLinksTable.ticketId))
    .innerJoin(clientsTable, eq(clientsTable.id, ticketsTable.clientId))
    .where(eq(approvalLinksTable.token, token));
  if (!row || row.link.expiresAt < new Date()) return null;
  return row;
}

function approvalPayload(row: NonNullable<Awaited<ReturnType<typeof findApproval>>>) {
  return {
    ticketCode: row.ticket.ticketCode ?? `PG-${row.ticket.id}`,
    clientName: row.client.name,
    company: row.client.company,
    product: row.ticket.product,
    quantity: row.ticket.quantity,
    dueDate: row.ticket.dueDate,
    version: row.version.version,
    fileName: row.version.fileName,
    contentType: row.version.contentType,
    status: row.version.status,
    submittedAt: row.version.createdAt,
    decisionComment: row.version.decisionComment,
  };
}

router.get("/approvals/:token", async (req: Request, res: Response) => {
  const params = GetSampleApprovalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await findApproval(params.data.token);
  if (!row) {
    res.status(404).json({ error: "Link de aprovação não encontrado ou expirado." });
    return;
  }
  res.json(GetSampleApprovalResponse.parse(approvalPayload(row)));
});

router.get("/approvals/:token/file", async (req: Request, res: Response) => {
  const params = GetSampleApprovalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await findApproval(params.data.token);
  if (!row) {
    res.status(404).json({ error: "Link de aprovação não encontrado ou expirado." });
    return;
  }
  try {
    const file = await objectStorage.getObjectEntityFile(row.version.objectPath);
    const response = await objectStorage.downloadObject(file, 300);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Content-Disposition", "inline");
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Ficheiro da amostra não encontrado." });
      return;
    }
    req.log.error({ err: error }, "Could not serve sample approval file");
    res.status(500).json({ error: "Não foi possível abrir a amostra." });
  }
});

router.post(
  "/approvals/:token/decision",
  async (req: Request, res: Response) => {
    const params = DecideSampleApprovalParams.safeParse(req.params);
    const parsed = DecideSampleApprovalBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: params.error?.message ?? parsed.error?.message });
      return;
    }
    const row = await findApproval(params.data.token);
    if (!row) {
      res.status(404).json({ error: "Link de aprovação não encontrado ou expirado." });
      return;
    }
    if (
      row.link.usedAt ||
      row.version.status !== "AGUARDA_APROVACAO"
    ) {
      res.status(400).json({ error: "Esta amostra já recebeu uma decisão." });
      return;
    }
    const approved = parsed.data.decision === "APROVAR";
    const nextTicketStatus = approved
      ? "AGUARDA_APROVACAO_GESTAO"
      : "AMOSTRA_REJEITADA";
    const decisionTime = new Date();
    const [consumed] = await db.transaction(async (tx) => {
      const [locked] = await tx
        .update(approvalLinksTable)
        .set({ usedAt: decisionTime })
        .where(
          and(
            eq(approvalLinksTable.id, row.link.id),
            isNull(approvalLinksTable.usedAt),
          ),
        )
        .returning();
      if (!locked) return [];
      await tx
        .update(artworkVersionsTable)
        .set({
          status: approved ? "APROVADA" : "REJEITADA",
          decidedAt: decisionTime,
          decisionComment: parsed.data.comment ?? null,
        })
        .where(eq(artworkVersionsTable.id, row.version.id));
      await tx
        .update(ticketsTable)
        .set({ status: nextTicketStatus })
        .where(eq(ticketsTable.id, row.ticket.id));
      await tx.insert(timelineEventsTable).values({
        ticketId: row.ticket.id,
        orderId: null,
        actorId: null,
        actorName: parsed.data.approverName,
        action: approved ? "AMOSTRA_APROVADA" : "AMOSTRA_REJEITADA",
        previousState: row.ticket.status,
        newState: nextTicketStatus,
        note: parsed.data.comment ?? null,
        createdAt: decisionTime,
      });
      return [locked];
    });
    if (!consumed) {
      res.status(409).json({ error: "Esta amostra já recebeu uma decisão." });
      return;
    }
    const updated = await findApproval(params.data.token);
    if (!updated) {
      res.status(404).json({ error: "Link de aprovação não encontrado." });
      return;
    }
    res.json(DecideSampleApprovalResponse.parse(approvalPayload(updated)));
  },
);

export default router;

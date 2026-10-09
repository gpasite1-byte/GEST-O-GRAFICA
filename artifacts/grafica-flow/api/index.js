import pg from "pg";
const supabaseUrl = process.env.DATABASE_URL || "postgresql://postgres.czcptgunvyxdajotbyfb:923273590cRIS%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";
if (!globalThis.__dbPool) {
  globalThis.__dbPool = new pg.Pool({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 3e4
  });
}
const client = globalThis.__dbPool;
let activeUserId = "usr_admin";
function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  const urlStr = req.url || "";
  const [reqPath, queryString] = urlStr.split("?");
  const queryParams = new URLSearchParams(queryString || "");
  try {
    if (reqPath === "/api/auth/user" && req.method === "GET") {
      if (!activeUserId) {
        return sendJson(res, 200, { user: null });
      }
      const userRes = await client.query("SELECT * FROM users WHERE id = $1", [activeUserId]);
      const u = userRes.rows[0];
      if (!u) {
        return sendJson(res, 200, { user: null });
      }
      return sendJson(res, 200, {
        user: {
          id: u.id,
          email: u.email,
          firstName: u.first_name,
          lastName: u.last_name,
          profileImageUrl: u.profile_image_url
        }
      });
    }
    if (reqPath === "/api/auth/switch" && req.method === "POST") {
      const body = await parseBody(req);
      const targetId = body.userId;
      if (targetId) {
        const userRes = await client.query("SELECT * FROM users WHERE id = $1", [targetId]);
        if (userRes.rows.length > 0) {
          activeUserId = targetId;
          const u = userRes.rows[0];
          return sendJson(res, 200, {
            success: true,
            user: {
              id: u.id,
              email: u.email,
              firstName: u.first_name,
              lastName: u.last_name,
              profileImageUrl: u.profile_image_url
            }
          });
        }
      }
      return sendJson(res, 400, { error: "Utilizador n\xE3o encontrado" });
    }
    if (reqPath === "/api/login") {
      const userId = queryParams.get("userId") || "usr_admin";
      activeUserId = userId;
      const returnTo = queryParams.get("returnTo") || "/";
      res.writeHead(302, { Location: returnTo });
      return res.end();
    }
    if (reqPath === "/api/logout") {
      activeUserId = "";
      const returnTo = queryParams.get("returnTo") || "/";
      res.writeHead(302, { Location: returnTo });
      return res.end();
    }
    if (reqPath === "/api/team" && req.method === "GET") {
      const teamRes = await client.query(`
              SELECT s.id, s.role, s.created_at, u.first_name, u.last_name, u.email 
              FROM staff_members s 
              LEFT JOIN users u ON s.id = u.id
              ORDER BY s.created_at ASC
            `);
      const members = teamRes.rows.map((row) => ({
        id: row.id,
        name: `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at
      }));
      return sendJson(res, 200, members);
    }
    const teamRoleMatch = reqPath.match(/^\/api\/team\/([^/]+)\/role$/);
    if (teamRoleMatch && (req.method === "PATCH" || req.method === "POST")) {
      const staffId = teamRoleMatch[1];
      const body = await parseBody(req);
      await client.query("UPDATE staff_members SET role = $1, updated_at = NOW() WHERE id = $2", [body.role, staffId]);
      return sendJson(res, 200, { id: staffId, role: body.role });
    }
    if (reqPath === "/api/clients") {
      if (req.method === "GET") {
        const search = queryParams.get("search")?.toLowerCase();
        let clientsRes;
        if (search) {
          clientsRes = await client.query(
            `SELECT * FROM clients WHERE LOWER(name) LIKE $1 OR LOWER(company) LIKE $1 ORDER BY id DESC`,
            [`%${search}%`]
          );
        } else {
          clientsRes = await client.query("SELECT * FROM clients ORDER BY id DESC");
        }
        const list = clientsRes.rows.map((c) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          contact: c.contact,
          email: c.email,
          phone: c.phone,
          createdAt: c.created_at
        }));
        return sendJson(res, 200, list);
      }
      if (req.method === "POST") {
        const body = await parseBody(req);
        const insertRes = await client.query(
          `INSERT INTO clients (name, company, contact, email, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [body.name, body.company || null, body.contact || null, body.email || null, body.phone || null]
        );
        const c = insertRes.rows[0];
        return sendJson(res, 201, {
          id: c.id,
          name: c.name,
          company: c.company,
          contact: c.contact,
          email: c.email,
          phone: c.phone,
          createdAt: c.created_at
        });
      }
    }
    if (reqPath === "/api/admin/system-stats" && req.method === "GET") {
      const t0 = Date.now();
      let vRes = { rows: [{ version: "PostgreSQL 15 (Supabase Cloud)" }] };
      try {
        vRes = await client.query("SELECT version()");
      } catch {
      }
      const pingMs = Date.now() - t0;
      const tables = [
        "print_tickets",
        "production_orders",
        "production_stages",
        "timeline_events",
        "clients",
        "staff_members",
        "users",
        "artwork_versions",
        "quality_checks",
        "order_deliveries"
      ];
      const tableCounts = {};
      for (const t of tables) {
        try {
          const cr = await client.query(`SELECT COUNT(*) as count FROM ${t}`);
          tableCounts[t] = Number(cr.rows[0]?.count || 0);
        } catch {
          tableCounts[t] = 0;
        }
      }
      const mem = process.memoryUsage();
      return sendJson(res, 200, {
        database: {
          status: "ONLINE",
          engine: "PostgreSQL 15 (AWS Cloud)",
          host: "aws-0-eu-west-1.pooler.supabase.com",
          port: 6543,
          region: "eu-west-1 (Irlanda)",
          latencyMs: pingMs,
          fullVersion: vRes.rows[0]?.version || "PostgreSQL 15",
          poolerMode: "Transaction Pooler (Supabase Supavisor)",
          ssl: true
        },
        system: {
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          memoryRssMb: Math.round(mem.rss / 1024 / 1024),
          memoryHeapMb: Math.round(mem.heapUsed / 1024 / 1024),
          activeUserId
        },
        counts: tableCounts,
        authProviders: {
          supabase: true,
          googleOAuth: {
            supported: true,
            redirectUri: "https://czcptgunvyxdajotbyfb.supabase.co/auth/v1/callback",
            docsUrl: "https://supabase.com/docs/guides/auth/social-login/auth-google"
          }
        }
      });
    }
    if (reqPath === "/api/admin/users") {
      if (req.method === "GET") {
        const list = await client.query(`
                SELECT u.id, u.email, u.first_name, u.last_name, u.profile_image_url, u.created_at, COALESCE(s.role, 'ATENDIMENTO') as role 
                FROM users u 
                LEFT JOIN staff_members s ON u.id = s.id 
                ORDER BY u.created_at ASC
              `);
        return sendJson(res, 200, list.rows);
      }
      if (req.method === "POST") {
        const body = await parseBody(req);
        const email = (body.email || "").trim().toLowerCase();
        const firstName = (body.firstName || "").trim();
        const lastName = (body.lastName || "").trim();
        const role = body.role || "ATENDIMENTO";
        if (!email || !firstName) {
          return sendJson(res, 400, { error: "Email e Nome s\xE3o obrigat\xF3rios." });
        }
        const id = "usr_" + Math.random().toString(36).substring(2, 9);
        await client.query("INSERT INTO users (id, email, first_name, last_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())", [id, email, firstName, lastName]);
        await client.query("INSERT INTO staff_members (id, role, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET role = $2", [id, role]);
        return sendJson(res, 201, { success: true, user: { id, email, firstName, lastName, role } });
      }
    }
    const userDeleteMatch = reqPath.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userDeleteMatch && req.method === "DELETE") {
      const targetId = userDeleteMatch[1];
      if (targetId === "usr_admin") {
        return sendJson(res, 403, { error: "N\xE3o \xE9 permitido eliminar o Administrador Gestor principal." });
      }
      await client.query("DELETE FROM staff_members WHERE id = $1", [targetId]);
      await client.query("DELETE FROM users WHERE id = $1", [targetId]);
      return sendJson(res, 200, { success: true, deletedId: targetId });
    }
    if (reqPath === "/api/admin/backup" && req.method === "GET") {
      const clients = await client.query("SELECT * FROM clients ORDER BY id ASC");
      const tickets = await client.query("SELECT * FROM print_tickets ORDER BY id ASC");
      const orders = await client.query("SELECT * FROM production_orders ORDER BY id ASC");
      const stages = await client.query("SELECT * FROM production_stages ORDER BY id ASC");
      const events = await client.query("SELECT * FROM timeline_events ORDER BY id ASC");
      const staff = await client.query("SELECT * FROM staff_members ORDER BY id ASC");
      const users = await client.query("SELECT * FROM users ORDER BY id ASC");
      const artworks = await client.query("SELECT * FROM artwork_versions ORDER BY id ASC");
      const checks = await client.query("SELECT * FROM quality_checks ORDER BY id ASC");
      const deliveries = await client.query("SELECT * FROM order_deliveries ORDER BY id ASC");
      const backupData = {
        metadata: {
          system: "Gr\xE1fica Flow Enterprise ERP",
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          exportBy: activeUserId,
          database: "Supabase PostgreSQL (eu-west-1 Irlanda)",
          totalRecords: (clients.rowCount || 0) + (tickets.rowCount || 0) + (orders.rowCount || 0) + (stages.rowCount || 0) + (events.rowCount || 0) + (staff.rowCount || 0) + (users.rowCount || 0)
        },
        clients: clients.rows,
        print_tickets: tickets.rows,
        production_orders: orders.rows,
        production_stages: stages.rows,
        timeline_events: events.rows,
        staff_members: staff.rows,
        users: users.rows,
        artwork_versions: artworks.rows,
        quality_checks: checks.rows,
        order_deliveries: deliveries.rows
      };
      return sendJson(res, 200, backupData);
    }
    if (reqPath === "/api/admin/audit-logs" && req.method === "GET") {
      const limit = Math.min(Number(queryParams.get("limit") || 50), 200);
      const auditRes = await client.query(`
              SELECT e.*, t.ticket_code 
              FROM timeline_events e
              LEFT JOIN print_tickets t ON e.ticket_id = t.id
              ORDER BY e.id DESC
              LIMIT $1
            `, [limit]);
      return sendJson(res, 200, auditRes.rows);
    }
    if (reqPath === "/api/auth/register" && req.method === "POST") {
      const body = await parseBody(req);
      const email = (body.email || "").trim().toLowerCase();
      const firstName = (body.firstName || "").trim();
      const lastName = (body.lastName || "").trim();
      const role = body.role || "ATENDIMENTO";
      if (!email || !firstName) {
        return sendJson(res, 400, { error: "Email e Nome s\xE3o obrigat\xF3rios." });
      }
      const existing = await client.query("SELECT * FROM users WHERE email = $1", [email]);
      let userId = "";
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        await client.query("UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW() WHERE id = $3", [firstName, lastName, userId]);
      } else {
        userId = "usr_" + Math.random().toString(36).substring(2, 10);
        await client.query("INSERT INTO users (id, email, first_name, last_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())", [userId, email, firstName, lastName]);
        await client.query("INSERT INTO staff_members (id, role, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET role = $2", [userId, role]);
      }
      activeUserId = userId;
      return sendJson(res, 200, { success: true, userId, user: { id: userId, email, firstName, lastName } });
    }
    if (reqPath === "/api/auth/supabase-login" && req.method === "POST") {
      const body = await parseBody(req);
      const email = (body.email || "").trim().toLowerCase();
      const rawId = body.id || "usr_sb_" + Math.random().toString(36).substring(2, 8);
      const firstName = body.firstName || email.split("@")[0] || "Utilizador";
      const lastName = body.lastName || "";
      const profileImageUrl = body.profileImageUrl || null;
      const role = body.role || "ATENDIMENTO";
      if (!email) {
        return sendJson(res, 400, { error: "Email obrigat\xF3rio do provedor Supabase." });
      }
      const existing = await client.query("SELECT * FROM users WHERE email = $1 OR id = $2", [email, rawId]);
      let userId = rawId;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        await client.query(
          "UPDATE users SET profile_image_url = COALESCE($1, profile_image_url), updated_at = NOW() WHERE id = $2",
          [profileImageUrl, userId]
        );
      } else {
        await client.query(
          "INSERT INTO users (id, email, first_name, last_name, profile_image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
          [userId, email, firstName, lastName, profileImageUrl]
        );
        await client.query(
          "INSERT INTO staff_members (id, role, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING",
          [userId, role]
        );
      }
      activeUserId = userId;
      const finalUser = await client.query("SELECT u.*, s.role FROM users u LEFT JOIN staff_members s ON u.id = s.id WHERE u.id = $1", [userId]);
      return sendJson(res, 200, { success: true, user: finalUser.rows[0] });
    }
    if (reqPath === "/api/admin/reset" && req.method === "POST") {
      await client.query("DELETE FROM timeline_events");
      await client.query("DELETE FROM order_deliveries");
      await client.query("DELETE FROM quality_checks");
      await client.query("DELETE FROM production_stages");
      await client.query("DELETE FROM production_orders");
      await client.query("DELETE FROM sample_approval_links");
      await client.query("DELETE FROM artwork_versions");
      await client.query("DELETE FROM print_tickets");
      return sendJson(res, 200, { success: true, message: "Opera\xE7\xF5es resetadas para zero!" });
    }
    if (reqPath === "/api/dashboard" && req.method === "GET") {
      const openRes = await client.query("SELECT COUNT(*) as count FROM print_tickets WHERE status NOT IN ('ENTREGUE', 'CANCELADO')");
      const designRes = await client.query("SELECT COUNT(*) as count FROM print_tickets WHERE status = 'EM_DESIGN'");
      const sampleRes = await client.query("SELECT COUNT(*) as count FROM print_tickets WHERE status = 'AGUARDA_APROVACAO_AMOSTRA'");
      const mgmtRes = await client.query("SELECT COUNT(*) as count FROM print_tickets WHERE status = 'AGUARDA_APROVACAO_GESTAO'");
      const prodRes = await client.query("SELECT COUNT(*) as count FROM production_orders WHERE status = 'EM_PRODUCAO'");
      const finishRes = await client.query("SELECT COUNT(*) as count FROM production_orders WHERE current_stage = 'ACABAMENTO'");
      const readyRes = await client.query("SELECT COUNT(*) as count FROM production_orders WHERE status = 'PRONTO_PARA_ENTREGA'");
      const overdueRes = await client.query("SELECT COUNT(*) as count FROM print_tickets WHERE due_date < CURRENT_DATE AND status NOT IN ('ENTREGUE', 'CANCELADO')");
      const deliveredRes = await client.query("SELECT COUNT(*) as count FROM print_tickets WHERE status = 'ENTREGUE' AND DATE(updated_at) = CURRENT_DATE");
      const activityRes = await client.query("SELECT e.*, t.ticket_code FROM timeline_events e JOIN print_tickets t ON e.ticket_id = t.id ORDER BY e.id DESC LIMIT 12");
      return sendJson(res, 200, {
        openTickets: Number(openRes.rows[0]?.count || 0),
        inDesign: Number(designRes.rows[0]?.count || 0),
        awaitingSample: Number(sampleRes.rows[0]?.count || 0),
        awaitingManagement: Number(mgmtRes.rows[0]?.count || 0),
        inProduction: Number(prodRes.rows[0]?.count || 0),
        finishing: Number(finishRes.rows[0]?.count || 0),
        readyForDelivery: Number(readyRes.rows[0]?.count || 0),
        overdue: Number(overdueRes.rows[0]?.count || 0),
        deliveredToday: Number(deliveredRes.rows[0]?.count || 0),
        averageApprovalMinutes: 0,
        averageProductionMinutes: 0,
        recentActivity: activityRes.rows.map((a) => ({
          id: a.id,
          ticketId: a.ticket_id,
          ticketCode: a.ticket_code,
          orderId: a.order_id,
          actorName: a.actor_name,
          action: a.action,
          previousState: a.previous_state,
          newState: a.new_state,
          note: a.note,
          createdAt: a.created_at
        }))
      });
    }
    if (reqPath === "/api/activity" && req.method === "GET") {
      const activityRes = await client.query("SELECT e.*, t.ticket_code FROM timeline_events e JOIN print_tickets t ON e.ticket_id = t.id ORDER BY e.id DESC LIMIT 20");
      const activities = activityRes.rows.map((a) => ({
        id: a.id,
        ticketId: a.ticket_id,
        ticketCode: a.ticket_code,
        orderId: a.order_id,
        actorName: a.actor_name,
        action: a.action,
        previousState: a.previous_state,
        newState: a.new_state,
        note: a.note,
        createdAt: a.created_at
      }));
      return sendJson(res, 200, activities);
    }
    if (reqPath === "/api/tickets") {
      if (req.method === "GET") {
        const status = queryParams.get("status");
        const search = queryParams.get("search")?.toLowerCase();
        let query = `
                SELECT t.*, c.name as client_name, c.company as company, 
                       (SELECT id FROM production_orders WHERE ticket_id = t.id LIMIT 1) as order_id
                FROM print_tickets t 
                JOIN clients c ON t.client_id = c.id
              `;
        const params = [];
        if (status) {
          params.push(status);
          query += ` WHERE t.status = $${params.length}`;
        }
        query += " ORDER BY t.id DESC";
        const ticketsRes = await client.query(query, params);
        let list = ticketsRes.rows.map((t) => ({
          id: t.id,
          ticketCode: t.ticket_code,
          status: t.status,
          clientName: t.client_name,
          company: t.company,
          product: t.product,
          quantity: t.quantity,
          dueDate: t.due_date,
          priority: t.priority,
          amount: t.amount ? Number(t.amount) : null,
          responsible: t.responsible,
          orderId: t.order_id,
          createdAt: t.created_at,
          updatedAt: t.updated_at
        }));
        if (search) {
          list = list.filter(
            (item) => item.product?.toLowerCase().includes(search) || item.clientName?.toLowerCase().includes(search) || item.ticketCode?.toLowerCase().includes(search)
          );
        }
        return sendJson(res, 200, list);
      }
      if (req.method === "POST") {
        const body = await parseBody(req);
        const countRes = await client.query("SELECT COUNT(*) as count FROM print_tickets");
        const newNum = Number(countRes.rows[0]?.count || 0) + 1;
        const code = `TCK-2026-${String(newNum).padStart(3, "0")}`;
        const insertRes = await client.query(`
                INSERT INTO print_tickets (
                  ticket_code, client_id, product, description, quantity,
                  format, material, colors, finishing, due_date, priority,
                  amount, responsible, observations, files, created_by, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'NOVO')
                RETURNING *
              `, [
          code,
          body.clientId,
          body.product,
          body.description,
          Number(body.quantity || 1),
          body.format || null,
          body.material || null,
          body.colors || null,
          body.finishing || null,
          body.dueDate ? body.dueDate.split("T")[0] : "2026-10-15",
          body.priority || "NORMAL",
          body.amount ? Number(body.amount) : null,
          body.responsible || null,
          body.observations || null,
          JSON.stringify(body.files || []),
          "usr_admin"
        ]);
        const t = insertRes.rows[0];
        await client.query(`
                INSERT INTO timeline_events (
                  ticket_id, actor_name, action, new_state, note
                ) VALUES ($1, $2, $3, $4, $5)
              `, [t.id, "Gestor Produ\xE7\xE3o", "Abertura de Pedido", "NOVO", "Pedido gravado no banco de dados."]);
        return sendJson(res, 201, {
          id: t.id,
          ticketCode: t.ticket_code,
          clientId: t.client_id,
          status: t.status,
          product: t.product,
          quantity: t.quantity,
          dueDate: t.due_date,
          priority: t.priority,
          amount: t.amount ? Number(t.amount) : null,
          createdAt: t.created_at,
          updatedAt: t.updated_at
        });
      }
    }
    const ticketDetailMatch = reqPath.match(/^\/api\/tickets\/(\d+)$/);
    if (ticketDetailMatch && req.method === "GET") {
      const ticketId = Number(ticketDetailMatch[1]);
      const tRes = await client.query(`
              SELECT t.*, c.name as client_name, c.company as company, c.contact as contact, c.email as email, c.phone as phone,
                     (SELECT id FROM production_orders WHERE ticket_id = t.id LIMIT 1) as order_id
              FROM print_tickets t
              JOIN clients c ON t.client_id = c.id
              WHERE t.id = $1
            `, [ticketId]);
      if (tRes.rows.length === 0) {
        return sendJson(res, 404, { message: "Ticket n\xE3o encontrado" });
      }
      const t = tRes.rows[0];
      const vRes = await client.query("SELECT * FROM artwork_versions WHERE ticket_id = $1 ORDER BY version DESC", [ticketId]);
      const eRes = await client.query("SELECT e.*, t.ticket_code FROM timeline_events e JOIN print_tickets t ON e.ticket_id = t.id WHERE e.ticket_id = $1 ORDER BY e.id DESC", [ticketId]);
      const linkRes = await client.query("SELECT token FROM sample_approval_links WHERE ticket_id = $1 AND used_at IS NULL ORDER BY id DESC LIMIT 1", [ticketId]);
      const versions = vRes.rows.map((v) => ({
        id: v.id,
        version: v.version,
        fileName: v.file_name,
        objectPath: v.object_path,
        fileSize: v.file_size,
        contentType: v.content_type,
        status: v.status,
        notes: v.notes,
        createdBy: v.created_by,
        createdAt: v.created_at,
        decidedAt: v.decided_at,
        decisionComment: v.decision_comment
      }));
      const events = eRes.rows.map((e) => ({
        id: e.id,
        ticketId: e.ticket_id,
        ticketCode: e.ticket_code,
        orderId: e.order_id,
        actorName: e.actor_name,
        action: e.action,
        previousState: e.previous_state,
        newState: e.new_state,
        note: e.note,
        createdAt: e.created_at
      }));
      return sendJson(res, 200, {
        id: t.id,
        ticketCode: t.ticket_code,
        clientId: t.client_id,
        clientName: t.client_name,
        company: t.company,
        contact: t.contact,
        email: t.email,
        phone: t.phone,
        product: t.product,
        description: t.description,
        format: t.format,
        material: t.material,
        colors: t.colors,
        finishing: t.finishing,
        observations: t.observations,
        quantity: t.quantity,
        status: t.status,
        priority: t.priority,
        amount: t.amount ? Number(t.amount) : null,
        responsible: t.responsible,
        createdBy: t.created_by,
        assignedDesigner: t.assigned_designer,
        orderId: t.order_id,
        sampleApprovalUrl: linkRes.rows[0] ? `/aprovar/${linkRes.rows[0].token}` : null,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        dueDate: t.due_date,
        versions,
        events
      });
    }
    const analyzeMatch = reqPath.match(/^\/api\/tickets\/(\d+)\/analyze$/);
    if (analyzeMatch && req.method === "POST") {
      const ticketId = Number(analyzeMatch[1]);
      const body = await parseBody(req);
      const tRes = await client.query("SELECT * FROM print_tickets WHERE id = $1", [ticketId]);
      if (tRes.rows.length === 0) return sendJson(res, 404, { message: "Ticket n\xE3o encontrado" });
      const t = tRes.rows[0];
      let newStatus = t.status;
      let assignedDesigner = t.assigned_designer;
      if (body.decision === "APROVAR_DESIGN") {
        newStatus = "EM_DESIGN";
        assignedDesigner = body.assignedDesigner || "Mateus Designer";
      } else if (body.decision === "PEDIR_INFO") {
        newStatus = "AGUARDA_INFORMACAO";
      } else if (body.decision === "RECUSAR") {
        newStatus = "RECUSADO";
      }
      await client.query(`
              UPDATE print_tickets 
              SET status = $1, assigned_designer = $2, updated_at = NOW() 
              WHERE id = $3
            `, [newStatus, assignedDesigner, ticketId]);
      await client.query(`
              INSERT INTO timeline_events (
                ticket_id, actor_name, action, previous_state, new_state, note
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [ticketId, "Gestor Produ\xE7\xE3o", `An\xE1lise: ${body.decision}`, t.status, newStatus, body.notes || "An\xE1lise de viabilidade realizada."]);
      return sendJson(res, 200, { id: ticketId, status: newStatus });
    }
    const artworkMatch = reqPath.match(/^\/api\/tickets\/(\d+)\/artwork$/);
    if (artworkMatch && req.method === "POST") {
      const ticketId = Number(artworkMatch[1]);
      const body = await parseBody(req);
      const tRes = await client.query("SELECT * FROM print_tickets WHERE id = $1", [ticketId]);
      if (tRes.rows.length === 0) return sendJson(res, 404, { message: "Ticket n\xE3o encontrado" });
      const t = tRes.rows[0];
      const countV = await client.query("SELECT COUNT(*) as count FROM artwork_versions WHERE ticket_id = $1", [ticketId]);
      const verNum = Number(countV.rows[0]?.count || 0) + 1;
      const token = `tok-sample-${ticketId}-${verNum}`;
      const insertV = await client.query(`
              INSERT INTO artwork_versions (
                ticket_id, version, file_name, object_path, file_size, content_type, notes, created_by, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDENTE')
              RETURNING *
            `, [
        ticketId,
        verNum,
        body.fileName || `Arte_v${verNum}.pdf`,
        body.objectPath || `/uploads/arte_${ticketId}_v${verNum}.pdf`,
        body.fileSize || 5e6,
        "application/pdf",
        body.notes || "Amostra enviada para aprova\xE7\xE3o.",
        "Mateus Designer"
      ]);
      await client.query(`
              INSERT INTO sample_approval_links (ticket_id, version_id, token, expires_at)
              VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')
            `, [ticketId, insertV.rows[0].id, token]);
      await client.query(`
              UPDATE print_tickets SET status = 'AGUARDA_APROVACAO_AMOSTRA', updated_at = NOW() WHERE id = $1
            `, [ticketId]);
      await client.query(`
              INSERT INTO timeline_events (
                ticket_id, ticket_code, actor_name, action, previous_state, new_state, note
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [ticketId, "Mateus Designer", `Envio da Arte v${verNum}`, t.status, "AGUARDA_APROVACAO_AMOSTRA", "Amostra digital enviada ao cliente."]);
      return sendJson(res, 201, {
        version: verNum,
        sampleApprovalUrl: `/aprovar/${token}`
      });
    }
    const decisionMatch = reqPath.match(/^\/api\/tickets\/(\d+)\/decision$/);
    if (decisionMatch && req.method === "POST") {
      const ticketId = Number(decisionMatch[1]);
      const body = await parseBody(req);
      const tRes = await client.query("SELECT * FROM print_tickets WHERE id = $1", [ticketId]);
      if (tRes.rows.length === 0) return sendJson(res, 404, { message: "Ticket n\xE3o encontrado" });
      const t = tRes.rows[0];
      if (body.decision === "APROVADO" || body.decision === "APROVAR") {
        const opCountRes = await client.query("SELECT COUNT(*) as count FROM production_orders");
        const opNum = Number(opCountRes.rows[0]?.count || 0) + 1;
        const opCode = `OP-2026-${String(opNum).padStart(3, "0")}`;
        const opRes = await client.query(`
                INSERT INTO production_orders (
                  order_code, ticket_id, client_id, product, quantity, format,
                  material, colors, finishing, due_date, amount, approved_version,
                  approved_file_name, approved_object_path, status, current_stage
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'A_PRODUZIR', 'PRE_IMPRESSAO')
                RETURNING *
              `, [
          opCode,
          t.id,
          t.client_id,
          t.product,
          t.quantity,
          t.format,
          t.material,
          t.colors,
          t.finishing,
          t.due_date,
          t.amount,
          1,
          "Arte_Final_Aprovada.pdf",
          "/uploads/arte_final.pdf"
        ]);
        const op = opRes.rows[0];
        await client.query(`
                INSERT INTO production_stages (order_id, stage, status, machine) VALUES
                ($1, 'PRE_IMPRESSAO', 'PENDENTE', 'CTP Agfa'),
                ($1, 'IMPRESSAO', 'PENDENTE', 'Heidelberg SM 74'),
                ($1, 'ACABAMENTO', 'PENDENTE', 'Guilhotina / Vincadora'),
                ($1, 'EMBALAGEM', 'PENDENTE', 'Mesa de Embalagem')
              `, [op.id]);
        await client.query(`
                INSERT INTO order_deliveries (order_id, method) VALUES ($1, 'ENTREGA_PROPRIA')
              `, [op.id]);
        await client.query("UPDATE print_tickets SET status = 'OP_CRIADA', updated_at = NOW() WHERE id = $1", [ticketId]);
        await client.query(`
                INSERT INTO timeline_events (
                  ticket_id, ticket_code, order_id, actor_name, action, previous_state, new_state, note
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `, [ticketId, op.id, "Gestor Produ\xE7\xE3o", "OP Gerada", t.status, "OP_CRIADA", `Ordem de Produ\xE7\xE3o ${opCode} emitida com sucesso.`]);
        return sendJson(res, 200, { id: ticketId, status: "OP_CRIADA", orderId: op.id });
      }
      if (body.decision === "DEVOLVER") {
        await client.query("UPDATE print_tickets SET status = 'EM_DESIGN', updated_at = NOW() WHERE id = $1", [ticketId]);
      } else if (body.decision === "CANCELAR") {
        await client.query("UPDATE print_tickets SET status = 'CANCELADO', updated_at = NOW() WHERE id = $1", [ticketId]);
      }
      return sendJson(res, 200, { id: ticketId, status: body.decision });
    }
    if (reqPath === "/api/orders" && req.method === "GET") {
      const status = queryParams.get("status");
      const stage = queryParams.get("stage");
      let query = `
              SELECT o.*, c.name as client_name, t.ticket_code
              FROM production_orders o
              JOIN clients c ON o.client_id = c.id
              JOIN print_tickets t ON o.ticket_id = t.id
            `;
      const params = [];
      const clauses = [];
      if (status) {
        params.push(status);
        clauses.push(`o.status = $${params.length}`);
      }
      if (stage) {
        params.push(stage);
        clauses.push(`o.current_stage = $${params.length}`);
      }
      if (clauses.length > 0) {
        query += " WHERE " + clauses.join(" AND ");
      }
      query += " ORDER BY o.id DESC";
      const ordersRes = await client.query(query, params);
      const list = ordersRes.rows.map((o) => ({
        id: o.id,
        orderCode: o.order_code,
        ticketId: o.ticket_id,
        ticketCode: o.ticket_code,
        clientName: o.client_name,
        product: o.product,
        quantity: o.quantity,
        status: o.status,
        currentStage: o.current_stage,
        dueDate: o.due_date,
        approvedVersion: o.approved_version,
        createdAt: o.created_at,
        updatedAt: o.updated_at
      }));
      return sendJson(res, 200, list);
    }
    const orderDetailMatch = reqPath.match(/^\/api\/orders\/(\d+)$/);
    if (orderDetailMatch && req.method === "GET") {
      const orderId = Number(orderDetailMatch[1]);
      const oRes = await client.query(`
              SELECT o.*, c.name as client_name, t.ticket_code
              FROM production_orders o
              JOIN clients c ON o.client_id = c.id
              JOIN print_tickets t ON o.ticket_id = t.id
              WHERE o.id = $1
            `, [orderId]);
      if (oRes.rows.length === 0) return sendJson(res, 404, { message: "Ordem n\xE3o encontrada" });
      const o = oRes.rows[0];
      const stagesRes = await client.query("SELECT * FROM production_stages WHERE order_id = $1 ORDER BY id ASC", [orderId]);
      const qcRes = await client.query("SELECT * FROM quality_checks WHERE order_id = $1 ORDER BY id DESC LIMIT 1", [orderId]);
      const delRes = await client.query("SELECT * FROM order_deliveries WHERE order_id = $1 ORDER BY id DESC LIMIT 1", [orderId]);
      const evRes = await client.query("SELECT e.*, t.ticket_code FROM timeline_events e JOIN print_tickets t ON e.ticket_id = t.id WHERE e.order_id = $1 ORDER BY e.id DESC", [orderId]);
      const stages = stagesRes.rows.map((s) => ({
        id: s.id,
        stage: s.stage,
        status: s.status,
        responsible: s.responsible,
        machine: s.machine,
        startedAt: s.started_at,
        completedAt: s.completed_at,
        quantityProduced: s.quantity_produced,
        waste: s.waste,
        notes: s.notes
      }));
      const qualityCheck = qcRes.rows[0] ? {
        id: qcRes.rows[0].id,
        checklist: qcRes.rows[0].checklist,
        decision: qcRes.rows[0].decision,
        notes: qcRes.rows[0].notes,
        checkedBy: qcRes.rows[0].checked_by,
        checkedAt: qcRes.rows[0].checked_at
      } : null;
      const delivery = delRes.rows[0] ? {
        method: delRes.rows[0].method,
        responsible: delRes.rows[0].responsible,
        dispatchAt: delRes.rows[0].dispatch_at,
        deliveredAt: delRes.rows[0].delivered_at,
        proof: delRes.rows[0].proof,
        signature: delRes.rows[0].signature,
        photoPath: delRes.rows[0].photo_path
      } : {
        method: "ENTREGA_PROPRIA",
        responsible: null,
        dispatchAt: null,
        deliveredAt: null,
        proof: null,
        signature: null,
        photoPath: null
      };
      const events = evRes.rows.map((e) => ({
        id: e.id,
        ticketId: e.ticket_id,
        ticketCode: e.ticket_code,
        orderId: e.order_id,
        actorName: e.actor_name,
        action: e.action,
        previousState: e.previous_state,
        newState: e.new_state,
        note: e.note,
        createdAt: e.created_at
      }));
      return sendJson(res, 200, {
        id: o.id,
        orderCode: o.order_code,
        ticketId: o.ticket_id,
        ticketCode: o.ticket_code,
        clientName: o.client_name,
        product: o.product,
        quantity: o.quantity,
        status: o.status,
        currentStage: o.current_stage,
        dueDate: o.due_date,
        approvedVersion: o.approved_version,
        approvedFileName: o.approved_file_name,
        approvedObjectPath: o.approved_object_path,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        stages,
        qualityCheck,
        delivery,
        events
      });
    }
    const orderStageMatch = reqPath.match(/^\/api\/orders\/(\d+)\/stage$/);
    if (orderStageMatch && req.method === "POST") {
      const orderId = Number(orderStageMatch[1]);
      const body = await parseBody(req);
      const oRes = await client.query("SELECT * FROM production_orders WHERE id = $1", [orderId]);
      if (oRes.rows.length === 0) return sendJson(res, 404, { message: "Ordem n\xE3o encontrada" });
      const o = oRes.rows[0];
      if (body.action === "INICIAR") {
        await client.query(`
                UPDATE production_stages 
                SET status = 'EM_CURSO', started_at = NOW(), responsible = $1, machine = COALESCE($2, machine)
                WHERE order_id = $3 AND stage = $4
              `, [body.responsible || "Jo\xE3o Baptista", body.machine || null, orderId, body.stage]);
        await client.query(`
                UPDATE production_orders SET status = 'EM_PRODUCAO', current_stage = $1, updated_at = NOW() WHERE id = $2
              `, [body.stage, orderId]);
      } else if (body.action === "CONCLUIR") {
        await client.query(`
                UPDATE production_stages 
                SET status = 'CONCLUIDO', completed_at = NOW(), quantity_produced = $1, waste = $2, notes = $3
                WHERE order_id = $4 AND stage = $5
              `, [body.quantityProduced || o.quantity, body.waste || 0, body.notes || null, orderId, body.stage]);
        const stageOrder = ["PRE_IMPRESSAO", "IMPRESSAO", "ACABAMENTO", "EMBALAGEM"];
        const currentIdx = stageOrder.indexOf(body.stage);
        if (currentIdx >= 0 && currentIdx < stageOrder.length - 1) {
          const nextStage = stageOrder[currentIdx + 1];
          await client.query("UPDATE production_orders SET current_stage = $1, updated_at = NOW() WHERE id = $2", [nextStage, orderId]);
        } else {
          await client.query("UPDATE production_orders SET current_stage = 'CONTROLO_QUALIDADE', status = 'AGUARDA_CONTROLO_QUALIDADE', updated_at = NOW() WHERE id = $1", [orderId]);
        }
      }
      await client.query(`
              INSERT INTO timeline_events (
                ticket_id, order_id, actor_name, action, note
              ) VALUES ($1, $2, $3, $4, $5)
            `, [o.ticket_id, orderId, "Jo\xE3o Baptista", `${body.action === "INICIAR" ? "In\xEDcio de" : "Conclus\xE3o de"} ${body.stage}`, body.notes || `Etapa ${body.stage} actualizada no banco de dados.`]);
      return sendJson(res, 200, { success: true });
    }
    const orderQualityMatch = reqPath.match(/^\/api\/orders\/(\d+)\/quality$/);
    if (orderQualityMatch && req.method === "POST") {
      const orderId = Number(orderQualityMatch[1]);
      const body = await parseBody(req);
      const oRes = await client.query("SELECT * FROM production_orders WHERE id = $1", [orderId]);
      if (oRes.rows.length === 0) return sendJson(res, 404, { message: "Ordem n\xE3o encontrada" });
      const o = oRes.rows[0];
      await client.query(`
              INSERT INTO quality_checks (order_id, checklist, decision, notes, checked_by, checked_at)
              VALUES ($1, $2, $3, $4, $5, NOW())
            `, [orderId, JSON.stringify(body.checklist || {}), body.decision, body.notes || null, "Teresa Qualidade"]);
      const newStatus = body.decision === "APROVADO" || body.decision === "APROVAR" ? "PRONTO_PARA_ENTREGA" : "REPROCESSAR";
      const newStage = body.decision === "APROVADO" || body.decision === "APROVAR" ? "EXPEDICAO" : o.current_stage;
      await client.query("UPDATE production_orders SET status = $1, current_stage = $2, updated_at = NOW() WHERE id = $3", [newStatus, newStage, orderId]);
      await client.query(`
              INSERT INTO timeline_events (
                ticket_id, ticket_code, order_id, actor_name, action, new_state, note
              ) VALUES ($1, (SELECT ticket_code FROM print_tickets WHERE id = $1), $2, $3, $4, $5)
            `, [o.ticket_id, orderId, "Teresa Qualidade", `Controlo de Qualidade: ${body.decision}`, newStatus, body.notes || "Inspec\xE7\xE3o de qualidade finalizada."]);
      return sendJson(res, 200, { success: true });
    }
    const orderDeliveryMatch = reqPath.match(/^\/api\/orders\/(\d+)\/delivery$/);
    if (orderDeliveryMatch && req.method === "POST") {
      const orderId = Number(orderDeliveryMatch[1]);
      const body = await parseBody(req);
      const oRes = await client.query("SELECT * FROM production_orders WHERE id = $1", [orderId]);
      if (oRes.rows.length === 0) return sendJson(res, 404, { message: "Ordem n\xE3o encontrada" });
      const o = oRes.rows[0];
      if (body.action === "EXPEDIR") {
        await client.query(`
                UPDATE order_deliveries SET method = COALESCE($1, method), responsible = $2, dispatch_at = NOW()
                WHERE order_id = $3
              `, [body.method || null, body.responsible || "Carlos Expedi\xE7\xE3o", orderId]);
        await client.query("UPDATE production_orders SET status = 'EM_EXPEDICAO', updated_at = NOW() WHERE id = $1", [orderId]);
      } else if (body.action === "ENTREGAR") {
        await client.query(`
                UPDATE order_deliveries SET delivered_at = NOW(), proof = $1, signature = $2
                WHERE order_id = $3
              `, [body.proof || "Entregue com guia assinada", body.signature || "Carlos Silva", orderId]);
        await client.query("UPDATE production_orders SET status = 'ENTREGUE', updated_at = NOW() WHERE id = $1", [orderId]);
        await client.query("UPDATE print_tickets SET status = 'ENTREGUE', updated_at = NOW() WHERE id = $1", [o.ticket_id]);
      }
      await client.query(`
              INSERT INTO timeline_events (
                ticket_id, ticket_code, order_id, actor_name, action, note
              ) VALUES ($1, (SELECT ticket_code FROM print_tickets WHERE id = $1), $2, $3, $4, $5)
            `, [o.ticket_id, orderId, "Carlos Expedi\xE7\xE3o", `Expedi\xE7\xE3o: ${body.action}`, `Trabalho ${body.action === "EXPEDIR" ? "em tr\xE2nsito" : "entregue"}.`]);
      return sendJson(res, 200, { success: true });
    }
    const sampleMatch = reqPath.match(/^\/api\/approval\/([^/]+)$/);
    if (sampleMatch && req.method === "GET") {
      const token = sampleMatch[1];
      const linkRes = await client.query(`
              SELECT l.*, t.ticket_code, t.product, c.name as client_name, v.file_name, v.notes, v.status as version_status, v.version
              FROM sample_approval_links l
              JOIN print_tickets t ON l.ticket_id = t.id
              JOIN clients c ON t.client_id = c.id
              JOIN artwork_versions v ON l.version_id = v.id
              WHERE l.token = $1
            `, [token]);
      if (linkRes.rows.length === 0) {
        return sendJson(res, 404, { message: "Amostra n\xE3o encontrada ou link inv\xE1lido." });
      }
      const l = linkRes.rows[0];
      return sendJson(res, 200, {
        token,
        ticketCode: l.ticket_code,
        clientName: l.client_name,
        product: l.product,
        version: l.version,
        fileName: l.file_name,
        fileUrl: "https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=1200&q=80",
        notes: l.notes,
        status: l.version_status
      });
    }
    const sampleDecisionMatch = reqPath.match(/^\/api\/approval\/([^/]+)\/decision$/);
    if (sampleDecisionMatch && req.method === "POST") {
      const token = sampleDecisionMatch[1];
      const body = await parseBody(req);
      const linkRes = await client.query(`
              SELECT l.*, t.ticket_code, t.id as ticket_id, c.name as client_name
              FROM sample_approval_links l
              JOIN print_tickets t ON l.ticket_id = t.id
              JOIN clients c ON t.client_id = c.id
              WHERE l.token = $1
            `, [token]);
      if (linkRes.rows.length === 0) return sendJson(res, 404, { message: "Amostra n\xE3o encontrada." });
      const l = linkRes.rows[0];
      const isApproved = body.decision === "APROVAR";
      await client.query(`
              UPDATE artwork_versions 
              SET status = $1, decided_at = NOW(), decision_comment = $2 
              WHERE id = $3
            `, [isApproved ? "APROVADA" : "REJEITADA", body.notes || null, l.version_id]);
      await client.query("UPDATE sample_approval_links SET used_at = NOW() WHERE id = $1", [l.id]);
      const ticketNewStatus = isApproved ? "AGUARDA_APROVACAO_GESTAO" : "AMOSTRA_REJEITADA";
      await client.query("UPDATE print_tickets SET status = $1, updated_at = NOW() WHERE id = $2", [ticketNewStatus, l.ticket_id]);
      await client.query(`
              INSERT INTO timeline_events (
                ticket_id, actor_name, action, new_state, note
              ) VALUES ($1, $2, $3, $4, $5)
            `, [l.ticket_id, l.client_name, `Decis\xE3o de Amostra: ${body.decision}`, ticketNewStatus, body.notes || (isApproved ? "Aprovado pelo cliente." : "Amostra rejeitada pelo cliente.")]);
      return sendJson(res, 200, { status: isApproved ? "APROVADA" : "REJEITADA" });
    }
    if (reqPath === "/api/uploads/request-url" && req.method === "POST") {
      const body = await parseBody(req);
      const name = (body.name || "documento.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const cleanName = `${Date.now()}_${name}`;
      return sendJson(res, 200, {
        uploadURL: `/api/mock-upload?file=${cleanName}`,
        objectPath: `/uploads/${cleanName}`
      });
    }
    if (reqPath === "/api/mock-upload" && (req.method === "PUT" || req.method === "POST")) {
      const fileName = queryParams.get("file") || `upload_${Date.now()}.bin`;
      const uploadDir = path.resolve(projectRoot, "artifacts", "grafica-flow", "public", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, fileName);
      const writeStream = fs.createWriteStream(filePath);
      req.pipe(writeStream);
      writeStream.on("finish", () => {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        });
        res.end(JSON.stringify({ success: true, url: `/uploads/${fileName}` }));
      });
      return;
    }
    return sendJson(res, 404, { error: "Endpoint n\xE3o encontrado no servidor" });
  } catch (err) {
    console.error("[API Serverless Error]", err);
    return sendJson(res, 500, { error: err.message || "Erro interno no servidor" });
  }
}
export {
  handler as default
};

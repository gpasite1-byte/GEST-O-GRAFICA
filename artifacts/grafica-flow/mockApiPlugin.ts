import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import path from 'path';
import fs from 'fs';

const projectRoot = 'C:\\Users\\GPA\\Documents\\Gestao-de-Producao-Grafica';
const relDataDir = fs.existsSync('./data/postgres') ? './data/postgres' : '../../data/postgres';
const supabaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.czcptgunvyxdajotbyfb:923273590cRIS%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

// Singleton instance across Vite hot-reloads
declare global {
  var __dbClient: any;
}

if (!globalThis.__dbClient) {
  if (supabaseUrl) {
    console.log('[API] Conectando diretamente ao Supabase PostgreSQL na nuvem...');
    globalThis.__dbClient = new pg.Pool({
      connectionString: supabaseUrl,
      ssl: { rejectUnauthorized: false }
    });
  } else {
    console.log('[API] Conectando ao PostgreSQL local PGlite...');
    const pidPath = path.join(relDataDir, 'postmaster.pid');
    if (fs.existsSync(pidPath)) {
      try {
        fs.unlinkSync(pidPath);
      } catch {}
    }
    globalThis.__dbClient = new PGlite(relDataDir);
  }
}

const client = globalThis.__dbClient;
let activeUserId = "usr_admin";

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(JSON.stringify(data));
}

export function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const urlStr = req.url || '';
        if (!urlStr.startsWith('/api')) {
          return next();
        }

        const [reqPath, queryString] = urlStr.split('?');
        const queryParams = new URLSearchParams(queryString || '');

        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          return res.end();
        }

        try {
          // 1. Auth User (from PostgreSQL users table)
          if (reqPath === '/api/auth/user' && req.method === 'GET') {
            if (!activeUserId) {
              return sendJson(res, 200, { user: null });
            }
            const userRes = await client.query('SELECT * FROM users WHERE id = $1', [activeUserId]);
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
                profileImageUrl: u.profile_image_url,
              },
            });
          }

          // 1b. Switch Active User
          if (reqPath === '/api/auth/switch' && req.method === 'POST') {
            const body = await parseBody(req);
            const targetId = body.userId;
            if (targetId) {
              const userRes = await client.query('SELECT * FROM users WHERE id = $1', [targetId]);
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
                    profileImageUrl: u.profile_image_url,
                  },
                });
              }
            }
            return sendJson(res, 400, { error: 'Utilizador não encontrado' });
          }

          // 2. Login & Logout
          if (reqPath === '/api/login') {
            const userId = queryParams.get('userId') || 'usr_admin';
            activeUserId = userId;
            const returnTo = queryParams.get('returnTo') || '/';
            res.writeHead(302, { Location: returnTo });
            return res.end();
          }

          if (reqPath === '/api/logout') {
            activeUserId = '';
            const returnTo = queryParams.get('returnTo') || '/';
            res.writeHead(302, { Location: returnTo });
            return res.end();
          }

          // 3. Team Members (from PostgreSQL staff_members + users)
          if (reqPath === '/api/team' && req.method === 'GET') {
            const teamRes = await client.query(`
              SELECT s.id, s.role, s.created_at, u.first_name, u.last_name, u.email 
              FROM staff_members s 
              LEFT JOIN users u ON s.id = u.id
              ORDER BY s.created_at ASC
            `);
            const members = teamRes.rows.map((row: any) => ({
              id: row.id,
              name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.id,
              email: row.email,
              role: row.role,
              createdAt: row.created_at,
            }));
            return sendJson(res, 200, members);
          }

          const teamRoleMatch = reqPath.match(/^\/api\/team\/([^/]+)\/role$/);
          if (teamRoleMatch && (req.method === 'PATCH' || req.method === 'POST')) {
            const staffId = teamRoleMatch[1];
            const body = await parseBody(req);
            await client.query('UPDATE staff_members SET role = $1, updated_at = NOW() WHERE id = $2', [body.role, staffId]);
            return sendJson(res, 200, { id: staffId, role: body.role });
          }

          // 4. Clients (from PostgreSQL clients table)
          if (reqPath === '/api/clients') {
            if (req.method === 'GET') {
              const search = queryParams.get('search')?.toLowerCase();
              let clientsRes;
              if (search) {
                clientsRes = await client.query(
                  `SELECT * FROM clients WHERE LOWER(name) LIKE $1 OR LOWER(company) LIKE $1 ORDER BY id DESC`,
                  [`%${search}%`]
                );
              } else {
                clientsRes = await client.query('SELECT * FROM clients ORDER BY id DESC');
              }
              const list = clientsRes.rows.map((c: any) => ({
                id: c.id,
                name: c.name,
                company: c.company,
                contact: c.contact,
                email: c.email,
                phone: c.phone,
                createdAt: c.created_at,
              }));
              return sendJson(res, 200, list);
            }
            if (req.method === 'POST') {
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
                createdAt: c.created_at,
              });
            }
          }

                    // Admin reset endpoint to start from zero
          if (reqPath === '/api/admin/reset' && req.method === 'POST') {
            await client.query('DELETE FROM timeline_events');
            await client.query('DELETE FROM order_deliveries');
            await client.query('DELETE FROM quality_checks');
            await client.query('DELETE FROM production_stages');
            await client.query('DELETE FROM production_orders');
            await client.query('DELETE FROM sample_approval_links');
            await client.query('DELETE FROM artwork_versions');
            await client.query('DELETE FROM print_tickets');
            return sendJson(res, 200, { success: true, message: 'Operações resetadas para zero!' });
          }

          // 5. Dashboard (live SQL counts from PostgreSQL)
          if (reqPath === '/api/dashboard' && req.method === 'GET') {
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
              recentActivity: activityRes.rows.map((a: any) => ({
                id: a.id,
                ticketId: a.ticket_id,
                ticketCode: a.ticket_code,
                orderId: a.order_id,
                actorName: a.actor_name,
                action: a.action,
                previousState: a.previous_state,
                newState: a.new_state,
                note: a.note,
                createdAt: a.created_at,
              })),
            });
          }

          // 6. Activity
          if (reqPath === '/api/activity' && req.method === 'GET') {
            const activityRes = await client.query("SELECT e.*, t.ticket_code FROM timeline_events e JOIN print_tickets t ON e.ticket_id = t.id ORDER BY e.id DESC LIMIT 20");
            const activities = activityRes.rows.map((a: any) => ({
              id: a.id,
              ticketId: a.ticket_id,
              ticketCode: a.ticket_code,
              orderId: a.order_id,
              actorName: a.actor_name,
              action: a.action,
              previousState: a.previous_state,
              newState: a.new_state,
              note: a.note,
              createdAt: a.created_at,
            }));
            return sendJson(res, 200, activities);
          }

          // 7. Tickets list & creation (from print_tickets + clients)
          if (reqPath === '/api/tickets') {
            if (req.method === 'GET') {
              const status = queryParams.get('status');
              const search = queryParams.get('search')?.toLowerCase();
              let query = `
                SELECT t.*, c.name as client_name, c.company as company, 
                       (SELECT id FROM production_orders WHERE ticket_id = t.id LIMIT 1) as order_id
                FROM print_tickets t 
                JOIN clients c ON t.client_id = c.id
              `;
              const params: any[] = [];
              if (status) {
                params.push(status);
                query += ` WHERE t.status = $${params.length}`;
              }
              query += ' ORDER BY t.id DESC';
              const ticketsRes = await client.query(query, params);
              let list = ticketsRes.rows.map((t: any) => ({
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
                updatedAt: t.updated_at,
              }));
              if (search) {
                list = list.filter((item: any) =>
                  item.product?.toLowerCase().includes(search) ||
                  item.clientName?.toLowerCase().includes(search) ||
                  item.ticketCode?.toLowerCase().includes(search)
                );
              }
              return sendJson(res, 200, list);
            }

            if (req.method === 'POST') {
              const body = await parseBody(req);
              const countRes = await client.query('SELECT COUNT(*) as count FROM print_tickets');
              const newNum = Number(countRes.rows[0]?.count || 0) + 1;
              const code = `TCK-2026-${String(newNum).padStart(3, '0')}`;

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
                body.dueDate ? body.dueDate.split('T')[0] : '2026-10-15',
                body.priority || 'NORMAL',
                body.amount ? Number(body.amount) : null,
                body.responsible || null,
                body.observations || null,
                JSON.stringify(body.files || []),
                'usr_admin',
              ]);

              const t = insertRes.rows[0];

              // Insert timeline event
              await client.query(`
                INSERT INTO timeline_events (
                  ticket_id, actor_name, action, new_state, note
                ) VALUES ($1, $2, $3, $4, $5)
              `, [t.id, 'Gestor Produção', 'Abertura de Pedido', 'NOVO', 'Pedido gravado no banco de dados.']);

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
                updatedAt: t.updated_at,
              });
            }
          }

          // 8. Single Ticket Details
          const ticketDetailMatch = reqPath.match(/^\/api\/tickets\/(\d+)$/);
          if (ticketDetailMatch && req.method === 'GET') {
            const ticketId = Number(ticketDetailMatch[1]);
            const tRes = await client.query(`
              SELECT t.*, c.name as client_name, c.company as company, c.contact as contact, c.email as email, c.phone as phone,
                     (SELECT id FROM production_orders WHERE ticket_id = t.id LIMIT 1) as order_id
              FROM print_tickets t
              JOIN clients c ON t.client_id = c.id
              WHERE t.id = $1
            `, [ticketId]);

            if (tRes.rows.length === 0) {
              return sendJson(res, 404, { message: 'Ticket não encontrado' });
            }

            const t = tRes.rows[0];
            const vRes = await client.query('SELECT * FROM artwork_versions WHERE ticket_id = $1 ORDER BY version DESC', [ticketId]);
            const eRes = await client.query('SELECT e.*, t.ticket_code FROM timeline_events e JOIN print_tickets t ON e.ticket_id = t.id WHERE e.ticket_id = $1 ORDER BY e.id DESC', [ticketId]);
            const linkRes = await client.query('SELECT token FROM sample_approval_links WHERE ticket_id = $1 AND used_at IS NULL ORDER BY id DESC LIMIT 1', [ticketId]);

            const versions = vRes.rows.map((v: any) => ({
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
              decisionComment: v.decision_comment,
            }));

            const events = eRes.rows.map((e: any) => ({
              id: e.id,
              ticketId: e.ticket_id,
              ticketCode: e.ticket_code,
              orderId: e.order_id,
              actorName: e.actor_name,
              action: e.action,
              previousState: e.previous_state,
              newState: e.new_state,
              note: e.note,
              createdAt: e.created_at,
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
              events,
            });
          }

          // 9. Analyze Ticket (Decision)
          const analyzeMatch = reqPath.match(/^\/api\/tickets\/(\d+)\/analyze$/);
          if (analyzeMatch && req.method === 'POST') {
            const ticketId = Number(analyzeMatch[1]);
            const body = await parseBody(req);
            const tRes = await client.query('SELECT * FROM print_tickets WHERE id = $1', [ticketId]);
            if (tRes.rows.length === 0) return sendJson(res, 404, { message: 'Ticket não encontrado' });
            const t = tRes.rows[0];

            let newStatus = t.status;
            let assignedDesigner = t.assigned_designer;
            if (body.decision === 'APROVAR_DESIGN') {
              newStatus = 'EM_DESIGN';
              assignedDesigner = body.assignedDesigner || 'Mateus Designer';
            } else if (body.decision === 'PEDIR_INFO') {
              newStatus = 'AGUARDA_INFORMACAO';
            } else if (body.decision === 'RECUSAR') {
              newStatus = 'RECUSADO';
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
            `, [ticketId, 'Gestor Produção', `Análise: ${body.decision}`, t.status, newStatus, body.notes || 'Análise de viabilidade realizada.']);

            return sendJson(res, 200, { id: ticketId, status: newStatus });
          }

          // 10. Artwork Version (Upload)
          const artworkMatch = reqPath.match(/^\/api\/tickets\/(\d+)\/artwork$/);
          if (artworkMatch && req.method === 'POST') {
            const ticketId = Number(artworkMatch[1]);
            const body = await parseBody(req);
            const tRes = await client.query('SELECT * FROM print_tickets WHERE id = $1', [ticketId]);
            if (tRes.rows.length === 0) return sendJson(res, 404, { message: 'Ticket não encontrado' });
            const t = tRes.rows[0];

            const countV = await client.query('SELECT COUNT(*) as count FROM artwork_versions WHERE ticket_id = $1', [ticketId]);
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
              body.fileSize || 5000000,
              'application/pdf',
              body.notes || 'Amostra enviada para aprovação.',
              'Mateus Designer',
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
            `, [ticketId, 'Mateus Designer', `Envio da Arte v${verNum}`, t.status, 'AGUARDA_APROVACAO_AMOSTRA', 'Amostra digital enviada ao cliente.']);

            return sendJson(res, 201, {
              version: verNum,
              sampleApprovalUrl: `/aprovar/${token}`,
            });
          }

          // 11. Management Decision (Generates OP in production_orders)
          const decisionMatch = reqPath.match(/^\/api\/tickets\/(\d+)\/decision$/);
          if (decisionMatch && req.method === 'POST') {
            const ticketId = Number(decisionMatch[1]);
            const body = await parseBody(req);
            const tRes = await client.query('SELECT * FROM print_tickets WHERE id = $1', [ticketId]);
            if (tRes.rows.length === 0) return sendJson(res, 404, { message: 'Ticket não encontrado' });
            const t = tRes.rows[0];

            if (body.decision === 'APROVADO' || body.decision === 'APROVAR') {
              const opCountRes = await client.query('SELECT COUNT(*) as count FROM production_orders');
              const opNum = Number(opCountRes.rows[0]?.count || 0) + 1;
              const opCode = `OP-2026-${String(opNum).padStart(3, '0')}`;

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
                'Arte_Final_Aprovada.pdf',
                '/uploads/arte_final.pdf',
              ]);

              const op = opRes.rows[0];

              // Insert stages
              await client.query(`
                INSERT INTO production_stages (order_id, stage, status, machine) VALUES
                ($1, 'PRE_IMPRESSAO', 'PENDENTE', 'CTP Agfa'),
                ($1, 'IMPRESSAO', 'PENDENTE', 'Heidelberg SM 74'),
                ($1, 'ACABAMENTO', 'PENDENTE', 'Guilhotina / Vincadora'),
                ($1, 'EMBALAGEM', 'PENDENTE', 'Mesa de Embalagem')
              `, [op.id]);

              // Insert delivery record
              await client.query(`
                INSERT INTO order_deliveries (order_id, method) VALUES ($1, 'ENTREGA_PROPRIA')
              `, [op.id]);

              // Update ticket
              await client.query("UPDATE print_tickets SET status = 'OP_CRIADA', updated_at = NOW() WHERE id = $1", [ticketId]);

              // Record event
              await client.query(`
                INSERT INTO timeline_events (
                  ticket_id, ticket_code, order_id, actor_name, action, previous_state, new_state, note
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `, [ticketId, op.id, 'Gestor Produção', 'OP Gerada', t.status, 'OP_CRIADA', `Ordem de Produção ${opCode} emitida com sucesso.`]);

              return sendJson(res, 200, { id: ticketId, status: 'OP_CRIADA', orderId: op.id });
            }

            if (body.decision === 'DEVOLVER') {
              await client.query("UPDATE print_tickets SET status = 'EM_DESIGN', updated_at = NOW() WHERE id = $1", [ticketId]);
            } else if (body.decision === 'CANCELAR') {
              await client.query("UPDATE print_tickets SET status = 'CANCELADO', updated_at = NOW() WHERE id = $1", [ticketId]);
            }

            return sendJson(res, 200, { id: ticketId, status: body.decision });
          }

          // 12. Production Orders list (from production_orders + clients + tickets)
          if (reqPath === '/api/orders' && req.method === 'GET') {
            const status = queryParams.get('status');
            const stage = queryParams.get('stage');
            let query = `
              SELECT o.*, c.name as client_name, t.ticket_code
              FROM production_orders o
              JOIN clients c ON o.client_id = c.id
              JOIN print_tickets t ON o.ticket_id = t.id
            `;
            const params: any[] = [];
            const clauses: string[] = [];
            if (status) {
              params.push(status);
              clauses.push(`o.status = $${params.length}`);
            }
            if (stage) {
              params.push(stage);
              clauses.push(`o.current_stage = $${params.length}`);
            }
            if (clauses.length > 0) {
              query += ' WHERE ' + clauses.join(' AND ');
            }
            query += ' ORDER BY o.id DESC';

            const ordersRes = await client.query(query, params);
            const list = ordersRes.rows.map((o: any) => ({
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
              updatedAt: o.updated_at,
            }));
            return sendJson(res, 200, list);
          }

          // 13. Single Order Details
          const orderDetailMatch = reqPath.match(/^\/api\/orders\/(\d+)$/);
          if (orderDetailMatch && req.method === 'GET') {
            const orderId = Number(orderDetailMatch[1]);
            const oRes = await client.query(`
              SELECT o.*, c.name as client_name, t.ticket_code
              FROM production_orders o
              JOIN clients c ON o.client_id = c.id
              JOIN print_tickets t ON o.ticket_id = t.id
              WHERE o.id = $1
            `, [orderId]);

            if (oRes.rows.length === 0) return sendJson(res, 404, { message: 'Ordem não encontrada' });
            const o = oRes.rows[0];

            const stagesRes = await client.query('SELECT * FROM production_stages WHERE order_id = $1 ORDER BY id ASC', [orderId]);
            const qcRes = await client.query('SELECT * FROM quality_checks WHERE order_id = $1 ORDER BY id DESC LIMIT 1', [orderId]);
            const delRes = await client.query('SELECT * FROM order_deliveries WHERE order_id = $1 ORDER BY id DESC LIMIT 1', [orderId]);
            const evRes = await client.query('SELECT e.*, t.ticket_code FROM timeline_events e JOIN print_tickets t ON e.ticket_id = t.id WHERE e.order_id = $1 ORDER BY e.id DESC', [orderId]);

            const stages = stagesRes.rows.map((s: any) => ({
              id: s.id,
              stage: s.stage,
              status: s.status,
              responsible: s.responsible,
              machine: s.machine,
              startedAt: s.started_at,
              completedAt: s.completed_at,
              quantityProduced: s.quantity_produced,
              waste: s.waste,
              notes: s.notes,
            }));

            const qualityCheck = qcRes.rows[0] ? {
              id: qcRes.rows[0].id,
              checklist: qcRes.rows[0].checklist,
              decision: qcRes.rows[0].decision,
              notes: qcRes.rows[0].notes,
              checkedBy: qcRes.rows[0].checked_by,
              checkedAt: qcRes.rows[0].checked_at,
            } : null;

            const delivery = delRes.rows[0] ? {
              method: delRes.rows[0].method,
              responsible: delRes.rows[0].responsible,
              dispatchAt: delRes.rows[0].dispatch_at,
              deliveredAt: delRes.rows[0].delivered_at,
              proof: delRes.rows[0].proof,
              signature: delRes.rows[0].signature,
              photoPath: delRes.rows[0].photo_path,
            } : {
              method: 'ENTREGA_PROPRIA',
              responsible: null,
              dispatchAt: null,
              deliveredAt: null,
              proof: null,
              signature: null,
              photoPath: null,
            };

            const events = evRes.rows.map((e: any) => ({
              id: e.id,
              ticketId: e.ticket_id,
              ticketCode: e.ticket_code,
              orderId: e.order_id,
              actorName: e.actor_name,
              action: e.action,
              previousState: e.previous_state,
              newState: e.new_state,
              note: e.note,
              createdAt: e.created_at,
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
              events,
            });
          }

          // 14. Order Stage Action (INICIAR / CONCLUIR)
          const orderStageMatch = reqPath.match(/^\/api\/orders\/(\d+)\/stage$/);
          if (orderStageMatch && req.method === 'POST') {
            const orderId = Number(orderStageMatch[1]);
            const body = await parseBody(req);
            const oRes = await client.query('SELECT * FROM production_orders WHERE id = $1', [orderId]);
            if (oRes.rows.length === 0) return sendJson(res, 404, { message: 'Ordem não encontrada' });
            const o = oRes.rows[0];

            if (body.action === 'INICIAR') {
              await client.query(`
                UPDATE production_stages 
                SET status = 'EM_CURSO', started_at = NOW(), responsible = $1, machine = COALESCE($2, machine)
                WHERE order_id = $3 AND stage = $4
              `, [body.responsible || 'João Baptista', body.machine || null, orderId, body.stage]);

              await client.query(`
                UPDATE production_orders SET status = 'EM_PRODUCAO', current_stage = $1, updated_at = NOW() WHERE id = $2
              `, [body.stage, orderId]);
            } else if (body.action === 'CONCLUIR') {
              await client.query(`
                UPDATE production_stages 
                SET status = 'CONCLUIDO', completed_at = NOW(), quantity_produced = $1, waste = $2, notes = $3
                WHERE order_id = $4 AND stage = $5
              `, [body.quantityProduced || o.quantity, body.waste || 0, body.notes || null, orderId, body.stage]);

              const stageOrder = ['PRE_IMPRESSAO', 'IMPRESSAO', 'ACABAMENTO', 'EMBALAGEM'];
              const currentIdx = stageOrder.indexOf(body.stage);
              if (currentIdx >= 0 && currentIdx < stageOrder.length - 1) {
                const nextStage = stageOrder[currentIdx + 1];
                await client.query('UPDATE production_orders SET current_stage = $1, updated_at = NOW() WHERE id = $2', [nextStage, orderId]);
              } else {
                await client.query("UPDATE production_orders SET current_stage = 'CONTROLO_QUALIDADE', status = 'AGUARDA_CONTROLO_QUALIDADE', updated_at = NOW() WHERE id = $1", [orderId]);
              }
            }

            await client.query(`
              INSERT INTO timeline_events (
                ticket_id, order_id, actor_name, action, note
              ) VALUES ($1, $2, $3, $4, $5)
            `, [o.ticket_id, orderId, 'João Baptista', `${body.action === 'INICIAR' ? 'Início de' : 'Conclusão de'} ${body.stage}`, body.notes || `Etapa ${body.stage} actualizada no banco de dados.`]);

            return sendJson(res, 200, { success: true });
          }

          // 15. Quality Check
          const orderQualityMatch = reqPath.match(/^\/api\/orders\/(\d+)\/quality$/);
          if (orderQualityMatch && req.method === 'POST') {
            const orderId = Number(orderQualityMatch[1]);
            const body = await parseBody(req);
            const oRes = await client.query('SELECT * FROM production_orders WHERE id = $1', [orderId]);
            if (oRes.rows.length === 0) return sendJson(res, 404, { message: 'Ordem não encontrada' });
            const o = oRes.rows[0];

            await client.query(`
              INSERT INTO quality_checks (order_id, checklist, decision, notes, checked_by, checked_at)
              VALUES ($1, $2, $3, $4, $5, NOW())
            `, [orderId, JSON.stringify(body.checklist || {}), body.decision, body.notes || null, 'Teresa Qualidade']);

            const newStatus = (body.decision === 'APROVADO' || body.decision === 'APROVAR') ? 'PRONTO_PARA_ENTREGA' : 'REPROCESSAR';
            const newStage = (body.decision === 'APROVADO' || body.decision === 'APROVAR') ? 'EXPEDICAO' : o.current_stage;

            await client.query('UPDATE production_orders SET status = $1, current_stage = $2, updated_at = NOW() WHERE id = $3', [newStatus, newStage, orderId]);

            await client.query(`
              INSERT INTO timeline_events (
                ticket_id, ticket_code, order_id, actor_name, action, new_state, note
              ) VALUES ($1, (SELECT ticket_code FROM print_tickets WHERE id = $1), $2, $3, $4, $5)
            `, [o.ticket_id, orderId, 'Teresa Qualidade', `Controlo de Qualidade: ${body.decision}`, newStatus, body.notes || 'Inspecção de qualidade finalizada.']);

            return sendJson(res, 200, { success: true });
          }

          // 16. Order Delivery
          const orderDeliveryMatch = reqPath.match(/^\/api\/orders\/(\d+)\/delivery$/);
          if (orderDeliveryMatch && req.method === 'POST') {
            const orderId = Number(orderDeliveryMatch[1]);
            const body = await parseBody(req);
            const oRes = await client.query('SELECT * FROM production_orders WHERE id = $1', [orderId]);
            if (oRes.rows.length === 0) return sendJson(res, 404, { message: 'Ordem não encontrada' });
            const o = oRes.rows[0];

            if (body.action === 'EXPEDIR') {
              await client.query(`
                UPDATE order_deliveries SET method = COALESCE($1, method), responsible = $2, dispatch_at = NOW()
                WHERE order_id = $3
              `, [body.method || null, body.responsible || 'Carlos Expedição', orderId]);

              await client.query("UPDATE production_orders SET status = 'EM_EXPEDICAO', updated_at = NOW() WHERE id = $1", [orderId]);
            } else if (body.action === 'ENTREGAR') {
              await client.query(`
                UPDATE order_deliveries SET delivered_at = NOW(), proof = $1, signature = $2
                WHERE order_id = $3
              `, [body.proof || 'Entregue com guia assinada', body.signature || 'Carlos Silva', orderId]);

              await client.query("UPDATE production_orders SET status = 'ENTREGUE', updated_at = NOW() WHERE id = $1", [orderId]);
              await client.query("UPDATE print_tickets SET status = 'ENTREGUE', updated_at = NOW() WHERE id = $1", [o.ticket_id]);
            }

            await client.query(`
              INSERT INTO timeline_events (
                ticket_id, ticket_code, order_id, actor_name, action, note
              ) VALUES ($1, (SELECT ticket_code FROM print_tickets WHERE id = $1), $2, $3, $4, $5)
            `, [o.ticket_id, orderId, 'Carlos Expedição', `Expedição: ${body.action}`, `Trabalho ${body.action === 'EXPEDIR' ? 'em trânsito' : 'entregue'}.`]);

            return sendJson(res, 200, { success: true });
          }

          // 17. Sample Public Approval View
          const sampleMatch = reqPath.match(/^\/api\/approval\/([^/]+)$/);
          if (sampleMatch && req.method === 'GET') {
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
              return sendJson(res, 404, { message: 'Amostra não encontrada ou link inválido.' });
            }

            const l = linkRes.rows[0];
            return sendJson(res, 200, {
              token,
              ticketCode: l.ticket_code,
              clientName: l.client_name,
              product: l.product,
              version: l.version,
              fileName: l.file_name,
              fileUrl: 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=1200&q=80',
              notes: l.notes,
              status: l.version_status,
            });
          }

          // 18. Sample Approval Decision
          const sampleDecisionMatch = reqPath.match(/^\/api\/approval\/([^/]+)\/decision$/);
          if (sampleDecisionMatch && req.method === 'POST') {
            const token = sampleDecisionMatch[1];
            const body = await parseBody(req);
            const linkRes = await client.query(`
              SELECT l.*, t.ticket_code, t.id as ticket_id, c.name as client_name
              FROM sample_approval_links l
              JOIN print_tickets t ON l.ticket_id = t.id
              JOIN clients c ON t.client_id = c.id
              WHERE l.token = $1
            `, [token]);

            if (linkRes.rows.length === 0) return sendJson(res, 404, { message: 'Amostra não encontrada.' });
            const l = linkRes.rows[0];

            const isApproved = body.decision === 'APROVAR';
            await client.query(`
              UPDATE artwork_versions 
              SET status = $1, decided_at = NOW(), decision_comment = $2 
              WHERE id = $3
            `, [isApproved ? 'APROVADA' : 'REJEITADA', body.notes || null, l.version_id]);

            await client.query('UPDATE sample_approval_links SET used_at = NOW() WHERE id = $1', [l.id]);

            const ticketNewStatus = isApproved ? 'AGUARDA_APROVACAO_GESTAO' : 'AMOSTRA_REJEITADA';
            await client.query('UPDATE print_tickets SET status = $1, updated_at = NOW() WHERE id = $2', [ticketNewStatus, l.ticket_id]);

            await client.query(`
              INSERT INTO timeline_events (
                ticket_id, actor_name, action, new_state, note
              ) VALUES ($1, $2, $3, $4, $5)
            `, [l.ticket_id, l.client_name, `Decisão de Amostra: ${body.decision}`, ticketNewStatus, body.notes || (isApproved ? 'Aprovado pelo cliente.' : 'Amostra rejeitada pelo cliente.')]);

            return sendJson(res, 200, { status: isApproved ? 'APROVADA' : 'REJEITADA' });
          }

          // 19. Uploads (salvamento real de ficheiros em disco)
          if (reqPath === '/api/uploads/request-url' && req.method === 'POST') {
            const body = await parseBody(req);
            const name = (body.name || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
            const cleanName = `${Date.now()}_${name}`;
            return sendJson(res, 200, {
              uploadURL: `/api/mock-upload?file=${cleanName}`,
              objectPath: `/uploads/${cleanName}`,
            });
          }

          if (reqPath === '/api/mock-upload' && (req.method === 'PUT' || req.method === 'POST')) {
            const fileName = queryParams.get('file') || `upload_${Date.now()}.bin`;
            const uploadDir = path.resolve(projectRoot, 'artifacts', 'grafica-flow', 'public', 'uploads');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            const filePath = path.join(uploadDir, fileName);
            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);
            writeStream.on('finish', () => {
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ success: true, url: `/uploads/${fileName}` }));
            });
            return;
          }

          return sendJson(res, 200, {});
        } catch (err: any) {
          console.error('Erro na API PostgreSQL:', err);
          return sendJson(res, 500, { error: err.message || 'Erro interno no banco de dados' });
        }
      });
    },
  };
}

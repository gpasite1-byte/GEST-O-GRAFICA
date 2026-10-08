import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import path from 'path';
import * as schema from '@workspace/db/schema';

const projectRoot = 'C:\\\\Users\\\\GPA\\\\Documents\\\\Gestao-de-Producao-Grafica';
const dataDir = path.resolve(projectRoot, 'data', 'postgres');
const client = new PGlite(dataDir);
const db = drizzle(client, { schema });

async function check() {
  const users = await db.select().from(schema.usersTable);
  const clients = await db.select().from(schema.clientsTable);
  const tickets = await db.select().from(schema.ticketsTable);
  const orders = await db.select().from(schema.productionOrdersTable);

  console.log('--- STATUS DO BANCO POSTGRESQL PGLITE ---');
  console.log('Utilizadores:', users.length);
  console.log('Clientes:', clients.length);
  console.log('Tickets:', tickets.length);
  console.log('Ordens de Producao:', orders.length);

  await client.close();
}

check().catch(console.error);

import { PGlite } from '@electric-sql/pglite';

async function testQueries() {
  const dataDir = 'C:\\\\Users\\\\GPA\\\\Documents\\\\Gestao-de-Producao-Grafica\\\\data\\\\postgres';
  const client = new PGlite(dataDir);

  const clientsRes = await client.query('SELECT * FROM clients');
  console.log('Clientes no banco:', clientsRes.rows.length);

  const ticketsRes = await client.query('SELECT * FROM print_tickets');
  console.log('Tickets no banco:', ticketsRes.rows.length);

  const ordersRes = await client.query('SELECT * FROM production_orders');
  console.log('Ordens no banco:', ordersRes.rows.length);

  await client.close();
}

testQueries().catch(console.error);

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import path from 'path';
import * as schema from '@workspace/db/schema';

const projectRoot = 'C:\\\\Users\\\\GPA\\\\Documents\\\\Gestao-de-Producao-Grafica';
const dataDir = path.resolve(projectRoot, 'data', 'postgres');
const client = new PGlite(dataDir);
const db = drizzle(client, { schema });

async function seedTicketsAndOrders() {
  const clients = await db.select().from(schema.clientsTable);
  const existingOrders = await db.select().from(schema.productionOrdersTable);
  if (existingOrders.length > 0) {
    console.log('Ordens ja existentes:', existingOrders.length);
    await client.close();
    return;
  }

  // Get or insert tickets
  let tickets = await db.select().from(schema.ticketsTable);
  if (tickets.length === 0) {
    console.log('Inserindo tickets...');
    const tck1 = await db.insert(schema.ticketsTable).values({
      ticketCode: 'TCK-2026-001',
      clientId: clients[0].id,
      quantity: 500,
      product: 'Relatório de Gestão e Contas 2025',
      description: 'Impressão de relatórios anuais em formato A4, capa dura com verniz localizado e miolo couché mate 150g.',
      format: 'A4 Fechado (210 x 297 mm)',
      material: 'Capa Cartão 2mm + Couché 170g / Miolo Couché Matte 150g',
      colors: '4/4 Cores CMYK',
      finishing: 'Coser com linha e cola PUR, Verniz UV Localizado, Gravação a Ouro',
      dueDate: '2026-10-15',
      priority: 'ALTA',
      amount: 4500000,
      responsible: 'João Baptista',
      assignedDesigner: 'Mateus Designer',
      observations: 'Entrega na sede do banco em Luanda. Embalagem reforçada.',
      status: 'OP_CRIADA',
      createdBy: 'usr_admin',
    }).returning();

    const tck2 = await db.insert(schema.ticketsTable).values({
      ticketCode: 'TCK-2026-002',
      clientId: clients[1].id,
      quantity: 10000,
      product: 'Flyers e Cartazes Campanha 5G',
      description: 'Flyers promocionais A5 frente e verso com cores vibrantes da marca.',
      format: 'A5 (148 x 210 mm)',
      material: 'Couché Brilho 135g',
      colors: '4/4 Cores CMYK',
      finishing: 'Corte recto e empacotamento em lotes de 250 unidades',
      dueDate: '2026-10-10',
      priority: 'URGENTE',
      amount: 1850000,
      responsible: 'Mateus Designer',
      assignedDesigner: 'Mateus Designer',
      observations: 'Cores pantone laranja e azul necessitam calibração rigorosa.',
      status: 'EM_DESIGN',
      createdBy: 'usr_atend',
    }).returning();

    const tck3 = await db.insert(schema.ticketsTable).values({
      ticketCode: 'TCK-2026-003',
      clientId: clients[3].id,
      quantity: 2000,
      product: 'Cartões de Visita Premium com Verniz Localizado',
      description: 'Cartões executivos frente e verso com laminação Soft Touch e verniz UV 3D.',
      format: '85 x 55 mm com cantos arredondados',
      material: 'Cartolina Splendorgel 350g',
      colors: '4/4 Cores',
      finishing: 'Laminação Soft Touch + Verniz UV 3D Reserva + Cantos Redondos',
      dueDate: '2026-10-14',
      priority: 'NORMAL',
      amount: 320000,
      responsible: 'Mateus Designer',
      assignedDesigner: 'Mateus Designer',
      observations: 'Cliente quer validar espessura e efeito do relevo.',
      status: 'AGUARDA_APROVACAO_AMOSTRA',
      createdBy: 'usr_atend',
    }).returning();

    tickets = [tck1[0], tck2[0], tck3[0]];

    const v1 = await db.insert(schema.artworkVersionsTable).values({
      ticketId: tck3[0].id,
      version: 1,
      fileName: 'Cartoes_Nzila_SoftTouch.pdf',
      objectPath: '/uploads/nzila_cartoes_v1.pdf',
      fileSize: 4200000,
      contentType: 'application/pdf',
      status: 'PENDENTE',
      notes: 'Amostra digital com pré-visualização das reservas de verniz e marcas de corte.',
      createdBy: 'usr_des',
    }).returning();

    await db.insert(schema.approvalLinksTable).values({
      ticketId: tck3[0].id,
      versionId: v1[0].id,
      token: 'tok-nzila-003',
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
  }

  const tck1 = tickets[0];
  console.log('Inserindo Ordem de Producao para ticket:', tck1.ticketCode);
  const op1 = await db.insert(schema.productionOrdersTable).values({
    orderCode: 'OP-2026-001',
    ticketId: tck1.id,
    clientId: tck1.clientId,
    product: tck1.product,
    quantity: tck1.quantity,
    format: tck1.format,
    material: tck1.material,
    colors: tck1.colors,
    finishing: tck1.finishing,
    amount: tck1.amount,
    dueDate: tck1.dueDate,
    approvedVersion: 1,
    approvedFileName: 'Relatorio_Contas_BMA_v1.pdf',
    approvedObjectPath: '/uploads/bma_v1.pdf',
    status: 'EM_PRODUCAO',
    currentStage: 'IMPRESSAO',
  }).returning();

  await db.insert(schema.productionStagesTable).values([
    { orderId: op1[0].id, stage: 'PRE_IMPRESSAO', status: 'CONCLUIDO', responsible: 'Mateus Designer', machine: 'CTP Agfa Avalon', startedAt: new Date(), completedAt: new Date(), quantityProduced: 16, waste: 0, notes: 'Chapas gravadas e conferidas com densitómetro.' },
    { orderId: op1[0].id, stage: 'IMPRESSAO', status: 'EM_CURSO', responsible: 'João Baptista', machine: 'Heidelberg Speedmaster SM 74', startedAt: new Date(), quantityProduced: 250, waste: 15, notes: 'Em tiragem de miolo (cadernos 1 a 4).' },
    { orderId: op1[0].id, stage: 'ACABAMENTO', status: 'PENDENTE', machine: 'Dobradeira Stahl / Coser Kolbus' },
    { orderId: op1[0].id, stage: 'EMBALAGEM', status: 'PENDENTE', machine: 'Mesa de Embalagem' },
  ]);

  await db.insert(schema.deliveriesTable).values({
    orderId: op1[0].id,
    method: 'ENTREGA_PROPRIA',
    responsible: 'Carlos Expedição',
  });

  console.log('Banco de dados 100% populado com Tickets e OP!');
  await client.close();
}

seedTicketsAndOrders().catch(console.error);

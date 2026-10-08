import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'fs';
import path from 'path';
import * as schema from '@workspace/db/schema';

const projectRoot = 'C:\\Users\\GPA\\Documents\\Gestao-de-Producao-Grafica';
const dataDir = path.resolve(projectRoot, 'data', 'postgres');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Inicializando PostgreSQL PGlite em:', dataDir);
export const pglite = new PGlite(dataDir);
export const db = drizzle(pglite, { schema });

async function migrateAndSeed() {
  const migrationPath = path.resolve(projectRoot, 'lib', 'db', 'migrations', '0000_fine_paladin.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Executando ${statements.length} instrucoes SQL de migracao...`);
  for (const statement of statements) {
    try {
      await pglite.query(statement);
    } catch (e: any) {
      // Ignorar se tabela ou chave ja existir
      if (!e.message?.includes('already exists')) {
        console.warn('Aviso SQL:', e.message);
      }
    }
  }

  // Verificar se ja existem clientes no banco
  const existingClients = await db.select().from(schema.clientsTable);
  if (existingClients.length === 0) {
    console.log('Populando dados iniciais no banco de dados...');

    // 1. Usuarios e Staff
    await db.insert(schema.usersTable).values([
      { id: 'usr_admin', firstName: 'Gestor', lastName: 'Produção', email: 'gestor@graficaflow.ao' },
      { id: 'usr_atend', firstName: 'Ana Paula', lastName: 'Atendimento', email: 'ana@graficaflow.ao' },
      { id: 'usr_des', firstName: 'Mateus', lastName: 'Designer', email: 'mateus@graficaflow.ao' },
      { id: 'usr_prod', firstName: 'João', lastName: 'Baptista', email: 'joao@graficaflow.ao' },
      { id: 'usr_qual', firstName: 'Teresa', lastName: 'Qualidade', email: 'teresa@graficaflow.ao' },
      { id: 'usr_exp', firstName: 'Carlos', lastName: 'Expedição', email: 'carlos@graficaflow.ao' },
    ]);

    await db.insert(schema.staffTable).values([
      { id: 'usr_admin', role: 'ADMIN' },
      { id: 'usr_atend', role: 'ATENDIMENTO' },
      { id: 'usr_des', role: 'DESIGNER' },
      { id: 'usr_prod', role: 'PRODUCAO' },
      { id: 'usr_qual', role: 'QUALIDADE' },
      { id: 'usr_exp', role: 'EXPEDICAO' },
    ]);

    // 2. Clientes
    const insertedClients = await db.insert(schema.clientsTable).values([
      { name: 'Banco Millennium Atlântico', company: 'BMA SA', contact: 'Carlos Silva', email: 'carlos@bma.ao', phone: '+244 923 111 222' },
      { name: 'Unitel SA', company: 'Unitel Telecomunicações', contact: 'Mariana Sousa', email: 'mariana@unitel.ao', phone: '+244 931 444 555' },
      { name: 'Sonangol Distribuidora', company: 'Sonangol EP', contact: 'Eng. Pedro Manuel', email: 'pmanuel@sonangol.ao', phone: '+244 912 333 444' },
      { name: 'Agência Criativa Nzila', company: 'Nzila Studio', contact: 'Yara Costa', email: 'yara@nzila.ao', phone: '+244 945 777 888' },
      { name: 'Clínica Girassol', company: 'Saúde & Cuidados Lda', contact: 'Dr. António Bento', email: 'compras@girassol.ao', phone: '+244 924 888 999' },
    ]).returning();

    // 3. Tickets
    const tck1 = await db.insert(schema.ticketsTable).values({
      ticketCode: 'TCK-2026-001',
      clientId: insertedClients[0].id,
      product: 'Relatório de Gestão e Contas 2025',
      description: 'Impressão de relatórios anuais em formato A4, capa dura com verniz localizado e miolo couché mate 150g.',
      format: 'A4 Fechado (210 x 297 mm)',
      material: 'Capa Cartão 2mm + Couché 170g / Miolo Couché Matte 150g',
      colors: '4/4 Cores CMYK',
      finishing: 'Coser com linha e cola PUR, Verniz UV Localizado, Gravação a Ouro',
      quantity: 500,
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
      clientId: insertedClients[1].id,
      product: 'Flyers e Cartazes Campanha 5G',
      description: 'Flyers promocionais A5 frente e verso com cores vibrantes da marca.',
      format: 'A5 (148 x 210 mm)',
      material: 'Couché Brilho 135g',
      colors: '4/4 Cores CMYK',
      finishing: 'Corte recto e empacotamento em lotes de 250 unidades',
      quantity: 10000,
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
      clientId: insertedClients[3].id,
      product: 'Cartões de Visita Premium com Verniz Localizado',
      description: 'Cartões executivos frente e verso com laminação Soft Touch e verniz UV 3D.',
      format: '85 x 55 mm com cantos arredondados',
      material: 'Cartolina Splendorgel 350g',
      colors: '4/4 Cores',
      finishing: 'Laminação Soft Touch + Verniz UV 3D Reserva + Cantos Redondos',
      quantity: 2000,
      dueDate: '2026-10-14',
      priority: 'NORMAL',
      amount: 320000,
      responsible: 'Mateus Designer',
      assignedDesigner: 'Mateus Designer',
      observations: 'Cliente quer validar espessura e efeito do relevo.',
      status: 'AGUARDA_APROVACAO_AMOSTRA',
      createdBy: 'usr_atend',
    }).returning();

    // 4. Versao de arte e link de aprovacao publica
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

    // 5. Ordem de Producao (OP-2026-001)
    const op1 = await db.insert(schema.productionOrdersTable).values({
      orderCode: 'OP-2026-001',
      ticketId: tck1[0].id,
      clientId: tck1[0].clientId,
      product: tck1[0].product,
      quantity: tck1[0].quantity,
      format: tck1[0].format,
      material: tck1[0].material,
      colors: tck1[0].colors,
      finishing: tck1[0].finishing,
      amount: tck1[0].amount,
      dueDate: tck1[0].dueDate,
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

    console.log('Banco de dados inicializado e populado com sucesso!');
  } else {
    console.log(`Banco de dados ja contém ${existingClients.length} clientes. Pronto para uso!`);
  }

  await pglite.close();
}

migrateAndSeed().catch((err) => {
  console.error('Erro na migracao:', err);
  process.exit(1);
});

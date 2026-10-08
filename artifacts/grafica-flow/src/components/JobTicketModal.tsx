import React from 'react';
import { Printer, X, CheckSquare, ShieldCheck, Factory, Calendar, User, Package, FileText } from 'lucide-react';

interface JobTicketModalProps {
  order: any;
  onClose: () => void;
}

export function JobTicketModal({ order, onClose }: JobTicketModalProps) {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat('pt-AO', {
        timeZone: 'Africa/Luanda',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (val?: number | string | null) => {
    if (!val) return '—';
    const num = Number(val);
    return isNaN(num) ? String(val) : num.toLocaleString('pt-AO') + ' Kz';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-card text-foreground rounded-2xl border border-border shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95">
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-4 border-b border-border flex items-center justify-between print:hidden bg-muted/40">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary grid place-items-center font-bold">
              <Printer size={17} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Ficha de Obra / Guia de Produção Industrial</h2>
              <p className="text-xs text-muted-foreground">Pronta para impressão A4 ou exportação em PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn btn-primary btn-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer size={15} /> Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-border grid place-items-center hover:bg-muted cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Job Ticket Content */}
        <div className="p-6 sm:p-8 overflow-y-auto printable-job-ticket bg-white text-slate-900" id="job-ticket-content">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #job-ticket-content, #job-ticket-content * {
                visibility: visible;
              }
              #job-ticket-content {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 15mm;
                background: white !important;
                color: black !important;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `}</style>

          {/* Cabeçalho da Gráfica */}
          <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-md bg-slate-900 text-white font-black text-lg grid place-items-center">
                  GF
                </span>
                <div>
                  <h1 className="font-extrabold text-2xl tracking-tight text-slate-900 uppercase">
                    Gráfica Flow
                  </h1>
                  <span className="text-[10px] tracking-widest text-slate-600 font-semibold uppercase">
                    Gestão de Produção Gráfica · Luanda
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded uppercase tracking-wider mb-1">
                Ficha de Obra (Job Ticket)
              </span>
              <div className="text-xl font-black font-mono text-slate-900">{order.orderCode}</div>
              <div className="text-xs text-slate-600 font-mono">Ref. Ticket: {order.ticketCode}</div>
            </div>
          </div>

          {/* Metadados Chave em Destaque */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-100 p-3.5 rounded-lg border border-slate-300 mb-5 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Emissão</span>
              <span className="font-semibold text-slate-900">{formatDate(order.createdAt || new Date().toISOString())}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Prazo de Entrega</span>
              <span className="font-black text-rose-700 font-mono text-sm">{formatDate(order.dueDate)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Tiragem Total</span>
              <span className="font-black text-slate-900 font-mono text-sm">{Number(order.quantity).toLocaleString('pt-AO')} un.</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Arte Aprovada</span>
              <span className="font-semibold text-slate-900 font-mono">V{order.approvedVersion} ({order.approvedFileName})</span>
            </div>
          </div>

          {/* Dados do Cliente e do Trabalho */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="border border-slate-300 rounded-lg p-3 text-xs space-y-1.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                1. Identificação do Cliente
              </h3>
              <div><strong className="text-slate-700">Cliente:</strong> <span className="font-bold text-slate-900">{order.clientName}</span></div>
              {order.company && <div><strong className="text-slate-700">Empresa:</strong> <span>{order.company}</span></div>}
              {order.contact && <div><strong className="text-slate-700">Contacto:</strong> <span>{order.contact}</span></div>}
              {order.phone && <div><strong className="text-slate-700">Telefone:</strong> <span>{order.phone}</span></div>}
            </div>

            <div className="border border-slate-300 rounded-lg p-3 text-xs space-y-1.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                2. Especificação do Produto
              </h3>
              <div><strong className="text-slate-700">Produto:</strong> <span className="font-bold text-slate-900">{order.product}</span></div>
              <div><strong className="text-slate-700">Formato:</strong> <span>{order.format || 'A confirmar'}</span></div>
              <div><strong className="text-slate-700">Material/Papel:</strong> <span>{order.material || 'A confirmar'}</span></div>
              <div><strong className="text-slate-700">Cores:</strong> <span className="font-mono font-bold text-slate-900">{order.colors || '4/4 CMYK'}</span></div>
              <div><strong className="text-slate-700">Acabamento:</strong> <span>{order.finishing || 'Corte recto'}</span></div>
            </div>
          </div>

          {/* Roteiro e Fila de Máquinas no Chão de Fábrica */}
          <div className="mb-5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
              <Factory size={15} /> 3. Roteiro Operacional de Máquinas & Validações
            </h3>
            
            <table className="w-full text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-800 text-left">
                  <th className="p-2 border border-slate-300">Etapa Industrial</th>
                  <th className="p-2 border border-slate-300">Máquina / Equipamento</th>
                  <th className="p-2 border border-slate-300">Especificação Operacional</th>
                  <th className="p-2 border border-slate-300 text-center w-20">Quebra</th>
                  <th className="p-2 border border-slate-300 text-center w-28">Operador / Visto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2 border border-slate-300 font-bold">1. Pré-Impressão (CTP)</td>
                  <td className="p-2 border border-slate-300">CTP Agfa Avalon</td>
                  <td className="p-2 border border-slate-300 text-[11px]">
                    Gravação de chapas, calibração de curvas, verificação de densitometria.
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono">0</td>
                  <td className="p-2 border border-slate-300 text-center">
                    <div className="h-6 border-b border-dashed border-slate-400 mt-2"></div>
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 font-bold">2. Impressão Offset</td>
                  <td className="p-2 border border-slate-300">Heidelberg SM 74</td>
                  <td className="p-2 border border-slate-300 text-[11px]">
                    Tiragem: {Number(order.quantity).toLocaleString('pt-AO')} folhas. Tolerância de afinação: 5%.
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">~5%</td>
                  <td className="p-2 border border-slate-300 text-center">
                    <div className="h-6 border-b border-dashed border-slate-400 mt-2"></div>
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 font-bold">3. Acabamento</td>
                  <td className="p-2 border border-slate-300">Guilhotina / Dobra</td>
                  <td className="p-2 border border-slate-300 text-[11px]">
                    Corte nas marcas de registo, vinco, empacotamento em lotes.
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono">—</td>
                  <td className="p-2 border border-slate-300 text-center">
                    <div className="h-6 border-b border-dashed border-slate-400 mt-2"></div>
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300 font-bold">4. Qualidade & Expedição</td>
                  <td className="p-2 border border-slate-300">Mesa de Inspecção</td>
                  <td className="p-2 border border-slate-300 text-[11px]">
                    Inspeção visual da cor, contagem final, guia de entrega e embalagem.
                  </td>
                  <td className="p-2 border border-slate-300 text-center font-mono">0</td>
                  <td className="p-2 border border-slate-300 text-center">
                    <div className="h-6 border-b border-dashed border-slate-400 mt-2"></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Checklist de Qualidade Pré-Saída */}
          <div className="border border-slate-300 rounded-lg p-3 mb-5 text-xs bg-slate-50">
            <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-700 mb-2">
              4. Checklist de Libertação de Lote
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Conformidade de cor (CMYK)</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Marcas de corte e formato</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Registo e sobreposição</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Ausência de maculatura/defeitos</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Gramagem e toque do papel</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Contagem rigorosa de tiragem</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Embalagem protegida</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="rounded" /> Etiqueta de identificação</label>
            </div>
          </div>

          {/* Assinaturas de Responsabilidade */}
          <div className="border-t-2 border-slate-900 pt-4 grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 h-9 mb-1"></div>
              <span className="font-bold text-slate-800 block">Maquinista de Impressão</span>
              <span className="text-[10px] text-slate-500">Registo de Tiragem</span>
            </div>
            <div>
              <div className="border-b border-slate-400 h-9 mb-1"></div>
              <span className="font-bold text-slate-800 block">Controlo de Qualidade</span>
              <span className="text-[10px] text-slate-500">Aprovação Final</span>
            </div>
            <div>
              <div className="border-b border-slate-400 h-9 mb-1"></div>
              <span className="font-bold text-slate-800 block">Expedição / Cliente</span>
              <span className="text-[10px] text-slate-500">Recepção de Lote</span>
            </div>
          </div>

          <div className="mt-5 text-center text-[9px] text-slate-400">
            Documento de circulação interna · Gráfica Flow Sistema de Gestão Industrial · Emitido em Luanda
          </div>
        </div>
      </div>
    </div>
  );
}

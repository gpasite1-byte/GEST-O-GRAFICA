import React, { useState } from 'react';
import { Calculator, X, Check, ArrowRight, Layers, Coins, Sparkles, AlertCircle } from 'lucide-react';

interface PrintCalculatorModalProps {
  initialQuantity?: number;
  onApply: (calculatedAmount: number, calculationSummary: string) => void;
  onClose: () => void;
}

export function PrintCalculatorModal({ initialQuantity = 1000, onApply, onClose }: PrintCalculatorModalProps) {
  const [quantity, setQuantity] = useState(initialQuantity || 1000);
  const [sheetFormat, setSheetFormat] = useState('70x100');
  const [posesPerSheet, setPosesPerSheet] = useState(8);
  const [paperPricePerReam, setPaperPricePerReam] = useState(45000); // 500 folhas
  const [ctpPlateCount, setCtpPlateCount] = useState(4); // CMYK
  const [ctpPlatePrice, setCtpPlatePrice] = useState(12000); // por chapa
  const [printCostPer1000, setPrintCostPer1000] = useState(15000); // batimentos
  const [finishingCost, setFinishingCost] = useState(25000); // plastificação, corte
  const [profitMargin, setProfitMargin] = useState(35); // 35%

  // Cálculos Técnicos Gráficos
  const netSheets = Math.ceil(quantity / Math.max(1, posesPerSheet));
  const wasteSheets = Math.ceil(netSheets * 0.05); // 5% de quebra/afinação
  const totalSheets = netSheets + wasteSheets;
  const reamsNeeded = totalSheets / 500;

  // Custos de Produção
  const paperCost = Math.ceil(reamsNeeded * paperPricePerReam);
  const ctpCost = ctpPlateCount * ctpPlatePrice;
  const printRuns = Math.ceil(totalSheets / 1000);
  const printingCost = printRuns * printCostPer1000;
  const totalProductionCost = paperCost + ctpCost + printingCost + finishingCost;

  // Preço de Venda com Margem
  const suggestedSellingPrice = Math.ceil(totalProductionCost * (1 + profitMargin / 100));
  const unitPrice = (suggestedSellingPrice / Math.max(1, quantity)).toFixed(2);

  const handleApply = () => {
    const summary = `[Cálculo Gráfico]: Tiragem: ${quantity.toLocaleString('pt-AO')} un | Poses/folha: ${posesPerSheet} | Total Folhas: ${totalSheets} (${reamsNeeded.toFixed(1)} resmas) | Custo Papel: ${paperCost.toLocaleString('pt-AO')} Kz | CTP (${ctpPlateCount} chapas): ${ctpCost.toLocaleString('pt-AO')} Kz | Impressão: ${printingCost.toLocaleString('pt-AO')} Kz | Acabamento: ${finishingCost.toLocaleString('pt-AO')} Kz | Margem: ${profitMargin}%`;
    onApply(suggestedSellingPrice, summary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-card text-foreground rounded-2xl border border-border shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center font-bold">
              <Calculator size={19} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">Calculadora Técnica de Custos & Orçamento</h2>
              <p className="text-xs text-muted-foreground">Estimativa de consumo de papel, chapas CTP e batimentos de máquina</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border grid place-items-center hover:bg-muted cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* 1. Tiragem & Imposição */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Layers size={14} className="text-primary" /> 1. Tiragem e Imposição na Folha de Máquina
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Tiragem Desejada (un)</label>
                <input
                  type="number"
                  min="1"
                  className="control font-mono font-bold"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Formato de Entrada</label>
                <select
                  className="control font-mono text-xs"
                  value={sheetFormat}
                  onChange={(e) => setSheetFormat(e.target.value)}
                >
                  <option value="70x100">70 × 100 cm (B1)</option>
                  <option value="64x90">64 × 90 cm (Formato 1)</option>
                  <option value="50x70">50 × 70 cm (B2 - Half)</option>
                  <option value="SRA3">SRA3 (32 × 45 cm)</option>
                  <option value="A3">A3 (29.7 × 42 cm)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Poses por Folha</label>
                <input
                  type="number"
                  min="1"
                  className="control font-mono font-bold"
                  value={posesPerSheet}
                  onChange={(e) => setPosesPerSheet(Number(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>

          {/* 2. Custos Unitários */}
          <div className="border-t border-border/60 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Coins size={14} className="text-primary" /> 2. Tabela de Custos e Insumos
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Preço/Resma (500 fl)</label>
                <input
                  type="number"
                  className="control font-mono"
                  value={paperPricePerReam}
                  onChange={(e) => setPaperPricePerReam(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Nº Chapas CTP</label>
                <input
                  type="number"
                  className="control font-mono"
                  value={ctpPlateCount}
                  onChange={(e) => setCtpPlateCount(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Custo/Chapa (Kz)</label>
                <input
                  type="number"
                  className="control font-mono"
                  value={ctpPlatePrice}
                  onChange={(e) => setCtpPlatePrice(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Acabamentos (Kz)</label>
                <input
                  type="number"
                  className="control font-mono"
                  value={finishingCost}
                  onChange={(e) => setFinishingCost(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* 3. Margem de Lucro */}
          <div className="border-t border-border/60 pt-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-foreground block">Margem Comercial Pretendida</span>
              <span className="text-[11px] text-muted-foreground">Sobre o custo global de produção</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                className="w-28 sm:w-36"
                value={profitMargin}
                onChange={(e) => setProfitMargin(Number(e.target.value))}
              />
              <span className="font-mono font-bold text-xs bg-secondary px-2.5 py-1 rounded-md min-w-[50px] text-center">
                {profitMargin}%
              </span>
            </div>
          </div>

          {/* Resumo do Cálculo em Destaque */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-primary/10 pb-2">
              <span className="text-muted-foreground">Consumo de Papel:</span>
              <span className="font-mono font-semibold">
                {totalSheets} folhas ({reamsNeeded.toFixed(2)} resmas c/ 5% quebra)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
              <div>Papel: <strong className="text-foreground">{paperCost.toLocaleString('pt-AO')} Kz</strong></div>
              <div>CTP: <strong className="text-foreground">{ctpCost.toLocaleString('pt-AO')} Kz</strong></div>
              <div>Impressão: <strong className="text-foreground">{printingCost.toLocaleString('pt-AO')} Kz</strong></div>
              <div>Acabamento: <strong className="text-foreground">{finishingCost.toLocaleString('pt-AO')} Kz</strong></div>
            </div>
            <div className="border-t border-primary/10 pt-2 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-bold text-foreground block">Preço de Venda Sugerido</span>
                <span className="text-[10px] text-muted-foreground font-mono">({unitPrice} Kz / unidade)</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-primary">
                {suggestedSellingPrice.toLocaleString('pt-AO')} Kz
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <button
            onClick={onClose}
            className="btn btn-sm cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="btn btn-primary btn-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Check size={15} /> Aplicar Valor ao Pedido
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Calculator, Info, Check, Coins, AlertCircle, TrendingUp, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Precificacao({ isPrivateMode }: { isPrivateMode: boolean }) {
  // Calculator inputs
  const [custoAquisicao, setCustoAquisicao] = useState<number>(30); // R$ 30,00 cost
  const [despesasOperacionaisPct, setDespesasOperacionaisPct] = useState<number>(15); // 15% taxes, fees
  const [margemLucroDesejadaPct, setMargemLucroDesejadaPct] = useState<number>(30); // 30% desired profit

  // Break-even inputs
  const [despesasFixasMensais, setDespesasFixasMensais] = useState<number>(1500); // R$ 1.500,00 fixed costs

  // Pricing math: Margin Markup formula
  // Selling Price = Cost / (1 - (Overhead% + Profit%) / 100)
  const somaPercentuais = despesasOperacionaisPct + margemLucroDesejadaPct;
  const divisor = 1 - (somaPercentuais / 100);

  // If divisor is <= 0 (percent sums >= 100), handle safely
  const precoSugerido = divisor > 0.05 
    ? custoAquisicao / divisor 
    : custoAquisicao * (1 + (somaPercentuais/100) * 1.5); 

  const markupReal = custoAquisicao > 0 ? precoSugerido / custoAquisicao : 0;
  
  const despesasOperacionaisValor = precoSugerido * (despesasOperacionaisPct / 100);
  const lucroLiquidoUnitario = precoSugerido - custoAquisicao - despesasOperacionaisValor;
  const margemContribuicaoPct = precoSugerido > 0 ? (lucroLiquidoUnitario / precoSugerido) * 100 : 0;

  // Break-even math (in units)
  // Break-even Qty = Fixed Expenses / Contribution Margin
  const breakevenUnidades = lucroLiquidoUnitario > 0 
    ? Math.ceil(despesasFixasMensais / lucroLiquidoUnitario) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="relative overflow-hidden bg-secondary border border-foreground/5 p-6 rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#00C853] bg-[#00C853]/10 px-3 py-1.5 rounded-full mb-2 inline-block">
            Simulador de Margens de Lucratividade
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Precificação & Lucratividade</h1>
          <p className="text-xs text-muted mt-1 font-sans">Aprenda a precificar corretamento seus produtos para pagar contas e gerar lucros.</p>
        </div>
        <div className="bg-background/40 p-4 rounded-2xl border border-foreground/5 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C853]/15 rounded-xl flex items-center justify-center">
            <Calculator className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted font-bold uppercase">Teoria Margem Markup</p>
            <p className="text-xs text-white font-extrabold flex items-center gap-1">Fórmula Integrada <Check className="w-3.5 h-3.5 text-primary" /></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Interactive Calculator Card (7 cols) */}
        <div className="lg:col-span-7 bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-6">
          <div>
            <h3 className="font-extrabold text-white text-base">Calculadora de Preço de Venda ideal</h3>
            <p className="text-xs text-muted">Ajuste os controles deslizantes ou digite os valores do seu produto.</p>
          </div>

          <div className="space-y-6">
            {/* Slider 1: Cost Price */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                <label className="text-white">Custo de Aquisição / Produção*</label>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/5 py-1 px-3.5 rounded-xl">
                  <span className="text-xs text-muted">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={custoAquisicao || ''}
                    onChange={(e) => setCustoAquisicao(Math.max(0.1, parseFloat(e.target.value) || 0))}
                    className="w-16 bg-transparent text-white font-extrabold outline-none text-right"
                  />
                </div>
              </div>
              <p className="text-xs text-muted">Custo de compra por atacado, frete rateado e matéria-prima de confecção do item.</p>
              <input
                type="range"
                min="1"
                max="500"
                step="1"
                value={custoAquisicao}
                onChange={(e) => setCustoAquisicao(parseFloat(e.target.value))}
                className="w-full accent-primary h-1 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Slider 2: Operational Overhead Pct */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                <label className="text-white">Despesas Variáveis sobre Venda (%)</label>
                <div className="flex items-center gap-1 bg-background border border-foreground/5 py-1 px-3.5 rounded-xl">
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={despesasOperacionaisPct || ''}
                    onChange={(e) => setDespesasOperacionaisPct(Math.min(90, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-yellow-500 font-extrabold outline-none text-right"
                  />
                  <span className="text-xs text-muted">%</span>
                </div>
              </div>
              <p className="text-xs text-muted">Soma de Impostos, comissões de vendedores, taxa de maquininha de cartão e embalagem.</p>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={despesasOperacionaisPct}
                onChange={(e) => setDespesasOperacionaisPct(parseInt(e.target.value))}
                className="w-full accent-yellow-500 h-1 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Slider 3: Desired gain */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                <label className="text-white font-sans">Margem de Lucro Desejada (%)</label>
                <div className="flex items-center gap-1 bg-background border border-foreground/5 py-1 px-3.5 rounded-xl">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={margemLucroDesejadaPct || ''}
                    onChange={(e) => setMargemLucroDesejadaPct(Math.min(90, Math.max(1, parseInt(e.target.value) || 0)))}
                    className="w-10 bg-transparent text-primary font-extrabold outline-none text-right"
                  />
                  <span className="text-xs text-muted">%</span>
                </div>
              </div>
              <p className="text-xs text-muted">O retorno líquido que você quer que sobre para o caixa da empresa para reinvestimentos.</p>
              <input
                type="range"
                min="5"
                max="80"
                step="1"
                value={margemLucroDesejadaPct}
                onChange={(e) => setMargemLucroDesejadaPct(parseInt(e.target.value))}
                className="w-full accent-primary h-1 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Theoretical info alert */}
          <div className="bg-background/40 p-4 border border-foreground/5 rounded-2xl flex items-start gap-2.5 text-xs text-muted">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p><strong>Atenção:</strong> Cobrar 50% de lucro adicionando R$ 15 sobre um item de R$ 30 produz R$ 45, o que é um engano operacional! A despesa variável drena o lucro sobre o valor global da venda de R$ 45, diminuindo sua margem ideal. Esta fórmula de markup comercial assegura os faturamentos reais.</p>
          </div>
        </div>

        {/* Right Output results Card & Break-even section (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Output Display */}
          <div className="bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-6 relative overflow-hidden group">
            <div>
              <h3 className="font-extrabold text-white text-base">Preço de Venda Recomendado</h3>
              <p className="text-xs text-muted">Resultado científico para sua prateleira comercial.</p>
            </div>

            <div className="p-6 bg-background rounded-2xl text-center space-y-1 relative z-10 border border-primary/20">
              <p className="text-xs text-muted font-bold uppercase tracking-wider">Preço de Venda Ideal</p>
              <h2 className="text-4xl font-black text-white">
                R$ {isPrivateMode ? '•••' : precoSugerido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div className="pt-2 text-[11px] text-[#00C853] font-bold flex items-center justify-center gap-1">
                <Coins className="w-3.5 h-3.5" /> Markup Multiplicador: {markupReal.toFixed(2)}x o custo
              </div>
            </div>

            {/* Price components break */}
            <div className="space-y-3 pb-2 border-b border-foreground/5 text-xs font-semibold text-muted">
              <div className="flex justify-between">
                <span>Custo Inicial do Produto (C)</span>
                <span className="text-white">R$ {custoAquisicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxas & Despesas Variáveis ({despesasOperacionaisPct}%)</span>
                <span className="text-white">R$ {despesasOperacionaisValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Margem Líquida que sobra (R$)</span>
                <span className="text-primary font-bold">R$ {lucroLiquidoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Break-even point box */}
          <div className="bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-4">
            <div>
              <h3 className="font-extrabold text-white text-base">Simulador de Ponto de Equilíbrio</h3>
              <p className="text-xs text-muted">Quantas unidades você precisa vender para cobrir as despesas fixas do seu negócio?</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-muted font-bold uppercase">Sua Despesa Fixa Mensal Total (R$)*</label>
                <div className="flex items-center gap-2 bg-background border border-foreground/10 p-3.5 rounded-2xl">
                  <span className="text-sm text-muted">R$</span>
                  <input
                    type="number"
                    value={despesasFixasMensais || ''}
                    onChange={(e) => setDespesasFixasMensais(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-transparent text-white font-extrabold outline-none text-sm"
                    placeholder="Ex: 1500"
                  />
                </div>
                <p className="text-[10px] text-muted">Ex: Aluguel do ponto + internet + conta de luz + folha salarial.</p>
              </div>

              {breakevenUnidades > 0 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/15 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-yellow-500 font-bold mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>Meta de Sobrevivência</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Você precisa vender no mínimo <span className="text-white font-black text-sm">{breakevenUnidades} unidades</span> deste produto por mês para liquidar suas despesas fixas de <span className="font-bold text-white">R$ {despesasFixasMensais.toLocaleString('pt-BR')}</span>. Qualquer venda acima disso representará lucro puro de reinvestimento!
                  </p>
                </div>
              ) : (
                <div className="bg-foreground/5 p-4 rounded-2xl text-center text-xs text-muted">
                  Insira uma margem de lucro positiva e custo válido para simular o Break-Even point.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

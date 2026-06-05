import React, { useState } from 'react';
import { Transacao } from '../types';
import { BarChart3, LineChart, PieChart, Info, DollarSign, Calendar, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart as RechartsPieChart,
  Pie
} from 'recharts';

interface RelatoriosProps {
  transacoes: Transacao[];
  isPrivateMode: boolean;
}

export default function Relatorios({ transacoes, isPrivateMode }: RelatoriosProps) {
  const [periodo, setPeriodo] = useState<'semanal' | 'mensal'>('semanal');

  // filter paid transactions
  const transacoesPagas = transacoes.filter(t => t.status === 'pago');

  // helper to get date strings
  const getNDaysAgoStr = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };

  // Compile data for last 7 days
  const generateWeeklyData = () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const data = [];
    
    // Last 7 calendar days
    for (let i = 6; i >= 0; i--) {
      const dateStr = getNDaysAgoStr(i);
      const dayDate = new Date(dateStr + 'T00:00:00');
      const dayLabel = days[dayDate.getDay()];
      const daySuffix = dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }).split('/')[0];
      
      const dayTrans = transacoesPagas.filter(t => t.data === dateStr);
      const faturamento = dayTrans.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0);
      const custos = dayTrans.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0);
      const lucro = faturamento - custos;

      data.push({
        name: `${dayLabel} (${daySuffix})`,
        faturamento,
        custos,
        lucro
      });
    }
    return data;
  };

  // Compile data for last 4 months
  const generateMonthlyData = () => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const today = new Date();
    const data = [];

    // Last 4 months rolling
    for (let i = 3; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthIdx = d.getMonth();
      const yearStr = d.getFullYear().toString().substring(2, 4);
      const monthLabel = `${months[monthIdx]}/${yearStr}`;

      const monthTrans = transacoesPagas.filter(t => {
        try {
          const tDate = new Date(t.data + 'T00:00:00');
          return tDate.getMonth() === monthIdx && tDate.getFullYear() === d.getFullYear();
        } catch (e) {
          return false;
        }
      });

      const faturamento = monthTrans.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0);
      const custos = monthTrans.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0);
      const lucro = faturamento - custos;

      data.push({
        name: monthLabel,
        faturamento,
        custos,
        lucro
      });
    }
    return data;
  };

  const chartData = periodo === 'semanal' ? generateWeeklyData() : generateMonthlyData();

  // Aggregate Category Outflows
  const categoryOutflows = React.useMemo(() => {
    const map: Record<string, number> = {};
    transacoesPagas.filter(t => t.tipo === 'saida').forEach(t => {
      map[t.categoria] = (map[t.categoria] || 0) + t.valor;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [transacoesPagas]);

  // Aggregate totals for header summary in chart view
  const totalFaturamento = chartData.reduce((acc, curr) => acc + curr.faturamento, 0);
  const totalCustos = chartData.reduce((acc, curr) => acc + curr.custos, 0);
  const totalMargemLíquida = totalFaturamento - totalCustos;
  const margemLucroPct = totalFaturamento > 0 ? (totalMargemLíquida / totalFaturamento) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="relative overflow-hidden bg-secondary border border-foreground/5 p-6 rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#00C853] bg-[#00C853]/10 px-3 py-1.5 rounded-full mb-2 inline-block">
            Métricas de Negócio
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Painel de Relatórios</h1>
          <p className="text-xs text-muted mt-1">Acompanhe seus lucros operacionais e custos de prateleira em gráficos minimalistas.</p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-background border border-foreground/5 p-1 rounded-2xl">
          <button
            onClick={() => setPeriodo('semanal')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              periodo === 'semanal'
                ? 'bg-primary text-background'
                : 'text-muted hover:text-white'
            }`}
          >
            Faturamento Semanal (Lançamentos Diários)
          </button>
          <button
            onClick={() => setPeriodo('mensal')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              periodo === 'mensal'
                ? 'bg-primary text-background'
                : 'text-muted hover:text-white'
            }`}
          >
            Mensal (Histórico Consolidado)
          </button>
        </div>
      </div>

      {/* Stats Summary Cards for the Chart Selected */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Faturamento bruto */}
        <div className="bg-secondary p-5 border border-foreground/5 rounded-3xl">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Volumetria de Caixa</p>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-xl">
              R$ {isPrivateMode ? '•••' : totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Faturamento Bruto totalizado
          </p>
        </div>

        {/* Custos operacionais */}
        <div className="bg-secondary p-5 border border-foreground/5 rounded-3xl">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Custo de Operação / Compras</p>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-red-500 text-xl">
              R$ {isPrivateMode ? '•••' : totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-red-400 font-bold mt-1.5 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Gastos e mercadorias compradas
          </p>
        </div>

        {/* Lucro Líquido */}
        <div className="bg-secondary p-5 border border-foreground/5 rounded-3xl">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Resultado Líquido Final</p>
          <div className="flex items-center gap-2">
            <span className={`font-black text-xl ${totalMargemLíquida >= 0 ? 'text-primary' : 'text-red-500'}`}>
              R$ {isPrivateMode ? '•••' : totalMargemLíquida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className={`text-[10px] font-bold mt-1.5 flex items-center gap-1 ${totalMargemLíquida >= 0 ? 'text-primary' : 'text-red-400'}`}>
            <ArrowUpRight className="w-3 h-3" /> {totalMargemLíquida >= 0 ? 'Lucro Líquido Realizado' : 'Prejuízo Operacional'}
          </p>
        </div>

        {/* Margem nominal */}
        <div className="bg-secondary p-5 border border-foreground/5 rounded-3xl">
          <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Margem de Lucratividade</p>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-xl">
              {margemLucroPct.toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-muted font-medium mt-1.5">
            Eficiência líquida das vendas
          </p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Double Area Chart: Gross Revenue vs Costs (7 cols) */}
        <div className="lg:col-span-8 bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-4">
          <div>
            <h3 className="font-extrabold text-white text-base">Faturamento Bruto vs. Custos</h3>
            <p className="text-xs text-muted">Acompanhamento visual de entradas (verde) e saídas liquidadas (cinza).</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C853" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00C853" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCustos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="name" stroke="#5d5d67" fontSize={11} tickLine={false} />
                <YAxis stroke="#5d5d67" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}
                  labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="faturamento" name="Faturamento (R$)" stroke="#00C853" strokeWidth={3} fillOpacity={1} fill="url(#colorFaturamento)" />
                <Area type="monotone" dataKey="custos" name="Custos (R$)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCustos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lucro Líquido bar chart (4 cols) */}
        <div className="lg:col-span-4 bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-white text-base">Resultado Líquido</h3>
            <p className="text-xs text-muted">Abaixo de zero indica prejuízo; acima, lucro real.</p>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#202020" vertical={false} />
                <XAxis dataKey="name" stroke="#5d5d67" fontSize={10} tickLine={false} />
                <YAxis stroke="#5d5d67" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="lucro" name="Lucro Líquido (R$)" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.lucro >= 0 ? '#00C853' : '#ef4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-background/40 p-4 border border-foreground/5 rounded-2xl flex items-start gap-2 text-xs text-muted leading-tight mt-2">
            <Info className="w-4 h-4 text-[#00C853] shrink-0 mt-0.5" />
            <p>O lucro líquido desconta todas as compras de mercadorias e contas fixas pagas do faturamento bruto das vendas.</p>
          </div>
        </div>
      </div>

      {/* Bottom Category distribution and financial advice list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category breakdown (outflows) */}
        <div className="bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-4">
          <div>
            <h3 className="font-extrabold text-white text-base">Maiores Concentrações de Despesas</h3>
            <p className="text-xs text-muted font-sans font-medium">Categorias onde ocorreram os maiores gastos de saída do fluxo.</p>
          </div>

          {categoryOutflows.length === 0 ? (
            <p className="text-sm text-muted italic py-12 text-center">Nenhum gasto registrado para consolidar.</p>
          ) : (
            <div className="space-y-4">
              {categoryOutflows.map((item, idx) => {
                const maxVal = categoryOutflows[0].value;
                const percentageOfMax = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
                
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{item.name}</span>
                      <span className="font-mono text-xs text-red-400 font-bold">
                        R$ {isPrivateMode ? '•••' : item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-background rounded-full overflow-hidden relative">
                      <div 
                        style={{ width: `${percentageOfMax}%` }}
                        className="h-full bg-gradient-to-r from-red-500/70 to-red-400 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Business Diagnostic recommendations */}
        <div className="bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-4">
          <div>
            <h3 className="font-extrabold text-white text-base">Diagnóstico do Caixa</h3>
            <p className="text-xs text-muted">Inteligência automatizada baseada no desempenho das transações pagas.</p>
          </div>

          <div className="space-y-3">
            {totalMargemLíquida > 0 ? (
              <div className="bg-[#00C853]/10 border border-[#00C853]/25 p-4 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">Superavitário</span>
                <p className="text-sm font-bold text-white mt-1">Sua empresa está gerando lucro!</p>
                <p className="text-xs text-muted">A margem de lucro operacional está em uma faixa positiva saudável de aproximadamente {margemLucroPct.toFixed(0)}%. Considere reter parte desse saldo em fundo de reserva para mercadorias de alto giro.</p>
              </div>
            ) : totalMargemLíquida < 0 ? (
              <div className="bg-red-500/10 border border-red-500/15 p-4 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-red-400 bg-red-400/10 px-2 py-0.5 rounded">Déficit</span>
                <p className="text-sm font-bold text-white mt-1">Atenção ao Ponto de Equilíbrio!</p>
                <p className="text-xs text-muted">As saídas estão maiores do que as entradas liquidas. Avalie reajustar suas margens de lucro urgentes de venda, reduzir despesas fixas excessivas ou renegociar lotes de mercadorias com distribuidores.</p>
              </div>
            ) : (
              <div className="bg-foreground/5 border border-foreground/10 p-4 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-muted bg-background px-2 py-0.5 rounded">Neutro</span>
                <p className="text-sm font-bold text-white mt-1">Fluxo sem dados liquidados.</p>
                <p className="text-xs text-muted">Adicione vendas efetuadas no PDV (Frente de Caixa) ou registre entradas recorrentes no painel "Financeiro" para obter diagnósticos em tempo real.</p>
              </div>
            )}

            <div className="p-4 bg-background/50 border border-foreground/5 rounded-2xl space-y-1.5 text-xs text-muted">
              <p className="font-bold text-white">Estratégias de Sobrevivência (Microempresas):</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Separe rigorosamente o caixa da empresa do bolso pessoal (pró-labore fixado).</li>
                <li>Mantenha um estoque mínimo equivalente a 2 semanas de fluxo normal de vendas.</li>
                <li>Pix imediato oferece maior poder de barganha para repor lotes à vista.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

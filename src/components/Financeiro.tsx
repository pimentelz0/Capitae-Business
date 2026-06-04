import React, { useState } from 'react';
import { Transacao } from '../types';
import { TrendingUp, TrendingDown, Plus, Trash2, Edit2, Calendar, FileText, CheckCircle, Clock, Filter, DollarSign, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FinanceiroProps {
  transacoes: Transacao[];
  onAddTransacao: (transacao: Omit<Transacao, 'id'>) => void;
  onUpdateTransacaoStatus: (id: string, novoStatus: 'pago' | 'pendente') => void;
  onDeleteTransacao: (id: string) => void;
  onEditTransacao?: (transacao: Transacao) => void;
  isPrivateMode: boolean;
}

export default function Financeiro({ transacoes, onAddTransacao, onUpdateTransacaoStatus, onDeleteTransacao, onEditTransacao, isPrivateMode }: FinanceiroProps) {
  const [subTab, setSubTab] = useState<'geral' | 'pagar' | 'receber'>('geral');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'hoje' | '7dias' | 'mes' | 'todos'>('mes');
  const [showAddForm, setShowAddForm] = useState(false);

  // Editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMeioPagamento, setEditingMeioPagamento] = useState<string | undefined>(undefined);

  // Form states
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [valor, setValor] = useState<number>(0);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [tipoRegistro, setTipoRegistro] = useState<'imediato' | 'pagar' | 'receber'>('imediato');
  const [vencimento, setVencimento] = useState(new Date().toISOString().split('T')[0]);

  // Categories suggestions by type
  const categoriasEntrada = ['Vendas', 'Prestação de Serviço', 'Rendimento', 'Aporte', 'Outros'];
  const categoriasSaida = ['Contas (Luz/Água)', 'Aluguel', 'Pró-labore', 'Matéria-prima', 'Mercadoria / Estoque', 'Internet / Telefone', 'Impostos', 'Marketing', 'Outros'];

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (valor <= 0 || !descricao || !categoria) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Determine status and dates
    const isPending = tipoRegistro === 'pagar' || tipoRegistro === 'receber';
    const status = isPending ? 'pendente' : 'pago';
    const finalVencimento = isPending ? vencimento : undefined;

    if (editingId) {
      if (onEditTransacao) {
        onEditTransacao({
          id: editingId,
          tipo,
          valor,
          descricao,
          categoria,
          data,
          tipo_registro: tipoRegistro,
          data_vencimento: finalVencimento,
          status,
          meio_pagamento: editingMeioPagamento
        });
      }
    } else {
      onAddTransacao({
        tipo,
        valor,
        descricao,
        categoria,
        data,
        tipo_registro: tipoRegistro,
        data_vencimento: finalVencimento,
        status
      });
    }

    handleCloseForm();
  };

  const handleStartEdit = (t: Transacao) => {
    setEditingId(t.id);
    setTipo(t.tipo);
    setValor(t.valor);
    setDescricao(t.descricao);
    setCategoria(t.categoria);
    setData(t.data);
    setTipo_registro_adapted(t.tipo_registro);
    setVencimento(t.data_vencimento || t.data);
    setEditingMeioPagamento(t.meio_pagamento);
    setShowAddForm(true);
  };

  const handleCloseForm = () => {
    setValor(0);
    setDescricao('');
    setCategoria('');
    setTipoRegistro('imediato');
    setEditingId(null);
    setEditingMeioPagamento(undefined);
    setShowAddForm(false);
  };

  // Helper helper to bypass typescript setter type mismatch warning if any
  const setTipo_registro_adapted = (val: 'imediato' | 'pagar' | 'receber') => {
    setTipoRegistro(val);
  };

  // Safe Date parsing & formatting
  const formatDateBrief = (dString: string) => {
    if (!dString) return '';
    try {
      const p = dString.split('-');
      if (p.length === 3) {
        return `${p[2]}/${p[1]}/${p[0].substring(2, 4)}`;
      }
      return dString;
    } catch (e) {
      return dString;
    }
  };

  // Filter logic based on timeframe
  const isMatchPeriod = (dateStr: string) => {
    if (!dateStr) return false;
    const itemDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filtroPeriodo === 'hoje') {
      const todayStr = today.toISOString().split('T')[0];
      return dateStr === todayStr;
    }
    if (filtroPeriodo === '7dias') {
      const diffTime = Math.abs(today.getTime() - itemDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    if (filtroPeriodo === 'mes') {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
    }
    return true; // all
  };

  // Separate ledgers
  const fluxoTransacoes = transacoes.filter(t => t.status === 'pago' && isMatchPeriod(t.data));
  const contasAPagar = transacoes.filter(t => t.tipo === 'saida' && t.status === 'pendente');
  const contasAReceber = transacoes.filter(t => t.tipo === 'entrada' && t.status === 'pendente');

  // Metrics aggregation
  const totalInflows = transacoes
    .filter(t => t.tipo === 'entrada' && t.status === 'pago' && isMatchPeriod(t.data))
    .reduce((sum, t) => sum + t.valor, 0);

  const totalOutflows = transacoes
    .filter(t => t.tipo === 'saida' && t.status === 'pago' && isMatchPeriod(t.data))
    .reduce((sum, t) => sum + t.valor, 0);

  const pendingPayablesVal = contasAPagar.reduce((sum, t) => sum + t.valor, 0);
  const pendingReceivablesVal = contasAReceber.reduce((sum, t) => sum + t.valor, 0);

  const saldoFinal = totalInflows - totalOutflows;

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="relative overflow-hidden bg-secondary border border-foreground/5 p-6 rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#00C853] bg-[#00C853]/10 px-3 py-1.5 rounded-full mb-2 inline-block">
            Controle de Fluxo de Caixa
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Financeiro</h1>
          <p className="text-xs text-muted mt-1">Lançamento rápido de entradas/saídas e controle de duplicatas.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            console.log('Financeiro: Lançar Transação button clicked! Current state:', showAddForm);
            setTipo('entrada');
            setShowAddForm(!showAddForm);
          }}
          className="relative z-20 cursor-pointer px-6 py-3.5 bg-primary hover:bg-opacity-95 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-[0_4px_20px_rgba(0,200,83,0.25)] active:scale-98 flex items-center gap-2"
        >
          <Plus className="w-4 h-4 font-black" />
          Lançar Transação
        </button>
      </div>

      {/* Grid of Financial Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Faturamento do Período */}
        <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 relative overflow-hidden group">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Entradas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-white">
            R$ {isPrivateMode ? '••••••' : totalInflows.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="flex justify-between items-center mt-3 text-[10px] text-muted">
            <span>Faturamento Bruto</span>
            <span className="text-emerald-400 font-bold">Liquidado</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors" />
        </div>

        {/* Card 2: Custos / Despesas */}
        <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 relative overflow-hidden group">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Saídas</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-white">
            R$ {isPrivateMode ? '••••••' : totalOutflows.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="flex justify-between items-center mt-3 text-[10px] text-muted">
            <span>Compras e Despesas</span>
            <span className="text-red-400 font-bold">Pago</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-red-500/5 rounded-full blur-xl group-hover:bg-red-500/10 transition-colors" />
        </div>

        {/* Card 3: Saldo Final */}
        <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 relative overflow-hidden group">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Saldo Líquido</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h2 className={`text-3xl font-black ${saldoFinal < 0 ? 'text-red-500' : 'text-primary'}`}>
            R$ {isPrivateMode ? '••••••' : saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="flex justify-between items-center mt-3 text-[10px] text-muted">
            <span>Lucro Operacional</span>
            <span className={`${saldoFinal < 0 ? 'text-red-400' : 'text-primary'} font-bold`}>
              {saldoFinal < 0 ? 'Defasagem' : 'Superavit'}
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors" />
        </div>
      </div>

      {/* Dynamic Add Transaction Form Modal Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-secondary border border-foreground/5 rounded-[32px] shadow-2xl overflow-hidden animate-fadeIn my-auto">
            <div className="p-6 border-b border-foreground/5 flex justify-between items-center bg-background/60 relative z-10">
              <h3 className="font-bold text-base text-white">{editingId ? 'Editar Lançamento' : 'Lançar Nova Transação'}</h3>
              <button 
                type="button"
                onClick={handleCloseForm}
                className="text-xs text-muted hover:text-white bg-foreground/5 px-3 py-1.5 rounded-xl transition-all hover:bg-foreground/10"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[80vh] overflow-y-auto relative z-10">
              <div className="space-y-4">
                {/* Type Selection */}
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Tipo de Lançamento</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTipo('entrada')}
                      className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        tipo === 'entrada' 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                          : 'bg-background hover:bg-foreground/5 text-muted border border-transparent'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Entrada (Receita / Venda)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipo('saida')}
                      className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        tipo === 'saida' 
                          ? 'bg-red-500/10 border border-red-500/20 text-red-500' 
                          : 'bg-background hover:bg-foreground/5 text-muted border border-transparent'
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      Saída (Despesa / Conta)
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Valor (R$)*</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={valor === 0 ? '' : valor}
                    onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary transition-all font-bold text-base"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Descrição / Beneficiário*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Conta de Luz CPFL, Venda de Mercadoria..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {/* Category Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Categoria*</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    required
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white text-sm outline-none focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="" disabled>Selecione uma categoria...</option>
                    {(tipo === 'entrada' ? categoriasEntrada : categoriasSaida).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Data do Lançamento</label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm transition-all"
                  />
                </div>

                {/* Status / Recurrence Schedule */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs text-muted font-bold uppercase">Liquidação</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTipoRegistro('imediato')}
                        className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                          tipoRegistro === 'imediato'
                            ? 'bg-primary/10 border border-primary/20 text-primary'
                            : 'bg-background hover:bg-foreground/5 text-muted'
                        }`}
                      >
                        Pago / Recebido Hoje
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoRegistro(tipo === 'entrada' ? 'receber' : 'pagar')}
                        className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                          tipoRegistro !== 'imediato'
                            ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500'
                            : 'bg-background hover:bg-foreground/5 text-muted'
                        }`}
                      >
                        Agendar Vencimento
                      </button>
                    </div>
                  </div>

                  {tipoRegistro !== 'imediato' && (
                    <div className="space-y-2 col-span-2">
                      <label className="text-xs text-muted font-bold uppercase">Data de Vencimento*</label>
                      <input
                        type="date"
                        required
                        value={vencimento}
                        onChange={(e) => setVencimento(e.target.value)}
                        className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm transition-all"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 bg-primary text-background font-bold rounded-2xl transition-all shadow-lg hover:bg-opacity-95 text-xs tracking-wider uppercase"
                  >
                    {editingId ? 'Salvar Edições' : 'Salvar Registro'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Tabs (Fluxo x Contas a Pagar x Contas a Receber) */}
      <div className="bg-secondary border border-foreground/5 rounded-[32px] overflow-hidden">
        {/* Navigation Tabs */}
        <div className="p-4 bg-background/50 border-b border-foreground/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setSubTab('geral')}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                subTab === 'geral' 
                  ? 'bg-foreground/10 text-white' 
                  : 'text-muted hover:bg-foreground/5 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Geral (Fluxo Realizado)
            </button>

            <button
              onClick={() => setSubTab('pagar')}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 relative ${
                subTab === 'pagar' 
                  ? 'bg-red-500/10 text-red-500 border border-red-500/10' 
                  : 'text-muted hover:bg-foreground/5 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Contas a Pagar
              {contasAPagar.length > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-background font-black text-[9px] rounded-full">
                  {contasAPagar.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setSubTab('receber')}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 relative ${
                subTab === 'receber' 
                  ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/10' 
                  : 'text-muted hover:bg-foreground/5 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Contas a Receber
              {contasAReceber.length > 0 && (
                <span className="px-1.5 py-0.5 bg-yellow-500 text-background font-black text-[9px] rounded-full">
                  {contasAReceber.length}
                </span>
              )}
            </button>
          </div>

          {subTab === 'geral' && (
            <div className="flex items-center gap-2 bg-background border border-foreground/5 px-3 py-1.5 rounded-xl text-muted text-xs font-bold w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value as any)}
                className="bg-transparent text-white outline-none cursor-pointer p-0 font-bold"
              >
                <option value="hoje">Hoje</option>
                <option value="7dias">Últimos 7 dias</option>
                <option value="mes">Este mês</option>
                <option value="todos">Todo o histórico</option>
              </select>
            </div>
          )}
        </div>

        {/* List render container */}
        <div className="p-6">
          {subTab === 'geral' && (
            <div className="space-y-4">
              {fluxoTransacoes.length === 0 ? (
                <div className="py-16 text-center text-muted">
                  <AlertCircle className="w-10 h-10 text-muted/40 mx-auto mb-3" />
                  <p className="text-sm">Nenhum lançamento no período filtrado.</p>
                  <p className="text-xs mt-1">Lançamentos feitos no PDV ou no botão acima aparecerão aqui.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-foreground/5 text-[10px] text-muted font-bold uppercase tracking-wider">
                        <th className="py-3 px-2">Data</th>
                        <th className="py-3 px-2">Descrição</th>
                        <th className="py-3 px-2">Categoria</th>
                        <th className="py-3 px-2">Meio</th>
                        <th className="py-3 px-2 text-right">Valor</th>
                        <th className="py-3 px-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/5 text-sm font-medium">
                      {fluxoTransacoes.map(t => (
                        <tr key={t.id} className="hover:bg-foreground/5 transition-colors group">
                          <td className="py-3.5 px-2 text-muted font-mono">{formatDateBrief(t.data)}</td>
                          <td className="py-3.5 px-2 font-bold text-white max-w-xs truncate">{t.descricao}</td>
                          <td className="py-3.5 px-2">
                            <span className="text-xs bg-background/50 border border-foreground/5 px-2.5 py-1 rounded-lg">
                              {t.categoria}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-xs text-muted">{t.meio_pagamento || '-'}</td>
                          <td className={`py-3.5 px-2 text-right font-bold ${t.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.tipo === 'entrada' ? '+' : '-'} R$ {isPrivateMode ? '•••' : t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleStartEdit(t)}
                                className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-foreground/5 transition-all"
                                title="Editar Lançamento"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDeleteTransacao(t.id)}
                                className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all"
                                title="Excluir Lançamento"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {subTab === 'pagar' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 flex justify-between items-center text-sm">
                <span className="text-xs text-muted font-bold uppercase">Pendência Total a Pagar</span>
                <span className="font-extrabold text-red-400 text-base">
                  R$ {pendingPayablesVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {contasAPagar.length === 0 ? (
                <div className="py-16 text-center text-muted">
                  <CheckCircle className="w-10 h-10 text-primary/40 mx-auto mb-3" />
                  <p className="text-sm">Parabéns! Nenhuma conta pendente a pagar.</p>
                  <p className="text-xs mt-1">Crie despesas agendadas no botão "Lançar Transação".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contasAPagar.map(t => (
                    <div key={t.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 bg-background/50 border border-foreground/5 rounded-2xl hover:border-red-500/20 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{t.descricao}</h4>
                          <span className="text-[10px] text-muted bg-background border border-foreground/5 px-2 py-0.5 rounded-lg">{t.categoria}</span>
                        </div>
                        <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-red-500" />
                          Vencedor em: <span className="text-red-400 font-bold">{formatDateBrief(t.data_vencimento || t.data)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-start">
                        <span className="font-extrabold text-red-500 text-base">
                          R$ {isPrivateMode ? '•••' : t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onUpdateTransacaoStatus(t.id, 'pago')}
                            className="px-3.5 py-2 bg-emerald-500 text-background rounded-xl font-bold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                          >
                            Quitar Pago
                          </button>
                          <button
                            onClick={() => handleStartEdit(t)}
                            className="p-2 bg-foreground/5 hover:bg-primary/10 text-muted hover:text-primary rounded-xl transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteTransacao(t.id)}
                            className="p-2 bg-foreground/5 hover:bg-red-500/10 text-muted hover:text-red-500 rounded-xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === 'receber' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/5 rounded-2xl border border-yellow-500/10 flex justify-between items-center text-sm">
                <span className="text-xs text-muted font-bold uppercase">Previsão a Receber</span>
                <span className="font-extrabold text-yellow-400 text-base">
                  R$ {pendingReceivablesVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {contasAReceber.length === 0 ? (
                <div className="py-16 text-center text-muted">
                  <CheckCircle className="w-10 h-10 text-yellow-500/40 mx-auto mb-3" />
                  <p className="text-sm font-medium">Nenhuma duplicata a receber cadastrada.</p>
                  <p className="text-xs mt-1">Gere duplicatas agendadas usando o lançador acima.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contasAReceber.map(t => (
                    <div key={t.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 bg-background/50 border border-foreground/5 rounded-2xl hover:border-yellow-500/20 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{t.descricao}</h4>
                          <span className="text-[10px] text-muted bg-background border border-foreground/5 px-2 py-0.5 rounded-lg">{t.categoria}</span>
                        </div>
                        <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-yellow-500" />
                          Previsão para: <span className="text-yellow-500 font-bold">{formatDateBrief(t.data_vencimento || t.data)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-start">
                        <span className="font-extrabold text-yellow-500 text-base">
                          R$ {isPrivateMode ? '•••' : t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onUpdateTransacaoStatus(t.id, 'pago')}
                            className="px-3.5 py-2 bg-yellow-500 text-background rounded-xl font-bold text-xs hover:bg-opacity-90 transition-all shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                          >
                            Quitar Recebido
                          </button>
                          <button
                            onClick={() => handleStartEdit(t)}
                            className="p-2 bg-foreground/5 hover:bg-primary/10 text-muted hover:text-primary rounded-xl transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteTransacao(t.id)}
                            className="p-2 bg-foreground/5 hover:bg-red-500/10 text-muted hover:text-red-500 rounded-xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

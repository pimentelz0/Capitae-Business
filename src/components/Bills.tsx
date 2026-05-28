import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  X, 
  DollarSign,
  TrendingDown,
  ChevronRight,
  Pencil,
  Lock
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { formatSafeDate } from '../lib/utils';

function getFormattedDescription(desc: string, isRec: boolean): string {
  const clean = desc.replace(/ \[R\]$/, '');
  return isRec ? `${clean} [R]` : clean;
}

function getCleanDescription(desc: string): string {
  return desc.replace(/ \[R\]$/, '');
}

function checkIsRecurring(desc: string): boolean {
  return desc.endsWith(' [R]');
}

function addOneMonth(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  let newMonth = month + 1;
  let newYear = year;
  if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }
  
  // Safe end-of-month clamp logic
  const daysInNextMonth = new Date(newYear, newMonth, 0).getDate();
  const targetDay = Math.min(day, daysInNextMonth);
  
  const y = newYear;
  const m = String(newMonth).padStart(2, '0');
  const d = String(targetDay).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface Bill {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  categoria: string;
  status: 'pendente' | 'paga';
  tipo: 'pagar' | 'receber';
}

interface BillsProps {
  user: User;
  balance: number;
  onActionComplete: () => void;
  isPro?: boolean;
  onUpgrade?: () => void;
}

export default function Bills({ user, balance, onActionComplete, isPro = false, onUpgrade }: BillsProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pagar' | 'receber'>('pagar');
  const [newBill, setNewBill] = useState({
    descricao: '',
    valor: '',
    data_vencimento: new Date().toLocaleDateString('en-CA'),
    categoria: ''
  });
  const [isRecurring, setIsRecurring] = useState(false);

  // States to replace native blocking alert() and confirm() in sandbox iframe
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    actionType: 'pay' | 'delete';
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [highlightedBillId, setHighlightedBillId] = useState<string | null>(null);

  useEffect(() => {
    fetchBills();
  }, [user.id]);

  // Handle redirect and highlight of specific bill from system notifications
  useEffect(() => {
    if (loading || bills.length === 0) return;

    const targetBillId = sessionStorage.getItem('capitae_selected_bill_id');
    const targetBillType = sessionStorage.getItem('capitae_selected_bill_type') as 'pagar' | 'receber' | null;

    if (targetBillId) {
      if (targetBillType && targetBillType !== activeTab) {
        setActiveTab(targetBillType);
      }
      
      setHighlightedBillId(targetBillId);
      
      // Clear storage
      sessionStorage.removeItem('capitae_selected_bill_id');
      sessionStorage.removeItem('capitae_selected_bill_type');

      // Scroll smoothly in next event loop tick once DOM tab has switched
      setTimeout(() => {
        const el = document.getElementById(`bill-${targetBillId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);

      // Reset highlight after 4 seconds
      const timer = setTimeout(() => {
        setHighlightedBillId(null);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [loading, bills, activeTab]);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      setBills(data || []);
    } catch (err: any) {
      console.error('Error fetching bills:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    if (!isPro && bills.length >= 2) {
      if (onUpgrade) onUpgrade();
      return;
    }
    setEditingBillId(null);
    setNewBill({
      descricao: '',
      valor: '',
      data_vencimento: new Date().toLocaleDateString('en-CA'),
      categoria: ''
    });
    setIsRecurring(false);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (bill: Bill) => {
    setEditingBillId(bill.id);
    const hasR = checkIsRecurring(bill.descricao);
    setNewBill({
      descricao: getCleanDescription(bill.descricao),
      valor: bill.valor.toString(),
      data_vencimento: bill.data_vencimento,
      categoria: bill.categoria
    });
    setIsRecurring(hasR);
    setShowAddModal(true);
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBillId && !isPro && bills.length >= 2) {
      if (onUpgrade) onUpgrade();
      return;
    }
    setActionLoading(true);

    try {
      const finalCategory = newBill.categoria.trim() || 'Outros';
      const finalDescription = getFormattedDescription(newBill.descricao, isRecurring);
      
      const billData = {
        user_id: user.id,
        descricao: finalDescription,
        valor: parseFloat(newBill.valor),
        data_vencimento: newBill.data_vencimento,
        categoria: finalCategory,
        status: 'pendente',
        tipo: activeTab // Use the current tab as the type
      };

      if (editingBillId) {
        const { error } = await supabase
          .from('bills')
          .update(billData)
          .eq('id', editingBillId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bills').insert([billData]);
        if (error) throw error;
      }

      setNewBill({
        descricao: '',
        valor: '',
        data_vencimento: new Date().toLocaleDateString('en-CA'),
        categoria: ''
      });
      setIsRecurring(false);
      setShowAddModal(false);
      setEditingBillId(null);
      await fetchBills();
      onActionComplete(); // Re-fetch dashboard data too since value might change
    } catch (err: any) {
      setErrorNotification('Erro ao salvar conta: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayBill = (bill: Bill) => {
    const isReceivable = bill.tipo === 'receber';
    const isRecItem = checkIsRecurring(bill.descricao);
    const cleanDesc = getCleanDescription(bill.descricao);
    
    const title = isReceivable ? 'Confirmar Recebimento' : 'Confirmar Pagamento';
    const message = isReceivable 
      ? `Deseja realmente confirmar o recebimento de "${cleanDesc}" no valor de R$ ${bill.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?`
      : `Deseja realmente confirmar o pagamento de "${cleanDesc}" no valor de R$ ${bill.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?`;

    setConfirmModal({
      title,
      message,
      actionType: 'pay',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          if (isRecItem) {
            // Recurring bill: update due date to the exact same day of the next month and keep status as 'pendente'
            const nextMonthDate = addOneMonth(bill.data_vencimento);
            const { error: updateError } = await supabase
              .from('bills')
              .update({ data_vencimento: nextMonthDate })
              .eq('id', bill.id);
            if (updateError) throw updateError;
          } else {
            // Normal bill: mark as paid
            const { error: updateError } = await supabase
              .from('bills')
              .update({ status: 'paga' })
              .eq('id', bill.id);
            if (updateError) throw updateError;
          }

          // Add to expenses (gastos) history
          const { error: insertError } = await supabase.from('gastos').insert([{
            user_id: user.id,
            descricao: cleanDesc + (isRecItem ? ' (Mensal Recorrente)' : ''),
            valor: isReceivable ? -Math.abs(bill.valor) : Math.abs(bill.valor),
            categoria: bill.categoria,
            data: new Date().toLocaleDateString('en-CA'),
            metodo_pagamento: 'saldo'
          }]);

          if (insertError) throw insertError;

          await fetchBills();
          onActionComplete();
          setConfirmModal(null);
        } catch (err: any) {
          setErrorNotification('Erro ao processar pagamento: ' + err.message);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleDeleteBill = (id: string) => {
    setConfirmModal({
      title: 'Excluir Conta Prevista',
      message: 'Deseja realmente excluir esta conta prevista do seu planejamento? Esta ação não pode ser desfeita.',
      actionType: 'delete',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const { error } = await supabase.from('bills').delete().eq('id', id);
          if (error) throw error;
          await fetchBills();
          setConfirmModal(null);
        } catch (err: any) {
          setErrorNotification('Erro ao excluir: ' + err.message);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const pendingBills = bills.filter(b => b.status === 'pendente' && (b.tipo === activeTab || (!b.tipo && activeTab === 'pagar')));
  const totalPending = pendingBills.reduce((acc, curr) => acc + curr.valor, 0);
  
  // All pending payables (to calculate real forecast)
  const allPendingPayables = bills.filter(b => b.status === 'pendente' && (b.tipo === 'pagar' || !b.tipo));
  const allPendingReceivables = bills.filter(b => b.status === 'pendente' && b.tipo === 'receber');
  
  const totalPayablesValue = allPendingPayables.reduce((acc, curr) => acc + curr.valor, 0);
  const totalReceivablesValue = allPendingReceivables.reduce((acc, curr) => acc + curr.valor, 0);
  
  const balanceAfterAll = balance - totalPayablesValue + totalReceivablesValue;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted font-bold text-sm uppercase tracking-widest">Carregando Contas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Free Plan Limits Info Banner */}
      {!isPro && (
        <div className="bg-primary/5 border border-primary/20 p-5 rounded-[28px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
              <span className={`w-2.5 h-2.5 bg-primary rounded-full ${bills.length >= 2 ? '' : 'animate-ping'}`} />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Plano Gratuito - Limite de Contas</p>
              <p className="text-[10px] text-muted">Você pode cadastrar no máximo 2 contas e recebíveis no total. ({bills.length}/2 usadas)</p>
            </div>
          </div>
          <button
            onClick={() => onUpgrade && onUpgrade()}
            className="px-3.5 py-1.5 bg-primary text-background text-[10px] font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-primary/20 shrink-0"
          >
            {bills.length >= 2 ? 'Desbloquear Contas' : 'Seja Pro'}
          </button>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex p-1 bg-secondary rounded-2xl border border-foreground/5 max-w-sm mx-auto">
        <button 
          onClick={() => setActiveTab('pagar')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'pagar' ? 'bg-primary text-background shadow-lg' : 'text-muted hover:text-foreground'}`}
        >
          <TrendingDown className="w-4 h-4" />
          Contas a Pagar
        </button>
        <button 
          onClick={() => setActiveTab('receber')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'receber' ? 'bg-primary text-background shadow-lg' : 'text-muted hover:text-foreground'}`}
        >
          <DollarSign className="w-4 h-4" />
          Contas a Receber
        </button>
      </div>

      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div 
          key={`summary-${activeTab}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-8 rounded-[40px] border border-foreground/5 relative overflow-hidden group shadow-xl"
        >
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em]">
                {activeTab === 'pagar' ? 'Total a Pagar' : 'Total a Receber'}
              </p>
              <h3 className={`text-4xl font-bold tracking-tighter ${activeTab === 'pagar' ? 'text-foreground' : 'text-primary'}`}>
                R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-2 pt-2">
                <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  {pendingBills.length} {activeTab === 'pagar' ? 'Contas' : 'Recebíveis'}
                </span>
              </div>
            </div>
            <div className="w-14 h-14 bg-primary/20 rounded-3xl flex items-center justify-center">
              {activeTab === 'pagar' ? <Clock className="w-8 h-8 text-primary" /> : <DollarSign className="w-8 h-8 text-primary" />}
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-primary p-8 rounded-[40px] relative overflow-hidden group shadow-xl shadow-primary/20"
        >
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-[10px] text-background/60 font-black uppercase tracking-[0.2em]">Previsão Geral Pós-Ciclo</p>
              <h3 className="text-4xl font-bold tracking-tighter text-background">
                R$ {balanceAfterAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-background/80 font-bold">Saldo final após pagar tudo e receber tudo</p>
            </div>
            <div className="w-14 h-14 bg-background/20 rounded-3xl flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-background" />
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-background/10 rounded-full blur-3xl" />
        </motion.div>
      </div>

      {/* Bills List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xl font-bold tracking-tighter">
            {activeTab === 'pagar' ? 'Suas Contas a Pagar' : 'Seus Recebimentos Pendentes'}
          </h3>
          <button 
            onClick={handleOpenAddModal}
            className="w-10 h-10 bg-primary text-background rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 active:scale-90 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {pendingBills.length === 0 ? (
          <div className="bg-secondary/50 border border-dashed border-foreground/10 rounded-[32px] p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-foreground/5 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-muted/30" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold">Nenhuma conta pendente</h4>
              <p className="text-xs text-muted">Tudo em dia! Adicione uma nova conta para planejar seu futuro.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {pendingBills.map((bill) => (
              <motion.div 
                layout
                key={bill.id}
                id={`bill-${bill.id}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-secondary p-4 sm:p-5 rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between group hover:border-primary/20 transition-all shadow-sm gap-4 ${
                  highlightedBillId === bill.id 
                    ? 'border-2 border-primary ring-4 ring-primary/20 animate-pulse' 
                    : 'border border-foreground/5'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-background rounded-2xl flex items-center justify-center text-primary shadow-inner shrink-0">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm leading-tight truncate">{getCleanDescription(bill.descricao)}</h4>
                      {checkIsRecurring(bill.descricao) && (
                        <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[8px] font-black rounded uppercase tracking-wider whitespace-nowrap">
                          🔁 Recorrente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                      <span className="text-[9px] text-muted font-bold uppercase truncate whitespace-nowrap">{bill.categoria}</span>
                      <span className="w-0.5 h-0.5 bg-foreground/20 rounded-full shrink-0" />
                      <span className="text-[9px] text-primary font-bold whitespace-nowrap">
                        {activeTab === 'pagar' ? 'Venc' : 'Previsão'}: {formatSafeDate(bill.data_vencimento).split('/').slice(0, 2).join('/')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 border-t sm:border-t-0 border-foreground/5 pt-3 sm:pt-0">
                  <div className="text-left sm:text-right shrink-0">
                    <p className={`font-bold text-sm sm:text-base whitespace-nowrap ${activeTab === 'pagar' ? 'text-red-500' : 'text-primary'}`}>
                      R$ {bill.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[8px] text-muted font-black uppercase tracking-widest leading-none mt-0.5">
                      {activeTab === 'pagar' ? 'Pendente' : 'A Receber'}
                    </p>
                  </div>
                  <div className="flex gap-1.5 sm:gap-2 shrink-0">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handlePayBill(bill);
                      }}
                      title={activeTab === 'pagar' ? "Marcar como Pago" : "Confirmar Recebimento"}
                      className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-background transition-all active:scale-95 shrink-0"
                    >
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleOpenEditModal(bill);
                      }}
                      title="Editar"
                      className="w-9 h-9 sm:w-10 sm:h-10 bg-foreground/5 text-muted rounded-xl flex items-center justify-center hover:bg-foreground/10 transition-all active:scale-95 shrink-0"
                    >
                      <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeleteBill(bill.id);
                      }}
                      title="Excluir"
                      className="w-9 h-9 sm:w-10 sm:h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 shrink-0"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Paid History (Optional subset) */}
      {bills.some(b => b.status === 'paga') && (
        <div className="space-y-4 pt-4">
          <h3 className="text-lg font-bold tracking-tighter px-2 opacity-50">Contas Pagas Recentemente</h3>
          <div className="grid grid-cols-1 gap-3 opacity-60">
            {bills.filter(b => b.status === 'paga').slice(0, 3).map((bill) => (
              <div key={bill.id} className="bg-secondary/50 border border-foreground/5 p-4 rounded-[20px] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-background/50 rounded-xl flex items-center justify-center text-muted">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">{getCleanDescription(bill.descricao)}</h4>
                    <p className="text-[9px] text-muted">Pago em {formatSafeDate(bill.data_vencimento)}</p>
                  </div>
                </div>
                <p className="font-bold text-xs text-muted line-through">R$ {bill.valor.toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Bill Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-secondary border border-foreground/10 rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                    {editingBillId ? <Pencil className="w-6 h-6 text-primary" /> : <Plus className="w-6 h-6 text-primary" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {editingBillId 
                        ? (activeTab === 'pagar' ? 'Editar Conta a Pagar' : 'Editar Recebível') 
                        : (activeTab === 'pagar' ? 'Nova Conta a Pagar' : 'Novo Recebível')
                      }
                    </h3>
                    <p className="text-xs text-muted">
                      {editingBillId 
                        ? 'Atualize os dados do compromisso' 
                        : (activeTab === 'pagar' ? 'Planeje um gasto futuro' : 'Registre o que você vai receber')
                      }
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-foreground/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveBill} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase tracking-widest pl-2">Descrição</label>
                  <input 
                    type="text"
                    required
                    value={newBill.descricao}
                    onChange={(e) => setNewBill({...newBill, descricao: e.target.value})}
                    className="w-full bg-background border border-foreground/5 p-4 rounded-2xl focus:border-primary outline-none transition-all text-sm"
                    placeholder="Ex: Aluguel, Internet, Cartão..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-widest pl-2">Valor (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={newBill.valor}
                      onChange={(e) => setNewBill({...newBill, valor: e.target.value})}
                      className={`w-full bg-background border border-foreground/5 p-4 rounded-2xl focus:border-primary outline-none transition-all text-sm font-bold ${activeTab === 'pagar' ? 'text-red-500' : 'text-primary'}`}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-widest pl-2">
                      {activeTab === 'pagar' ? 'Vencimento' : 'Data Prevista'}
                    </label>
                    <input 
                      type="date"
                      required
                      value={newBill.data_vencimento}
                      onChange={(e) => setNewBill({...newBill, data_vencimento: e.target.value})}
                      className="w-full bg-background border border-foreground/5 p-4 rounded-2xl focus:border-primary outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase tracking-widest pl-2">Categoria</label>
                  <input 
                    type="text"
                    required
                    value={newBill.categoria}
                    onChange={(e) => setNewBill({...newBill, categoria: e.target.value})}
                    className="w-full bg-background border border-foreground/5 p-4 rounded-2xl focus:border-primary outline-none transition-all text-sm"
                    placeholder="Ex: Aluguel, Mercado, Luz, etc."
                  />
                </div>

                {activeTab === 'pagar' && (
                  <div 
                    className="flex items-center gap-3 p-4 bg-background/50 rounded-2xl border border-foreground/5 cursor-pointer select-none hover:border-primary/20 transition-all" 
                    onClick={() => setIsRecurring(!isRecurring)}
                  >
                    <input 
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded text-primary border-foreground/10 focus:ring-primary accent-primary cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">Definir como Conta Recorrente</p>
                      <p className="text-[10px] text-muted">Contas fixas mensais de mesmo valor continuarão programadas após pagas, pulando automaticamente para o mês seguinte.</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 rounded-2xl font-bold border border-foreground/10 hover:bg-foreground/5 transition-all text-xs uppercase tracking-[0.2em]"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading}
                    className="flex-[2] py-4 bg-primary text-background rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20"
                  >
                    {actionLoading ? <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" /> : (editingBillId ? 'Atualizar Registro' : (activeTab === 'pagar' ? 'Salvar Conta' : 'Salvar Recebível'))}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-secondary border border-foreground/10 rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-4">
                <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${confirmModal.actionType === 'delete' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                  {confirmModal.actionType === 'delete' ? <Trash2 className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold tracking-tight text-foreground">{confirmModal.title}</h3>
                  <p className="text-xs text-muted leading-relaxed">{confirmModal.message}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-bold rounded-xl transition-all uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    confirmModal.onConfirm();
                  }}
                  disabled={actionLoading}
                  className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all uppercase tracking-wider text-background flex items-center justify-center gap-2 ${confirmModal.actionType === 'delete' ? 'bg-red-500 hover:opacity-90 shadow-lg shadow-red-500/10' : 'bg-primary hover:opacity-90 shadow-lg shadow-primary/10'}`}
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  ) : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Error Toast */}
      <AnimatePresence>
        {errorNotification && (
          <div className="fixed bottom-6 right-6 z-[120]">
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-red-500/10 border border-red-500/20 backdrop-blur-md p-4 rounded-2xl max-w-sm shadow-xl flex items-start gap-3"
            >
              <div className="p-1 bg-red-500/20 text-red-500 rounded-lg shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">Aviso</p>
                <p className="text-[10px] text-muted leading-normal">{errorNotification}</p>
              </div>
              <button 
                onClick={() => setErrorNotification(null)}
                className="text-muted hover:text-foreground p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

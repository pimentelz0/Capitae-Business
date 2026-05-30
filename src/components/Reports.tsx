import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Calendar as CalendarIcon, 
  Filter,
  TrendingDown, 
  TrendingUp, 
  ArrowRight, 
  PieChart as PieIcon,
  BarChart3,
  ChevronRight,
  Wallet,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap,
  Clock,
  Tag,
  Search,
  CreditCard,
  FileDown,
  FileText,
  RefreshCw
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

import { User as SupabaseUser } from '@supabase/supabase-js';
import { formatSafeDate } from '../lib/utils';

interface Expense {
  id: string;
  valor: number;
  categoria: string;
  data: string;
  descricao?: string;
}

interface ReportsProps {
  user: SupabaseUser;
  expenses: Expense[];
  isPro?: boolean;
  onUpgrade?: () => void;
}

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

export default function Reports({ user, expenses, isPro: isProProp = false, onUpgrade }: ReportsProps) {
  const isPro = true; // Always true to unlock all beautiful business charts and export modules
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categorySort, setCategorySort] = useState<'value-desc' | 'value-asc' | 'name-asc' | 'name-desc'>('value-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'transactions'>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      setIsStandalone(!!isStandaloneMode);
    };
    checkStandalone();
  }, []);

  const handleCopyAppLink = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopyLinkSuccess(true);
        setTimeout(() => setCopyLinkSuccess(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
        // Fallback or just ignore if it's a permission issue in a restricted environment
      });
  };

  const filterExpenses = (data: Expense[], p: Period, start?: string, end?: string) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let filtered = data.filter(e => {
      const expenseDate = new Date(e.data);
      
      if (p === 'day') {
        return expenseDate >= startOfToday;
      }
      
      if (p === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return expenseDate >= weekAgo;
      }
      
      if (p === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return expenseDate >= startOfMonth;
      }
      
      if (p === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return expenseDate >= startOfYear;
      }
      
      if (p === 'custom' && start && end) {
        const s = new Date(start);
        const eDate = new Date(end);
        eDate.setHours(23, 59, 59, 999);
        return expenseDate >= s && expenseDate <= eDate;
      }
      
      return true;
    });

    if (searchTerm) {
      filtered = filtered.filter(e => 
        e.categoria.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter === 'expense') {
      filtered = filtered.filter(e => e.valor > 0);
    } else if (typeFilter === 'income') {
      filtered = filtered.filter(e => e.valor < 0);
    }

    return filtered;
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const dataToExport = filterExpenses(expenses, period, startDate, endDate);
      const headers = ['Data', 'Categoria', 'Valor', 'Descrição'];
      const rows = dataToExport.map(e => [
        formatSafeDate(e.data),
        e.categoria,
        e.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        e.descricao || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const fileName = `relatorio-capitae-${new Date().toISOString().split('T')[0]}.csv`;

      // 1. Técnica para PWA (Compartilhamento Nativo)
      if (navigator.share) {
        try {
          const file = new File([csvContent], fileName, { type: 'text/csv' });
          
          // No PWA, se canShare falhar, tentamos o share direto com texto
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Relatório Capitae',
              text: 'Segue meu relatório financeiro.'
            });
            return;
          }
        } catch (shareErr) {
          console.log('PWA Share CSV falhou:', shareErr);
        }
      }

      // 2. Download via Blob (Fallback robusto para Navegador)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Export failed:', err);
      alert('Erro ao exportar. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    setIsExportingPDF(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const dateStr = new Date().toLocaleDateString('pt-BR');

      // Cabeçalho Premium
      doc.setFillColor(0, 200, 83);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('CAPITAE FINANCE', 15, 25);
      doc.setFontSize(10);
      doc.text('RELATÓRIO DETALHADO', 15, 33);
      doc.text(`${dateStr}`, pageWidth - 15, 25, { align: 'right' });

      // Resumo
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(14);
      doc.text('Resumo do Período', 15, 55);
      const summaryData = [
        ['Total Gasto', `R$ ${totalSpent.toLocaleString('pt-BR')}`],
        ['Média Diária', `R$ ${dailyAverage.toLocaleString('pt-BR')}`],
        ['Transações', filteredExpenses.length.toString()]
      ];

      autoTable(doc, {
        startY: 60,
        head: [['Métrica', 'Valor']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [0, 200, 83] }
      });

      // Histórico
      doc.addPage();
      doc.text('Histórico de Transações', 15, 20);
      const transactionData = filteredExpenses
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        .map(e => [
          formatSafeDate(e.data),
          e.categoria,
          e.valor > 0 ? `R$ ${e.valor.toLocaleString('pt-BR')}` : `+ R$ ${Math.abs(e.valor).toLocaleString('pt-BR')}`
        ]);

      autoTable(doc, {
        startY: 25,
        head: [['Data', 'Categoria', 'Valor']],
        body: transactionData,
        theme: 'striped',
        headStyles: { fillColor: [0, 200, 83] }
      });

      const fileName = `relatorio-${new Date().getTime()}.pdf`;
      const pdfBlob = doc.output('blob');

      // 1. Técnica para PWA (Compartilhamento Nativo)
      if (navigator.share) {
        try {
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Relatório Capitae',
              text: 'Relatório PDF gerado pelo app.'
            });
            setIsExportingPDF(false);
            return;
          }
        } catch (shareErr) {
          console.log('PWA Share PDF falhou:', shareErr);
        }
      }

      // 2. Download via Blob (Fallback)
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);

    } catch (err: any) {
      console.error('PDF Erro:', err);
      alert('Erro ao gerar o documento.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const filteredExpenses = filterExpenses(expenses, period, startDate, endDate);
  
  // Previous period for comparison
  const getPreviousPeriodExpenses = () => {
    const now = new Date();
    let prevStart: Date;
    let prevEnd: Date;

    if (period === 'month') {
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === 'week') {
      prevStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      prevEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'year') {
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31);
    } else {
      return [];
    }

    return expenses.filter(e => {
      const d = new Date(e.data);
      return d >= prevStart && d <= prevEnd;
    });
  };

  const prevExpenses = getPreviousPeriodExpenses();
  
  const totalIncome = filteredExpenses.filter(e => e.valor < 0).reduce((acc, curr) => acc + Math.abs(curr.valor), 0);
  const totalSpent = filteredExpenses.filter(e => e.valor > 0).reduce((acc, curr) => acc + curr.valor, 0);
  const prevSpent = prevExpenses.filter(e => e.valor > 0).reduce((acc, curr) => acc + curr.valor, 0);
  
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;
  const spendingDiff = prevSpent > 0 ? ((totalSpent - prevSpent) / prevSpent) * 100 : 0;

  const gastosOnly = filteredExpenses.filter(e => e.valor > 0);
  const categoryData = Object.entries(
    gastosOnly.reduce((acc: any, curr) => {
      acc[curr.categoria] = (acc[curr.categoria] || 0) + curr.valor;
      return acc;
    }, {})
  ).map(([name, value]) => ({ 
    name, 
    value: value as number,
    perc: totalSpent > 0 ? ((value as number) / totalSpent) * 100 : 0
  })).sort((a, b) => {
    if (categorySort === 'value-desc') return b.value - a.value;
    if (categorySort === 'value-asc') return a.value - b.value;
    if (categorySort === 'name-asc') return a.name.localeCompare(b.name);
    if (categorySort === 'name-desc') return b.name.localeCompare(a.name);
    return 0;
  });

  const COLORS = ['#00C853', '#FF5252', '#FFD740', '#40C4FF', '#E040FB', '#FF6E40', '#B2FF59'];

  // Daily spending data for chart
  const dailyData = Object.entries(
    gastosOnly.reduce((acc: any, curr) => {
      const day = formatSafeDate(curr.data).split('/').slice(0, 2).join('/');
      acc[day] = (acc[day] || 0) + curr.valor;
      return acc;
    }, {})
  ).map(([day, value]) => ({ day, value: value as number }))
   .sort((a, b) => {
     const [da, ma] = a.day.split('/').map(Number);
     const [db, mb] = b.day.split('/').map(Number);
     return ma !== mb ? ma - mb : da - db;
   });

  const dailyAverage = gastosOnly.length > 0 ? totalSpent / (new Set(gastosOnly.map(e => e.data.split('T')[0])).size || 1) : 0;

  if (!isPro) {
    return (
      <div className="space-y-8 pb-24 text-center flex flex-col items-center justify-center py-12">
        <div className="max-w-md w-full bg-secondary p-8 sm:p-10 rounded-[40px] border border-foreground/5 space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <BarChart3 className="w-40 h-40 text-primary" />
          </div>
          
          <div className="w-20 h-20 bg-primary/10 rounded-[28px] flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-10 h-10 text-primary animate-pulse" />
          </div>

          <div className="space-y-3">
            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider rounded-full">
              Recurso Exclusivo Pro
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Gráficos de Gastos e Relatórios</h2>
            <p className="text-sm text-muted leading-relaxed">
              Analise detalhadamente cada centavo com gráficos de categorias, históricos interativos, e exportação ilimitada de relatórios em PDF profissional e planilhas Excel (CSV).
            </p>
          </div>

          <div className="p-4 bg-background/50 rounded-2xl border border-foreground/5 space-y-2 text-left">
            <div className="flex items-center gap-3 text-xs font-bold text-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" style={{ animationDuration: '3s' }} />
              Gráficos interativos por Categoria e Data
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-foreground">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Relatórios de PDF de Alta Fidelidade para Impressão
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-foreground">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Exportação limpa em formato de Planilha (CSV/Excel)
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                if (onUpgrade) onUpgrade();
              }}
              className="w-full py-4 bg-primary text-background rounded-2xl font-bold text-base shadow-[0_0_20px_rgba(0,200,83,0.3)] hover:scale-[1.01] active:scale-95 transition-all"
            >
              Assinar Capitae Pro - R$ 14,90/mês
            </button>
            <p className="text-[10px] text-muted text-center uppercase font-bold tracking-widest">
              Garantia de 7 dias • Cancele quando quiser
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24" ref={reportRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter">Relatório Detalhado</h2>
          <p className="text-muted text-sm">Análise profunda da sua saúde financeira</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="bg-secondary p-1 rounded-2xl border border-foreground/5 flex gap-1 w-full md:w-auto">
            {(['week', 'month', 'year', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                }}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === p ? 'bg-primary text-background' : 'text-muted hover:bg-foreground/5'
                }`}
              >
                {p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : p === 'year' ? 'Ano' : 'Personalizado'}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-secondary p-2 rounded-2xl border border-foreground/5"
            >
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-bold text-muted uppercase ml-2">Início</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background border border-foreground/5 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-bold text-muted uppercase ml-2">Fim</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background border border-foreground/5 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-secondary rounded-2xl border border-foreground/5 mb-8">
        <button 
          onClick={() => setActiveSubTab('overview')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'overview' ? 'bg-primary text-background' : 'text-muted hover:bg-foreground/5'}`}
        >
          Visão Geral
        </button>
        <button 
          onClick={() => setActiveSubTab('transactions')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'transactions' ? 'bg-primary text-background' : 'text-muted hover:bg-foreground/5'}`}
        >
          Transações
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Export Buttons */}
            <div className="flex flex-col gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/5 hover:bg-primary/10 border border-primary/20 p-6 rounded-[32px] flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left w-full shadow-lg shadow-primary/5 transition-colors"
              >
                <div className="w-12 h-12 bg-primary/20 rounded-[20px] flex items-center justify-center shrink-0 shadow-inner">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Dica Pro</p>
                    <h4 className="text-sm font-bold text-foreground">Os botões CSV e PDF abaixo funcionam apenas no navegador.</h4>
                    <p className="text-xs text-muted leading-relaxed mt-1">
                      Se você estiver usando o app instalado ou adicionado à tela inicial, copie o link e abra no navegador, ou use o botão para ser redirecionado automaticamente.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                    <a 
                      href="https://capitae.vercel.app/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-primary text-background rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
                    >
                      Abrir no Navegador <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                    <button 
                      onClick={handleCopyAppLink}
                      className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2 hover:bg-white/10 active:scale-95 transition-all"
                    >
                      {copyLinkSuccess ? '✓ Link Copiado' : 'Copiar Link'}
                    </button>
                  </div>
                </div>
              </motion.div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={handleExportCSV}
                  disabled={isExporting || isExportingPDF}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-secondary border border-foreground/10 rounded-2xl hover:bg-foreground/5 transition-all text-xs font-bold disabled:opacity-50"
                >
                  <FileDown className={`w-4 h-4 text-primary ${isExporting ? 'animate-pulse' : ''}`} />
                  {isExporting ? 'CSV...' : 'CSV'}
                </button>
                <button 
                  onClick={handleExportPDF}
                  disabled={isExporting || isExportingPDF}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-primary text-background rounded-2xl hover:opacity-90 transition-all text-xs font-bold disabled:opacity-50 shadow-xl shadow-primary/20"
                >
                  <FileText className={`w-4 h-4 ${isExportingPDF ? 'animate-pulse' : ''}`} />
                  {isExportingPDF ? 'Gerando...' : 'PDF Detalhado'}
                </button>
              </div>
              <AnimatePresence>
                {copySuccess && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-primary font-bold uppercase tracking-widest text-center"
                  >
                    Arquivo pronto para compartilhar!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-secondary p-6 rounded-[32px] border border-foreground/5 space-y-2">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            {spendingDiff !== 0 && (
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${spendingDiff > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                {spendingDiff > 0 ? '+' : ''}{spendingDiff.toFixed(1)}% vs anterior
              </span>
            )}
          </div>
          <p className="text-xs text-muted font-bold uppercase tracking-widest">Total Gasto</p>
          <h3 className="text-2xl font-bold">R$ {totalSpent.toLocaleString('pt-BR')}</h3>
        </div>

        <div className="bg-secondary p-6 rounded-[32px] border border-foreground/5 space-y-2">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-xs text-muted font-bold uppercase tracking-widest">Média Diária</p>
          <h3 className="text-2xl font-bold">R$ {dailyAverage.toLocaleString('pt-BR')}</h3>
        </div>

        <div className="bg-secondary p-6 rounded-[32px] border border-foreground/5 space-y-2">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-purple-500/10 rounded-2xl flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-500" />
            </div>
          </div>
          <p className="text-xs text-muted font-bold uppercase tracking-widest">Taxa de Poupança</p>
          <h3 className="text-2xl font-bold">{savingsRate.toFixed(1)}%</h3>
        </div>

        <div className="bg-secondary p-6 rounded-[32px] border border-foreground/5 space-y-2">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
          </div>
          <p className="text-xs text-muted font-bold uppercase tracking-widest">Transações</p>
          <h3 className="text-2xl font-bold">{filteredExpenses.length}</h3>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending Trend */}
        <div className="lg:col-span-2 bg-secondary p-8 rounded-[40px] border border-foreground/5 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight">Fluxo de Gastos</h3>
            <BarChart3 className="w-5 h-5 text-muted" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C853" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00C853" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#666', fontSize: 10 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#666', fontSize: 10 }}
                  tickFormatter={(val) => `R$ ${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '16px', fontSize: '12px' }}
                  itemStyle={{ color: '#00C853' }}
                />
                <Area type="monotone" dataKey="value" stroke="#00C853" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-secondary p-8 rounded-[40px] border border-foreground/5 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold tracking-tight">Categorias</h3>
            <PieIcon className="w-5 h-5 text-muted" />
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '16px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs font-bold text-muted uppercase tracking-wider truncate max-w-[150px]">{item.name}</span>
                </div>
                <span className="text-xs font-bold">{item.perc.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Table */}
      <div className="bg-secondary rounded-[40px] border border-foreground/5 overflow-hidden">
        <div className="p-8 border-b border-foreground/5 flex items-center justify-between relative">
          <h3 className="text-xl font-bold tracking-tight">Detalhamento por Categoria</h3>
          <div className="relative">
            <button 
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showSortMenu ? 'bg-primary text-background' : 'bg-foreground/5 text-muted hover:text-primary'}`}
            >
              <Filter className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-secondary border border-foreground/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted px-3 py-2">Ordenar por</p>
                    {[
                      { id: 'value-desc', label: 'Maior Valor', icon: TrendingDown },
                      { id: 'value-asc', label: 'Menor Valor', icon: TrendingUp },
                      { id: 'name-asc', label: 'Nome (A-Z)', icon: Tag },
                      { id: 'name-desc', label: 'Nome (Z-A)', icon: Tag },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setCategorySort(opt.id as any);
                          setShowSortMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          categorySort === opt.id ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-foreground/5'
                        }`}
                      >
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-muted border-b border-foreground/5">
                <th className="px-8 py-4">Categoria</th>
                <th className="px-8 py-4">Total</th>
                <th className="px-8 py-4">Peso</th>
                <th className="px-8 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {categoryData.map((cat, i) => (
                <tr key={cat.name} className="group hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS[i % COLORS.length]}20` }}>
                        <Tag className="w-4 h-4" style={{ color: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="font-bold">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-bold text-sm">R$ {cat.value.toLocaleString('pt-BR')}</td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden max-w-[100px]">
                        <div className="h-full bg-primary" style={{ width: `${cat.perc}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-muted">{cat.perc.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${cat.perc > 30 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {cat.perc > 30 ? 'Crítico' : 'Saudável'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-2xl font-bold tracking-tighter">Histórico de Transações</h3>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input 
                type="text"
                placeholder="Buscar transação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-secondary border border-foreground/5 pl-10 pr-4 py-2 rounded-xl text-sm outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Type Filter */}
            <div className="flex bg-secondary p-1 rounded-xl border border-foreground/5">
              {(['all', 'expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    typeFilter === t ? 'bg-primary text-background' : 'text-muted hover:bg-foreground/5'
                  }`}
                >
                  {t === 'all' ? 'Tudo' : t === 'expense' ? 'Gastos' : 'Ganhos'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExpenses
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
            .map(expense => (
              <div key={expense.id} className="p-6 bg-secondary rounded-3xl border border-foreground/5 flex justify-between items-center group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-foreground/5 relative ${expense.valor > 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                    {expense.valor > 0 ? (
                      <TrendingDown className="w-6 h-6 text-red-500" />
                    ) : (
                      <TrendingUp className="w-6 h-6 text-primary" />
                    )}
                    {(expense as any).metodo_pagamento === 'credito' && (
                      <div className="absolute -top-1 -right-1 bg-purple-500 rounded-full p-1 border border-background shadow-lg">
                        <CreditCard className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-tight">{expense.categoria}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted uppercase font-bold tracking-widest">{formatSafeDate(expense.data)}</span>
                      {expense.descricao && (
                        <>
                          <span className="w-1 h-1 bg-muted rounded-full" />
                          <span className="text-[10px] text-muted font-medium truncate max-w-[100px]">{expense.descricao}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black tracking-tight ${expense.valor > 0 ? 'text-red-500' : 'text-primary'}`}>
                    {expense.valor > 0 ? '-' : '+'} R$ {Math.abs(expense.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ))}
        </div>
        </div>
      </motion.div>
    )}

    {activeSubTab === 'transactions' && (
          <motion.div 
            key="transactions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 bg-secondary p-4 rounded-2xl border border-foreground/5">
              <Search className="w-5 h-5 text-muted" />
              <input 
                type="text" 
                placeholder="Buscar transação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full"
              />
            </div>
            
            <div className="space-y-3">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-12 text-muted italic">Nenhuma transação encontrada.</div>
              ) : (
                filteredExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl border border-foreground/5">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${e.valor > 0 ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                        {e.valor > 0 ? <TrendingDown className="w-5 h-5 text-red-500" /> : <TrendingUp className="w-5 h-5 text-primary" />}
                      </div>
                      <div>
                        <p className="font-bold">{e.categoria}</p>
                        <p className="text-xs text-muted">{formatSafeDate(e.data)}</p>
                      </div>
                    </div>
                    <p className={`font-bold ${e.valor > 0 ? 'text-red-500' : 'text-primary'}`}>
                      {e.valor > 0 ? '-' : '+'} R$ {Math.abs(e.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

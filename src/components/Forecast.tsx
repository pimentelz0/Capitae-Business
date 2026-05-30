import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  Target,
  Info,
  Sparkles,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface ForecastProps {
  user: SupabaseUser;
  expenses: any[];
  goals: any[];
  totalNetWorth: number;
  availableBalance?: number;
  onNavigate: (tab: string) => void;
  onUpgrade?: () => void;
  isPro?: boolean;
}

const playClickSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {
    // Fail silently in sandboxed environments or if gesture is missing
  }
};

export default function Forecast({ user, expenses, goals, totalNetWorth, availableBalance = 0, onNavigate, onUpgrade, isPro: isProProp = false }: ForecastProps) {
  const isPro = true; // Always true to unlock all forecast features and remove upgrade notice gates
  const [profile, setProfile] = useState({
    monthly_income: 0,
    fixed_costs: 0,
  });
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Investment Calculator States
  const [invInitial, setInvInitial] = useState<string>('1000');
  const [invMonthly, setInvMonthly] = useState<string>('200');
  const [invPeriod, setInvPeriod] = useState<string>('12'); // months

  const [visibleMilestones, setVisibleMilestones] = useState<number[]>([1]);

  useEffect(() => {
    setVisibleMilestones([1]);
    
    const t2 = setTimeout(() => {
      setVisibleMilestones(prev => {
        if (!prev.includes(2)) {
          playClickSound();
          return [...prev, 2];
        }
        return prev;
      });
    }, 800);

    const t3 = setTimeout(() => {
      setVisibleMilestones(prev => {
        if (!prev.includes(3)) {
          playClickSound();
          return [...prev, 3];
        }
        return prev;
      });
    }, 1400);

    const t4 = setTimeout(() => {
      setVisibleMilestones(prev => {
        if (!prev.includes(4)) {
          playClickSound();
          return [...prev, 4];
        }
        return prev;
      });
    }, 2000);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, billsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('monthly_income, fixed_costs')
            .eq('id', user.id)
            .single(),
          supabase
            .from('bills')
            .select('*')
            .eq('user_id', user.id)
        ]);

        if (profileRes.data) {
          setProfile({
            monthly_income: profileRes.data.monthly_income || 0,
            fixed_costs: profileRes.data.fixed_costs || 0
          });
        }

        if (billsRes.data) {
          setBills(billsRes.data);
        }
      } catch (err) {
        console.error('Erro ao buscar dados na aba de Score:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user.id]);

  const now = new Date();
  const currentDay = now.getDate();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStr = now.toISOString().split('T')[0];

  // Identificação de pesos por categoria de gastos do usuário
  const getCategoryCategoryWeight = (categoria: string): { weight: number; label: string } => {
    const cat = (categoria || '').trim().toLowerCase();
    
    if (
      cat.includes('aluguel') || 
      cat.includes('agua') || 
      cat.includes('luz') || 
      cat.includes('internet') || 
      cat.includes('energia') || 
      cat.includes('gas') || 
      cat.includes('condominio') || 
      cat.includes('fixo') || 
      cat.includes('mensalidade') || 
      cat.includes('assinatura') || 
      cat.includes('assinaturas')
    ) {
      return { weight: 1.0, label: 'Fixo' };
    }
    if (
      cat.includes('delivery') || 
      cat.includes('ifood') || 
      cat.includes('restaurante') || 
      cat.includes('lanche') || 
      cat.includes('fora') || 
      cat.includes('bar') || 
      cat.includes('jantar') || 
      cat.includes('almoco') || 
      cat.includes('cafe')
    ) {
      return { weight: 0.4, label: 'Alimentação fora' };
    }
    if (
      cat.includes('transporte') || 
      cat.includes('uber') || 
      cat.includes('onibus') || 
      cat.includes('combustivel') || 
      cat.includes('gasolina') || 
      cat.includes('carro') || 
      cat.includes('moto') || 
      cat.includes('metro') || 
      cat.includes('taxi')
    ) {
      return { weight: 0.8, label: 'Transporte' };
    }
    if (
      cat.includes('compras') || 
      cat.includes('shopping') || 
      cat.includes('impulso') || 
      cat.includes('roupa') || 
      cat.includes('eletronico') || 
      cat.includes('presente') || 
      cat.includes('vestuario') || 
      cat.includes('loja') || 
      cat.includes('mimo')
    ) {
      return { weight: 0.2, label: 'Compras' };
    }
    if (
      cat.includes('lazer') || 
      cat.includes('entretenimento') || 
      cat.includes('cinema') || 
      cat.includes('show') || 
      cat.includes('viagem') || 
      cat.includes('festa') || 
      cat.includes('balada') || 
      cat.includes('jogo') || 
      cat.includes('games')
    ) {
      return { weight: 0.2, label: 'Lazer' };
    }

    return { weight: 0.6, label: 'Variável Geral' };
  };

  // Filtrar lançamentos do mês atual
  const monthlyExpenses = expenses.filter(e => {
    const isThisMonth = new Date(e.data) >= startOfMonth;
    return isThisMonth;
  });

  // 1. FATOR: Saldo positivo ou negativo no mês (vale 40 pontos)
  let realInflowsThisMonth = 0;
  let realOutflowsThisMonth = 0;
  let totalVariableThisMonth = 0;
  
  const variableExpensesByCategory: { [key: string]: number } = {};

  monthlyExpenses.forEach(e => {
    const isOutflow = e.valor > 0;
    // Receitas são e.valor < 0
    if (isOutflow) {
      realOutflowsThisMonth += e.valor;
      const { weight, label } = getCategoryCategoryWeight(e.categoria);
      if (weight < 1.0) {
        totalVariableThisMonth += e.valor;
        variableExpensesByCategory[label] = (variableExpensesByCategory[label] || 0) + e.valor;
      }
    } else {
      realInflowsThisMonth += Math.abs(e.valor);
    }
  });

  // Base salarial ou inflow registrado
  const totalInflow = realInflowsThisMonth > 0 ? realInflowsThisMonth : profile.monthly_income;
  const totalOutflow = realOutflowsThisMonth + profile.fixed_costs;
  const currentMonthBalance = totalInflow - totalOutflow;

  let saldoPoints = 0;
  if (currentMonthBalance >= 0) {
    saldoPoints = 40;
  } else {
    // Escala proporcional de prejuízo
    saldoPoints = Math.round(Math.max(0, 40 * (totalInflow / (totalOutflow || 1))));
  }

  // 2. FATOR: Proporção de gastos variáveis vs gastos fixos (vale 25 pontos)
  // Menos variável descontrolado em relação ao fixo = mais pontos
  const fixosTarget = Math.max(200, profile.fixed_costs);
  const variableToFixedRatio = totalVariableThisMonth / fixosTarget;
  
  let varPoints = 25;
  if (totalVariableThisMonth > 0) {
    if (variableToFixedRatio <= 0.4) {
      varPoints = 25;
    } else {
      varPoints = Math.round(25 * (1 - Math.min(1, Math.max(0, variableToFixedRatio - 0.4) / 1.6)));
    }
  }

  // 3. FATOR: Contas pagas em dia vs contas atrasadas (vale 20 pontos)
  const pagarBills = bills.filter(b => b.tipo === 'pagar');
  const lateBills = pagarBills.filter(b => b.status === 'pendente' && b.data_vencimento < todayStr);

  let billsPoints = 20;
  if (pagarBills.length > 0) {
    const activeOnTime = pagarBills.length - lateBills.length;
    billsPoints = Math.round(20 * (activeOnTime / pagarBills.length));
  }

  // 4. FATOR: Consistência de registro (vale 15 pontos)
  // Dias do mês atual com lançamentos
  const daysWithEntries = new Set<string>();
  monthlyExpenses.forEach(e => {
    if (e.data) {
      const dStr = e.data.split('T')[0];
      daysWithEntries.add(dStr);
    }
  });

  const uniqueDaysCount = daysWithEntries.size;
  const targetDaysPercent = Math.min(10, currentDay); // Alvo realista de até 10 dias registrados por mês
  
  let consistencyPoints = 15;
  if (targetDaysPercent > 0) {
    consistencyPoints = Math.round(15 * Math.min(1, uniqueDaysCount / targetDaysPercent));
  }

  // Score Final (0 a 100)
  const finalScore = Math.min(100, Math.max(0, saldoPoints + varPoints + billsPoints + consistencyPoints));

  // --- PREVIOUS MONTH BOUNDS & CALCULATIONS ---
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Filter previous month expenses
  const prevMonthExpenses = expenses.filter(e => {
    const d = new Date(e.data);
    return d >= startOfPrevMonth && d <= endOfPrevMonth;
  });

  const hasPrevMonthData = prevMonthExpenses.length > 0;

  let prevSaldoPoints = 0;
  let prevVarPoints = 0;
  let prevBillsPoints = 0;
  let prevConsistencyPoints = 0;

  if (hasPrevMonthData) {
    let prevInflows = 0;
    let prevOutflows = 0;
    let prevTotalVariable = 0;

    prevMonthExpenses.forEach(e => {
      const isOutflow = e.valor > 0;
      if (isOutflow) {
        prevOutflows += e.valor;
        const { weight } = getCategoryCategoryWeight(e.categoria);
        if (weight < 1.0) {
          prevTotalVariable += e.valor;
        }
      } else {
        prevInflows += Math.abs(e.valor);
      }
    });

    const prevTotalInflow = prevInflows > 0 ? prevInflows : profile.monthly_income;
    const prevTotalOutflow = prevOutflows + profile.fixed_costs;
    const prevBalance = prevTotalInflow - prevTotalOutflow;

    if (prevBalance >= 0) {
      prevSaldoPoints = 40;
    } else {
      prevSaldoPoints = Math.round(Math.max(0, 40 * (prevTotalInflow / (prevTotalOutflow || 1))));
    }

    // 2. Proporção
    const prevFixosTarget = Math.max(200, profile.fixed_costs);
    const prevVarToFixedRatio = prevTotalVariable / prevFixosTarget;
    if (prevTotalVariable > 0) {
      if (prevVarToFixedRatio <= 0.4) {
        prevVarPoints = 25;
      } else {
        prevVarPoints = Math.round(25 * (1 - Math.min(1, Math.max(0, prevVarToFixedRatio - 0.4) / 1.6)));
      }
    } else {
      prevVarPoints = 25;
    }

    // 3. Contas em dia (Se houver contas, assume um valor ligeiramente melhor ou pior)
    if (pagarBills.length > 0) {
      prevBillsPoints = Math.max(14, Math.min(20, billsPoints + (lateBills.length > 0 ? 2 : -2)));
    } else {
      prevBillsPoints = 20;
    }

    // 4. Consistência
    const prevDaysWithEntries = new Set<string>();
    prevMonthExpenses.forEach(e => {
      if (e.data) {
        const dStr = e.data.split('T')[0];
        prevDaysWithEntries.add(dStr);
      }
    });
    const prevUniqueDays = prevDaysWithEntries.size;
    prevConsistencyPoints = Math.round(15 * Math.min(1, prevUniqueDays / 10));
  } else {
    // Gerador determinístico baseado no score atual para manter a harmonia do UI
    // se o usuário não tiver lançamentos cadastrados no passado.
    if (finalScore >= 80) {
      prevSaldoPoints = Math.max(0, saldoPoints - 4);
      prevVarPoints = Math.max(0, varPoints - 2);
      prevBillsPoints = Math.max(0, billsPoints);
      prevConsistencyPoints = Math.max(0, consistencyPoints - 2);
    } else if (finalScore >= 50) {
      prevSaldoPoints = Math.max(0, saldoPoints + 6);
      prevVarPoints = Math.max(0, varPoints - 3);
      prevBillsPoints = Math.max(0, billsPoints + 2);
      prevConsistencyPoints = Math.max(0, consistencyPoints - 1);
    } else {
      prevSaldoPoints = Math.max(0, saldoPoints + 12);
      prevVarPoints = Math.max(0, varPoints + 4);
      prevBillsPoints = Math.max(0, billsPoints + 1);
      prevConsistencyPoints = Math.max(0, consistencyPoints + 2);
    }
  }

  const prevFinalScore = Math.min(100, Math.max(0, prevSaldoPoints + prevVarPoints + prevBillsPoints + prevConsistencyPoints));
  const scoreDelta = finalScore - prevFinalScore;

  // Comparação dos fatores para descobrir qual mais mudou (desvios normalizados das proporções)
  const saldoShift = (saldoPoints / 40) - (prevSaldoPoints / 40);
  const varShift = (varPoints / 25) - (prevVarPoints / 25);
  const billsShift = (billsPoints / 20) - (prevBillsPoints / 20);
  const consistencyShift = (consistencyPoints / 15) - (prevConsistencyPoints / 15);

  const shifts = [
    { factor: 'saldo', val: saldoShift, absVal: Math.abs(saldoShift) },
    { factor: 'var', val: varShift, absVal: Math.abs(varShift) },
    { factor: 'bills', val: billsShift, absVal: Math.abs(billsShift) },
    { factor: 'consistency', val: consistencyShift, absVal: Math.abs(consistencyShift) },
  ];

  // Ordena pelo maior desvio absoluto
  shifts.sort((a, b) => b.absVal - a.absVal);
  const topShift = shifts[0];

  let explanationText = "Seu ritmo financeiro continuou exatamente igual ao do mês passado.";
  
  if (topShift && topShift.absVal > 0.01) {
    if (topShift.factor === 'saldo') {
      if (topShift.val > 0) {
        explanationText = "Seu saldo fechou no positivo ou com menos perdas do que no mês passado. Isso fez seu score subir.";
      } else {
        explanationText = "Seu saldo ficou mais apertado ou negativo comparado ao mês passado.";
      }
    } else if (topShift.factor === 'var') {
      if (topShift.val > 0) {
        explanationText = "Você economizou nos custos do dia a dia e reduziu seus gastos variáveis.";
      } else {
        explanationText = "Seus gastos variáveis aumentaram bastante comparado ao mês passado.";
      }
    } else if (topShift.factor === 'bills') {
      if (topShift.val > 0) {
        explanationText = "Você pagou mais contas em dia do que no mês passado. Isso fez seu score subir.";
      } else {
        explanationText = "A sua pontualidade de pagamento de boletos reduziu comparada ao mês passado.";
      }
    } else if (topShift.factor === 'consistency') {
      if (topShift.val > 0) {
        explanationText = "Você registrou seus gastos com mais frequência. Continue assim.";
      } else {
        explanationText = "Você teve um pouco menos de frequência nos registros comparado ao mês passado.";
      }
    }
  }

  // Encontrar categoria de maior gasto variável
  let highestCategory = '';
  let highestCategoryAmount = 0;
  Object.entries(variableExpensesByCategory).forEach(([category, val]) => {
    if (val > highestCategoryAmount) {
      highestCategoryAmount = val;
      highestCategory = category;
    }
  });

  // Calculadora da Linha do Tempo e Projeções
  const baseBalance = availableBalance !== undefined ? availableBalance : totalNetWorth;
  const savingsRate = currentMonthBalance !== 0 ? currentMonthBalance : (profile.monthly_income - profile.fixed_costs || 300);
  const balance30Days = baseBalance + savingsRate;
  const balance3Months = baseBalance + (savingsRate * 3);
  const balance6Months = baseBalance + (savingsRate * 6);

  // SVG coordinates calculations
  // Center is 40. We shift right (towards 64) for growth, and left (towards 16) for decline.
  const x1 = 40;
  const x2 = balance30Days > baseBalance ? 64 : (balance30Days < baseBalance ? 16 : 40);
  const x3 = balance3Months > balance30Days ? 64 : (balance3Months < balance30Days ? 16 : 40);
  const x4 = balance6Months > balance3Months ? 64 : (balance6Months < balance3Months ? 16 : 40);

  // Bezier curve calculations for vertical SVG path: (0 0 80 360) viewbox
  const pathD = `M 40 30 C 40 80, ${x2} 80, ${x2} 130 C ${x2} 180, ${x3} 180, ${x3} 230 C ${x3} 280, ${x4} 280, ${x4} 330`;

  // Determine line segment color stops
  const getColorForStatus = (val: number) => {
    if (val > 500) return "#10B981"; // Emerald green
    if (val >= 0) return "#F59E0B"; // Amber gold
    return "#EF4444"; // Rose red
  };

  const colorNode1 = getColorForStatus(baseBalance);
  const colorNode2 = getColorForStatus(balance30Days);
  const colorNode3 = getColorForStatus(balance3Months);
  const colorNode4 = getColorForStatus(balance6Months);

  // Overall footer text
  let timelineFooterPhrase = "O futuro pode ser melhor do que parece. Um passo de cada vez.";
  if (balance30Days > baseBalance && balance6Months > baseBalance) {
    timelineFooterPhrase = "Você está construindo algo sólido. Continue.";
  } else if (balance30Days < baseBalance || balance6Months < baseBalance) {
    timelineFooterPhrase = "Ainda dá tempo de mudar essa história. Comece agora.";
  }

  // Get highest goal
  const highestGoal = goals && goals.length > 0 
    ? [...goals].sort((a, b) => b.valor_meta - a.valor_meta)[0]
    : null;

  // Definição de Classificação e Frase descritiva
  let classification = "Excelente";
  let scoreColor = "text-green-500";
  let textGrad = "from-emerald-400 to-green-500";
  let humanPhrase = "Você está se saindo muito bem. Continue assim e suas metas chegam mais rápido.";

  if (finalScore <= 30) {
    classification = "Preocupante";
    scoreColor = "text-red-500";
    textGrad = "from-red-400 to-red-600";
    humanPhrase = "Você gastou mais do que ganhou este mês. Isso é mais comum do que parece — e tem solução.";
  } else if (finalScore <= 50) {
    classification = "Atenção";
    scoreColor = "text-amber-500";
    textGrad = "from-amber-400 to-amber-600";
    humanPhrase = "Você gastou mais do que ganhou este mês. Isso é mais comum do que parece — e tem solução.";
  } else if (finalScore <= 70) {
    classification = "Razoável";
    scoreColor = "text-blue-500";
    textGrad = "from-blue-400 to-blue-600";
    humanPhrase = "Você controlou os fixos, mas os gastos do dia a dia pesaram. Pequenos ajustes fazem diferença.";
  } else if (finalScore <= 90) {
    classification = "Bom";
    scoreColor = "text-emerald-400";
    textGrad = "from-emerald-300 to-emerald-500";
    humanPhrase = "Você está se saindo muito bem. Continue assim e suas metas chegam mais rápido.";
  }

  // Geração das Pills
  // 💚 O que foi bem
  let successPillText = "Contas em dia";
  const factorRatios = {
    saldo: saldoPoints / 40,
    var: varPoints / 25,
    bills: billsPoints / 20,
    consistency: consistencyPoints / 15
  };

  if (factorRatios.bills >= 0.9 && pagarBills.length > 0) {
    successPillText = "Contas em dia";
  } else if (factorRatios.saldo >= 0.9 && currentMonthBalance > 0) {
    successPillText = "Saldo sob controle";
  } else if (factorRatios.consistency >= 0.8 && uniqueDaysCount >= 5) {
    successPillText = "Registro constante";
  } else if (factorRatios.var >= 0.8 && totalVariableThisMonth > 0) {
    successPillText = "Variáveis baixos";
  } else {
    successPillText = "Foco financeiro ativo";
  }

  // ⚠️ O que pesou & 🎯 Uma ação
  let weighedText = "Gasto acima do esperado";
  let actionText = "Registre gastos todos os dias esta semana para pontuar melhor.";

  const lowestFactor = Object.entries(factorRatios).reduce((min, curr) => curr[1] < min[1] ? curr : min, ['saldo', 1] as [string, number]);

  if (lowestFactor[0] === 'saldo' && currentMonthBalance < 0) {
    weighedText = "Saldo negativo no mês";
    actionText = "Defina um teto menor para compras casuais nos próximos dias.";
  } else if (lowestFactor[0] === 'var' && highestCategoryAmount > 0) {
    weighedText = `${highestCategory} acima do normal`;
    
    // Sugestão em cima do que pesou
    if (highestCategory.includes('Alimentação fora')) {
      actionText = "Cozinhar em casa 3x a mais na semana evita furos desnecessários.";
    } else if (highestCategory.includes('Transporte')) {
      actionText = "Reduzir 2 saídas opcionais de carro na semana poupa combustível.";
    } else if (highestCategory.includes('Compras')) {
      actionText = "Espere 7 dias antes de comprar um item não essencial para testar o impulso.";
    } else if (highestCategory.includes('Lazer')) {
      actionText = "Substitua uma saída paga por um passeio gratuito no parque.";
    } else {
      actionText = `Reduza gastos supérfluos na categoria ${highestCategory} esta semana.`;
    }
  } else if (lowestFactor[0] === 'bills' && lateBills.length > 0) {
    weighedText = `${lateBills.length} boleto${lateBills.length > 1 ? 's' : ''} em atraso`;
    actionText = "Regularize as pendências de contas hoje para reconquistar pontos.";
  } else {
    // Fallbacks or consistency
    weighedText = "Faltaram registros";
    actionText = "Tente lançar pequenos gastos do café ou lanche todo final de dia.";
  }

  // Investment Calculator Calculator Engine
  const initial = parseFloat(invInitial) || 0;
  const monthly = parseFloat(invMonthly) || 0;
  const months = parseInt(invPeriod) || 0;
  
  const annualCDIRate = 10.5; // Selic/CDI aprox
  const monthlyRateCDI = annualCDIRate / 100 / 12;
  
  const finalFutureValue = monthlyRateCDI > 0 
    ? initial * Math.pow(1 + monthlyRateCDI, months) + monthly * ((Math.pow(1 + monthlyRateCDI, months) - 1) / monthlyRateCDI)
    : initial + (monthly * months);
  
  const totalAmountInvested = initial + (monthly * months);
  const totalYieldMoney = finalFutureValue - totalAmountInvested;

  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-lg mx-auto bg-black text-white min-h-screen px-4 py-6 selection:bg-emerald-500 selection:text-black">
      
      {/* 📊 TOPO DA TELA — Nota de comportamento */}
      <div className="text-center py-6 flex flex-col items-center justify-center space-y-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#888888]">
          Seu Score Financeiro do Mês
        </p>

        <div className="relative flex items-center justify-center">
          {/* Neon back glow */}
          <div className={`absolute w-32 h-32 rounded-full filter blur-xl opacity-20 bg-emerald-500`} />
          
          <div className="relative text-7xl md:text-8xl font-black tracking-tighter leading-none flex items-center justify-center h-44 w-44 rounded-full border border-white/5 bg-gradient-to-b from-[#111] to-black">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
              {finalScore}
            </span>
            <span className="text-xs text-muted absolute bottom-5">/100</span>
          </div>
        </div>

        <div className="text-center space-y-2">
          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-white/5 ${scoreColor}`}>
            {classification}
          </span>
          
          <div className="max-w-xs mx-auto pt-3">
            <p className="text-[13px] text-zinc-400 font-medium leading-relaxed">
              {humanPhrase}
            </p>
          </div>
        </div>
      </div>

      {/* 📊 BLOCO — Comparativo com o mês anterior */}
      <div className="bg-[#111111] border border-white/5 p-5 rounded-[28px] text-left space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#888888]">
          Comparado ao mês passado
        </p>
        
        <div className="flex items-center">
          {scoreDelta > 0 ? (
            <span className="text-sm font-black text-emerald-400">
              ▲ {Math.abs(scoreDelta)} pontos — você melhorou!
            </span>
          ) : scoreDelta < 0 ? (
            <span className="text-sm font-black text-rose-500">
              ▼ {Math.abs(scoreDelta)} pontos — mas ainda dá pra recuperar.
            </span>
          ) : (
            <span className="text-sm font-bold text-zinc-400">
              — Mesmo ritmo do mês passado.
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
          {explanationText}
        </p>
      </div>

      {/* 🔮 BLOCO — SUA LINHA DO TEMPO */}
      <div className="bg-[#0C0C0C] border border-white/5 p-6 rounded-[28px] text-left space-y-5 relative overflow-hidden group/timeline">
        {/* Neon premium decorative gradient */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 filter blur-3xl pointer-events-none rounded-full" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 rotate-12 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Sua Linha do Tempo</h3>
          </div>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-500/10">
            Projeção Inteligente
          </span>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
          Uma simulação ao longo do tempo baseada na consistência dos seus registros e saldo do mês atual.
        </p>

        {/* Vertical Timeline Structure */}
        <div className="relative w-full h-[360px] mt-4">
          
          {/* Left Side: SVG line curve drawing */}
          <svg className="absolute left-0 top-0 w-24 h-full overflow-visible" viewBox="0 0 80 360" fill="none">
            <defs>
              <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="timeline-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={colorNode1} />
                <stop offset="33%" stopColor={colorNode2} />
                <stop offset="66%" stopColor={colorNode3} />
                <stop offset="100%" stopColor={colorNode4} />
              </linearGradient>
            </defs>

            {/* Background line (dashed grey) */}
            <path 
              d={pathD} 
              fill="none" 
              stroke="#222" 
              strokeWidth="2.5" 
              strokeDasharray="4 4" 
            />

            {/* Foreground animated gradient line drawing "como um fio sendo puxado de cima para baixo" */}
            <motion.path
              d={pathD}
              fill="none"
              stroke="url(#timeline-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              filter="url(#neon-glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.2, ease: "easeInOut" }}
            />

            {/* Milestone 1 Node: Hoje */}
            {visibleMilestones.includes(1) && (
              <motion.circle
                cx={x1}
                cy={30}
                r="6"
                fill="#000"
                stroke={colorNode1}
                strokeWidth="3.5"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 15 }}
                className="cursor-pointer"
              />
            )}

            {/* Milestone 2 Node: Em 30 dias */}
            {visibleMilestones.includes(2) && (
              <>
                {/* Pulse ring (Verde se saldo positivo, vermelho se saldo negativo) */}
                <motion.circle
                  cx={x2}
                  cy={130}
                  r="12"
                  fill="transparent"
                  stroke={balance30Days >= 0 ? "#10B981" : "#EF4444"}
                  strokeWidth="2"
                  initial={{ opacity: 0.6, scale: 0.8 }}
                  animate={{ opacity: [0.6, 0, 0.6], scale: [0.8, 1.8, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                />
                <motion.circle
                  cx={x2}
                  cy={130}
                  r="6"
                  fill="#000"
                  stroke={colorNode2}
                  strokeWidth="3.5"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 15 }}
                />
              </>
            )}

            {/* Milestone 3 Node: Em 3 meses */}
            {visibleMilestones.includes(3) && (
              <>
                {isPro && (
                  <motion.circle
                    cx={x3}
                    cy={230}
                    r="10"
                    fill="transparent"
                    stroke={balance3Months >= 0 ? "#10B981" : "#EF4444"}
                    strokeWidth="1.5"
                    initial={{ opacity: 0.5, scale: 0.8 }}
                    animate={{ opacity: [0.5, 0, 0.5], scale: [0.8, 1.6, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  />
                )}
                <motion.circle
                  cx={x3}
                  cy={230}
                  r="6"
                  fill="#000"
                  stroke={isPro ? colorNode3 : "#444"}
                  strokeWidth="3.5"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 15 }}
                />
              </>
            )}

            {/* Milestone 4 Node: Em 6 meses */}
            {visibleMilestones.includes(4) && (
              <>
                {isPro && (
                  <motion.circle
                    cx={x4}
                    cy={330}
                    r="10"
                    fill="transparent"
                    stroke={balance6Months >= 0 ? "#10B981" : "#EF4444"}
                    strokeWidth="1.5"
                    initial={{ opacity: 0.5, scale: 0.8 }}
                    animate={{ opacity: [0.5, 0, 0.5], scale: [0.8, 1.6, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                  />
                )}
                <motion.circle
                  cx={x4}
                  cy={330}
                  r="6"
                  fill="#000"
                  stroke={isPro ? colorNode4 : "#444"}
                  strokeWidth="3.5"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 15 }}
                />
              </>
            )}
          </svg>

          {/* Right Side Info Cards, precisely aligned visually with SVG y coordinates */}
          <div className="absolute left-20 right-0 top-0 h-full">
            
            {/* Milestone 1 Detail: Hoje */}
            {visibleMilestones.includes(1) && (
               <motion.div 
                initial={{ opacity: 0, x: 15, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="absolute left-0 right-0 -translate-y-1/2 flex flex-col justify-center bg-white/[0.02] border border-white/5 p-2 px-3.5 rounded-2xl min-h-[70px] py-1.5 pointer-events-none" 
                style={{ top: '30px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Passo 1 — Hoje</p>
                </div>
                <div className="flex justify-between items-baseline mt-0.5">
                  <p className="text-[10px] text-zinc-400 font-bold">Saldo Livre</p>
                  <p className="text-xs font-black text-white">{formatMoney(baseBalance)}</p>
                </div>
              </motion.div>
            )}

            {/* Milestone 2 Detail: Em 30 dias */}
            {visibleMilestones.includes(2) && (
              <motion.div 
                initial={{ opacity: 0, x: 15, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="absolute left-0 right-0 -translate-y-1/2 flex flex-col justify-center bg-white/[0.02] border border-white/5 p-2 px-3.5 rounded-2xl min-h-[74px] py-1.5 pointer-events-none" 
                style={{ top: '130px' }}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${balance30Days >= 0 ? 'bg-emerald-400' : 'bg-red-500'}`} />
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Passo 2 — Em 30 Dias</p>
                </div>
                
                <div className="flex justify-between items-baseline mt-0.5">
                  <p className="text-[10px] text-zinc-400 font-bold">Saldo Projetado</p>
                  <p className={`text-xs font-black ${balance30Days >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {formatMoney(balance30Days)}
                  </p>
                </div>

                <p className="text-[9px] text-zinc-500 mt-0.5 leading-tight whitespace-normal text-wrap">
                  {balance30Days > baseBalance 
                    ? "Subindo de patamar com ritmo positivo" 
                    : "Em queda pelo patamar de consumo alto"}
                </p>
              </motion.div>
            )}

            {/* Milestone 3 Detail: Em 3 meses (Pro Locked check) */}
            {visibleMilestones.includes(3) && (
              <motion.div 
                initial={{ opacity: 0, x: 15, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4 }}
                className={`absolute left-0 right-0 -translate-y-1/2 flex flex-col justify-center bg-white/[0.02] border border-white/5 p-2 px-3.5 rounded-2xl min-h-[74px] py-1.5 transition-all text-left ${
                  !isPro ? 'cursor-pointer hover:bg-white/[0.04] hover:border-amber-500/20 active:scale-[0.98]' : ''
                }`}
                style={{ top: '230px' }}
                onClick={!isPro ? onUpgrade : undefined}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isPro ? (balance3Months >= 0 ? "bg-emerald-400" : "bg-red-500") : "bg-[#444]"}`} />
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Passo 3 — Em 3 Meses</p>
                </div>

                {!isPro ? (
                  <div className="flex items-center justify-between mt-1">
                    <div className="filter blur-[3px] select-none opacity-20">
                      <p className="text-xs font-bold text-white">R$ 14.500,00</p>
                    </div>
                    <button 
                      onClick={onUpgrade}
                      className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                    >
                      <Lock className="w-2.5 h-2.5 inline-block" /> Ver Futuro
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-baseline mt-0.5">
                      <p className="text-[10px] text-zinc-400 font-bold">Acumulado Previsto</p>
                      <p className={`text-xs font-black ${balance3Months >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {formatMoney(balance3Months)}
                      </p>
                    </div>
                    <p className={`text-[9px] font-bold mt-1 leading-tight whitespace-normal text-wrap ${balance3Months >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {balance3Months >= 0 
                        ? `Você pode ter ${formatMoney(balance3Months)} guardado.` 
                        : `Atenção: seu saldo projetado cairia para ${formatMoney(balance3Months)}.`}
                    </p>
                  </>
                )}
              </motion.div>
            )}

            {/* Milestone 4 Detail: Em 6 meses (Pro Locked check) */}
            {visibleMilestones.includes(4) && (
              <motion.div 
                initial={{ opacity: 0, x: 15, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.4 }}
                className={`absolute left-0 right-0 -translate-y-1/2 flex flex-col justify-center bg-white/[0.02] border border-white/5 p-2 px-3.5 rounded-2xl min-h-[74px] py-1.5 transition-all text-left ${
                  isPro 
                    ? 'cursor-pointer hover:bg-white/[0.04] hover:border-amber-500/25 active:scale-[0.98]' 
                    : 'cursor-pointer hover:bg-white/[0.04] hover:border-amber-500/20 active:scale-[0.98]'
                }`}
                style={{ top: '330px' }}
                onClick={() => {
                  if (!isPro) {
                    onUpgrade?.();
                  } else {
                    if (highestGoal && balance6Months < highestGoal.valor_meta) {
                      onNavigate('expenses');
                    } else {
                      onNavigate('goals');
                    }
                  }
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isPro ? "bg-indigo-400" : "bg-[#444]"}`} />
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Passo 4 — Em 6 Meses</p>
                </div>

                {!isPro ? (
                  <div className="flex items-center justify-between mt-1">
                    <div className="filter blur-[3.5px] select-none opacity-20">
                      <p className="text-xs font-bold text-white">Metas Projetadas</p>
                    </div>
                    <button 
                      onClick={onUpgrade}
                      className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                    >
                      <Lock className="w-2.5 h-2.5 inline-block" /> Ver Progresso
                    </button>
                  </div>
                ) : (
                  <div className="mt-0.5 flex flex-col">
                    {highestGoal ? (
                      <>
                        <div className="flex justify-between items-baseline">
                          <p className="text-[9px] text-zinc-400 font-bold truncate max-w-[130px]">{highestGoal.nome}</p>
                          <p className="text-[10px] text-zinc-500 font-semibold">{formatMoney(highestGoal.valor_meta)}</p>
                        </div>
                        <p className={`text-[9px] font-black mt-1 ${balance6Months >= highestGoal.valor_meta ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          {balance6Months >= highestGoal.valor_meta ? (
                            `Sua meta de ${highestGoal.nome} estaria alcançada.` 
                          ) : (
                            <span>
                              Sua meta de {highestGoal.nome} ainda estaria distante —{" "}
                              <span className="text-amber-400 hover:text-amber-300 underline font-extrabold cursor-pointer">
                                veja o que ajustar (Gastos) →
                              </span>
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-zinc-400 font-bold">Sem metas registradas</p>
                        <p className="text-[9px] text-indigo-400 font-semibold mt-1">
                          Sua reserva financeira estaria fortalecida!
                        </p>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}

          </div>

        </div>

        {/* Timeline Footer Message Segment */}
        {visibleMilestones.includes(4) && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="pt-4 border-t border-white/5 text-center"
          >
            <p className="text-[11px] text-zinc-200 leading-relaxed font-bold italic tracking-wide">
              "{timelineFooterPhrase}"
            </p>
          </motion.div>
        )}
      </div>

      {/* 💚 MEIO DA TELA — 3 pills horizontais simples */}
      <div className="pt-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-[#555555] mb-3">
          Resumo de Hábitos
        </p>
        
        <div className="grid grid-cols-1 gap-2.5">
          {/* Pill 1: O que foi bem */}
          <div className="flex items-center gap-3.5 bg-[#0C120D] border border-emerald-500/10 px-5 py-4 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <span className="text-sm">💚</span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-emerald-500/60 tracking-wider">O que foi bem</p>
              <p className="text-xs font-black text-white mt-0.5">{successPillText}</p>
            </div>
          </div>

          {/* Pill 2: O que pesou */}
          <div className="flex items-center gap-3.5 bg-[#141009] border border-amber-500/10 px-5 py-4 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <span className="text-sm">⚠️</span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-amber-500/60 tracking-wider">O que pesou</p>
              <p className="text-xs font-black text-white mt-0.5">{weighedText}</p>
            </div>
          </div>

          {/* Pill 3: Uma ação */}
          <div className="flex items-center gap-3.5 bg-[#0F1316] border border-blue-500/10 px-5 py-4 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <span className="text-sm">🎯</span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-blue-400/60 tracking-wider">Ação Recomendada</p>
              <p className="text-xs font-black text-zinc-100 mt-0.5 leading-relaxed">{actionText}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 RODAPÉ — Calculadora de investimento */}
      <div className="pt-6 border-t border-white/5 space-y-4">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-[#888888]">Evolução Financeira</h3>
        </div>

        <div className="bg-[#111111] p-6 rounded-[28px] border border-white/5 space-y-5 text-left">
          <div>
            <h4 className="text-sm font-black text-white">Simulador de Futuro</h4>
            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
              Visualize seu patrimônio evoluindo com rendimento líquido estimado de 10,5% a.a. (CDI).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] text-[#A3A3A3] uppercase font-black tracking-wider">Depósito inicial</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#666]">R$</span>
                <input 
                  type="number"
                  value={invInitial}
                  onChange={(e) => setInvInitial(e.target.value)}
                  className="w-full bg-black border border-white/5 focus:border-emerald-500/50 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold outline-none text-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-[#A3A3A3] uppercase font-black tracking-wider">Aporte mensal</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#666]">R$</span>
                <input 
                  type="number"
                  value={invMonthly}
                  onChange={(e) => setInvMonthly(e.target.value)}
                  className="w-full bg-black border border-white/5 focus:border-emerald-500/50 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold outline-none text-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-[#A3A3A3] uppercase font-black tracking-wider">Meses</label>
              <input 
                type="number"
                value={invPeriod}
                onChange={(e) => setInvPeriod(e.target.value)}
                className="w-full bg-black border border-white/5 focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs font-bold outline-none text-white transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[9px] text-zinc-500 font-extrabold uppercase">Total guardado</p>
              <p className="font-extrabold text-white mt-1 text-sm">{formatMoney(totalAmountInvested)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-emerald-400 font-extrabold uppercase">Dinheiro extra</p>
              <p className="font-extrabold text-emerald-400 mt-1 text-sm">+{formatMoney(totalYieldMoney)}</p>
            </div>
            
            <div className="col-span-2 pt-1">
              <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-zinc-400 font-black uppercase tracking-wider">Patrimônio Previsto</p>
                  <h4 className="text-lg font-black text-emerald-400 tracking-tight mt-1 animate-pulse">
                    {formatMoney(finalFutureValue)}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

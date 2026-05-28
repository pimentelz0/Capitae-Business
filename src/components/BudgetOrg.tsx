import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Coins, 
  TrendingUp, 
  Wallet, 
  HelpCircle, 
  Calendar, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Flame, 
  Sliders, 
  ShieldCheck 
} from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileData {
  monthly_income: number;
  payday: number;
  pay_frequency: string;
  pay_days: string;
  fixed_costs: number;
  perc_essentials: number;
  perc_leisure: number;
  perc_investment: number;
}

interface BudgetOrgProps {
  user: SupabaseUser;
  onActionComplete?: () => void;
  onBackToHome?: () => void;
}

export default function BudgetOrg({ user, onActionComplete, onBackToHome }: BudgetOrgProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    monthly_income: 0,
    payday: 5,
    pay_frequency: 'mensal',
    pay_days: '',
    fixed_costs: 0,
    perc_essentials: 50,
    perc_leisure: 30,
    perc_investment: 20
  });

  useEffect(() => {
    fetchProfile().catch(err => console.error('BudgetOrg: Error in fetchProfile:', err));
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('monthly_income, payday, pay_frequency, pay_days, fixed_costs, perc_essentials, perc_leisure, perc_investment')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProfile({
          monthly_income: data.monthly_income || 0,
          payday: data.payday || 5,
          pay_frequency: data.pay_frequency || 'mensal',
          pay_days: data.pay_days || '',
          fixed_costs: data.fixed_costs || 0,
          perc_essentials: data.perc_essentials ?? 50,
          perc_leisure: data.perc_leisure ?? 30,
          perc_investment: data.perc_investment ?? 20
        });
      }
    } catch (error: any) {
      console.error('Erro ao buscar perfil para orçamento:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const sum = profile.perc_essentials + profile.perc_leisure + profile.perc_investment;
    if (sum !== 100 && profile.monthly_income > 0) {
      alert(`A soma das porcentagens de distribuição deve ser exatamente 100%. Atualmente está em ${sum}%. Por favor, ajuste os valores.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        monthly_income: profile.monthly_income,
        payday: profile.payday,
        pay_frequency: profile.pay_frequency,
        pay_days: profile.pay_days,
        fixed_costs: profile.fixed_costs,
        perc_essentials: profile.perc_essentials,
        perc_leisure: profile.perc_leisure,
        perc_investment: profile.perc_investment,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);

      if (error) throw error;
      
      setShowSaved(true);
      if (onActionComplete) onActionComplete();
      setTimeout(() => setShowSaved(false), 3000);
    } catch (error: any) {
      alert('Erro ao salvar organização salarial: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Calculations for real-time preview (Super Easy for anyone to understand)
  const formatMoney = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const netSalary = Math.max(0, profile.monthly_income - profile.fixed_costs);
  const essentialsAmount = (netSalary * profile.perc_essentials) / 100;
  const leisureAmount = (netSalary * profile.perc_leisure) / 100;
  const investmentAmount = (netSalary * profile.perc_investment) / 100;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted font-bold uppercase tracking-widest">Carregando Planejamento...</span>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        {onBackToHome && (
          <button 
            onClick={onBackToHome}
            className="p-3 bg-secondary hover:bg-foreground/5 rounded-2xl transition-colors border border-foreground/5"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h2 className="text-xl font-bold tracking-tight">Organização Salarial</h2>
          <p className="text-xs text-muted">Divida seu dinheiro de forma inteligente e sem estresse.</p>
        </div>
      </div>

      {/* Main Budget Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Step 1: Income and Pay Frequency */}
        <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-foreground/5">
            <Coins className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-widest">1. Quanto você ganha?</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-muted uppercase font-bold tracking-widest">Seu Salário ou Renda Mensal (R$)</label>
              <input 
                type="number"
                min="0"
                value={profile.monthly_income || ''}
                onChange={e => setProfile({ ...profile, monthly_income: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                placeholder="Exemplo: 3000"
                className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all font-bold text-lg"
              />
              <p className="text-[10px] text-muted">Digite o valor total líquido que você recebe por mês.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-muted uppercase font-bold tracking-widest">Com qual frequência recebe?</label>
              <select 
                value={profile.pay_frequency}
                onChange={e => setProfile({ ...profile, pay_frequency: e.target.value })}
                className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all font-bold"
              >
                <option value="mensal">Uma vez por mês (Mensal)</option>
                <option value="quinzenal">Duas vezes por mês (Quinzenal)</option>
                <option value="semanal font-bold">Toda semana (Semanal)</option>
                <option value="personalizado">Vários dias fixos</option>
                <option value="irregular">Não tenho data fixa (Autônomo/Freelancer)</option>
              </select>
            </div>

            {profile.pay_frequency === 'mensal' && (
              <div className="space-y-2">
                <label className="text-[10px] text-muted uppercase font-bold tracking-widest">Em qual dia do mês você recebe?</label>
                <input 
                  type="number"
                  min="1"
                  max="31"
                  value={profile.payday || ''}
                  onChange={e => setProfile({ ...profile, payday: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  placeholder="Ex: 5"
                  className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all font-bold"
                />
              </div>
            )}

            {profile.pay_frequency === 'quinzenal' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase font-bold tracking-widest font-bold">1º Dia de Receber</label>
                  <input 
                    type="number"
                    min="1"
                    max="31"
                    value={profile.pay_days.split(',')[0] || ''}
                    onChange={e => {
                      const days = profile.pay_days.split(',');
                      days[0] = e.target.value;
                      setProfile({ ...profile, pay_days: days.join(',') });
                    }}
                    placeholder="Ex: 5"
                    className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase font-bold tracking-widest font-bold">2º Dia de Receber</label>
                  <input 
                    type="number"
                    min="1"
                    max="31"
                    value={profile.pay_days.split(',')[1] || ''}
                    onChange={e => {
                      const days = profile.pay_days.split(',');
                      if (days.length < 2) days.push('');
                      days[1] = e.target.value;
                      setProfile({ ...profile, pay_days: days.join(',') });
                    }}
                    placeholder="Ex: 20"
                    className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
            )}

            {profile.pay_frequency === 'semanal' && (
              <div className="space-y-2">
                <label className="text-[10px] text-muted uppercase font-bold tracking-widest">Dia da Semana que você recebe</label>
                <select 
                  value={profile.pay_days}
                  onChange={e => setProfile({ ...profile, pay_days: e.target.value })}
                  className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all font-bold"
                >
                  <option value="">Selecione...</option>
                  <option value="segunda">Segunda-feira</option>
                  <option value="terca">Terça-feira</option>
                  <option value="quarta">Quarta-feira</option>
                  <option value="quinta">Quinta-feira</option>
                  <option value="sexta">Sexta-feira</option>
                  <option value="sabado">Sábado</option>
                  <option value="domingo">Domingo</option>
                </select>
              </div>
            )}

            {profile.pay_frequency === 'personalizado' && (
              <div className="space-y-2">
                <label className="text-[10px] text-muted uppercase font-bold tracking-widest">Dias do Mês (separados por vírgula)</label>
                <input 
                  type="text"
                  value={profile.pay_days}
                  onChange={e => setProfile({ ...profile, pay_days: e.target.value })}
                  placeholder="Ex: 5, 15, 25"
                  className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all"
                />
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Fixed Costs and Savings Distribution */}
        <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-foreground/5">
            <Wallet className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest">2. Custos Fixos OBRIGATÓRIOS</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-muted uppercase font-bold tracking-widest">Soma das suas Despesas Fixas (R$)</label>
              <input 
                type="number"
                min="0"
                value={profile.fixed_costs || ''}
                onChange={e => setProfile({ ...profile, fixed_costs: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                placeholder="Exemplo: 1200"
                className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all font-bold text-lg"
              />
              <p className="text-[10px] text-muted">Contas que você PRECISA pagar todo mês (Aluguel, Energia, Internet, Condomínio, etc.).</p>
            </div>

            {profile.monthly_income > 0 && (
              <div className="p-4 bg-foreground/5 rounded-2xl space-y-2 border border-foreground/5">
                <p className="text-xs text-muted">
                  Do seu salário de <strong className="text-foreground">{formatMoney(profile.monthly_income)}</strong>, subtraindo as despesas fixas obrigatórias de <strong className="text-red-500">{formatMoney(profile.fixed_costs)}</strong>, sobram <strong className="text-primary">{formatMoney(netSalary)}</strong> para você dividir em suas metas e gastos livres.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Distribution percentage simulator (Super clean bento layout) */}
      <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-foreground/5">
          <Sliders className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest">3. Divisão Inteligente (O que sobra)</h3>
        </div>

        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/15 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Como funciona a divisão?</h4>
            <p className="text-xs text-muted leading-relaxed">
              O método clássico e recomendado é guardar <strong>50%</strong> para gastos Essenciais do dia a dia, <strong>30%</strong> para o seu Lazer e felicidade do mês, e <strong>20%</strong> para Investir no seu futuro. Você pode personalizar essas porcentagens como preferir, desde que a soma dê <strong>100%</strong>!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Essentials Card */}
          <div className="bg-background/40 p-5 rounded-2xl border border-foreground/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">🏠 Essenciais (Dia a Dia)</span>
              <span className="text-xs font-bold text-muted bg-foreground/5 px-2 py-0.5 rounded-md">{profile.perc_essentials}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="100"
              value={profile.perc_essentials}
              onChange={e => {
                const val = parseInt(e.target.value);
                setProfile({ ...profile, perc_essentials: val });
              }}
              className="w-full accent-yellow-500"
            />
            <div className="space-y-1">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Valor Mensal Estimado</p>
              <p className="text-xl font-bold text-foreground">{formatMoney(essentialsAmount)}</p>
              <p className="text-[9px] text-muted">Mercado, transporte diário, recargas, almoços rápidos.</p>
            </div>
          </div>

          {/* Leisure Card */}
          <div className="bg-background/40 p-5 rounded-2xl border border-foreground/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">🎉 Lazer & Estilo de Vida</span>
              <span className="text-xs font-bold text-muted bg-foreground/5 px-2 py-0.5 rounded-md">{profile.perc_leisure}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="100"
              value={profile.perc_leisure}
              onChange={e => {
                const val = parseInt(e.target.value);
                setProfile({ ...profile, perc_leisure: val });
              }}
              className="w-full accent-purple-400"
            />
            <div className="space-y-1">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Valor Mensal Estimado</p>
              <p className="text-xl font-bold text-foreground">{formatMoney(leisureAmount)}</p>
              <p className="text-[9px] text-muted">Restaurantes, saídas no fim de semana, hobbies, cinema.</p>
            </div>
          </div>

          {/* Investment Card */}
          <div className="bg-background/40 p-5 rounded-2xl border border-foreground/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">📈 Investir & Futuro</span>
              <span className="text-xs font-bold text-muted bg-foreground/5 px-2 py-0.5 rounded-md">{profile.perc_investment}%</span>
            </div>
            <input 
              type="range"
              min="0"
              max="100"
              value={profile.perc_investment}
              onChange={e => {
                const val = parseInt(e.target.value);
                setProfile({ ...profile, perc_investment: val });
              }}
              className="w-full accent-primary"
            />
            <div className="space-y-1">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Valor Mensal Estimado</p>
              <p className="text-xl font-bold text-foreground">{formatMoney(investmentAmount)}</p>
              <p className="text-[9px] text-muted">Poupança, reserva de emergência, metas ou ativos.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-foreground/5">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold">
              Soma Total da Divisão:{' '}
              <span className={profile.perc_essentials + profile.perc_leisure + profile.perc_investment === 100 ? 'text-primary' : 'text-red-500'}>
                {profile.perc_essentials + profile.perc_leisure + profile.perc_investment}%
              </span>
            </p>
            <p className="text-[10px] text-muted">A soma precisa ser exatamente igual a 100%.</p>
          </div>

          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-8 py-4 w-full sm:w-auto font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,191,165,0.3)] duration-200 active:scale-95 transition-all text-xs uppercase tracking-widest ${
              showSaved ? 'bg-green-500 text-white' : 'bg-primary text-background'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : showSaved ? (
              <><CheckCircle2 className="w-4 h-4" /> Configuração Salva</>
            ) : (
              <><Save className="w-4 h-4" /> Salvar Planejamento</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Star, Zap, Coins, Flame, CheckCircle2, Circle, Target, Bot, Palette, Moon, Coffee, Ghost, Sparkles, ChevronRight } from 'lucide-react';
import { getSafeUser, supabase } from '../lib/supabase';

import { User as SupabaseUser } from '@supabase/supabase-js';

interface Mission {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  coin_reward: number;
  completed: boolean;
  type: string;
}

interface Profile {
  xp: number;
  level: string;
  coins: number;
  streak: number;
  rico_personality?: string;
  theme_color?: string;
}

interface ShopItem {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: React.ReactNode;
  type: 'xp' | 'personality' | 'theme' | 'unlimited_chat';
  value: any;
}

interface GamificationProps {
  user: SupabaseUser;
  profile: Profile;
  missions: Mission[];
  expenses: any[];
  goals: any[];
  visits: Record<string, boolean>;
  isPro?: boolean;
  onUpgrade?: () => void;
  onMissionComplete: () => void;
  onNavigate?: (tab: 'home' | 'expenses' | 'goals' | 'learn' | 'capy' | 'profile' | 'gamification' | 'forecast' | 'reports') => void;
}

export default function Gamification({ user, profile, missions, expenses, goals, visits, isPro, onUpgrade, onMissionComplete, onNavigate }: GamificationProps) {
  const [buying, setBuying] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [eligibilityMap, setEligibilityMap] = useState<Record<string, boolean>>({});
  const [inventory, setInventory] = useState<string[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'missions' | 'shop' | 'inventory'>('missions');

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  useEffect(() => {
    if (user?.id) {
      fetchInventory().catch(err => console.error('Gamification: Error in fetchInventory:', err));
    }
  }, [user?.id, profile.coins]); // Refresh inventory when user changes or coins change

  const fetchInventory = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingInventory(true);
      const { data, error } = await supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Erro ao buscar inventário:', error);
        return;
      }
      
      const ids = data ? data.map((i: any) => i.item_id) : [];
      setInventory(ids);
    } catch (err) {
      console.error('Erro inesperado ao buscar inventário:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

  const levels = ['Iniciante', 'Controlado', 'Estratégico', 'Mestre Financeiro'];
  const xpPerLevel = 1000;

  const checkMissionEligibility = async (mission: Mission): Promise<{ eligible: boolean; message?: string }> => {
    try {
      const today = new Date().toLocaleDateString('en-CA');
      
      switch (mission.type) {
        case 'expense': {
          const hasTodayExpense = expenses.some(e => e.data && e.data.startsWith(today));
          return hasTodayExpense 
            ? { eligible: true } 
            : { eligible: false, message: 'Você ainda não registrou nenhum gasto hoje.' };
        }
        case 'goals': {
          return goals.length > 0 
            ? { eligible: true } 
            : { eligible: false, message: 'Você precisa ter pelo menos uma caixinha criada.' };
        }
        case 'capy': {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('id')
            .gte('created_at', today)
            .limit(1);
          
          if (error) throw error;
          
          return data && data.length > 0 
            ? { eligible: true } 
            : { eligible: false, message: 'Você ainda não conversou com o Capy hoje.' };
        }
        case 'budget':
          return visits['forecast'] 
            ? { eligible: true } 
            : { eligible: false, message: 'Visite a aba de Previsão para analisar seu orçamento.' };
        case 'save':
          // For "Economizar hoje", we can check if expenses today are low or zero
          const todayExpenses = expenses.filter(e => e.data && e.data.startsWith(today) && e.tipo !== 'entrada');
          return todayExpenses.length === 0
            ? { eligible: true }
            : { eligible: false, message: 'Você registrou gastos hoje. Tente amanhã para economizar!' };
        case 'gamification':
          return { eligible: true };
        case 'profile': {
          const user = await getSafeUser();
          if (!user) return { eligible: false, message: 'Usuário não autenticado.' };
          
          const { data, error } = await supabase
            .from('profiles')
            .select('updated_at')
            .eq('id', user.id)
            .maybeSingle();
          
          if (error) throw error;
          
          const isUpdatedToday = data?.updated_at && data.updated_at.startsWith(today);
          return isUpdatedToday 
            ? { eligible: true } 
            : { eligible: false, message: 'Atualize seu perfil (bio ou nome) para completar.' };
        }
        case 'invest':
        case 'forecast':
          return visits['forecast'] 
            ? { eligible: true } 
            : { eligible: false, message: 'Visite a aba de Previsão para completar.' };
        case 'learn':
          return visits['learn'] 
            ? { eligible: true } 
            : { eligible: false, message: 'Visite a aba de Educação para completar.' };
        case 'history':
          return visits['expenses'] 
            ? { eligible: true } 
            : { eligible: false, message: 'Visite seu Histórico de Gastos para completar.' };
        case 'reports':
          return visits['reports'] 
            ? { eligible: true } 
            : { eligible: false, message: 'Veja seus Relatórios para completar.' };
        default:
          return { eligible: true };
      }
    } catch (err) {
      console.error('Gamification: Error in checkMissionEligibility:', err);
      return { eligible: false, message: 'Erro ao verificar elegibilidade.' };
    }
  };

  useEffect(() => {
    const checkAll = async () => {
      try {
        const results: Record<string, boolean> = {};
        for (const m of missions) {
          if (!m.completed) {
            const res = await checkMissionEligibility(m);
            results[m.id] = res.eligible;
          }
        }
        setEligibilityMap(results);
      } catch (err) {
        console.error('Gamification: Error checking mission eligibility:', err);
      }
    };
    checkAll().catch(err => console.error('Gamification: Error in checkAll:', err));
  }, [missions, expenses, goals, visits]);

  const shopItems: ShopItem[] = [
    {
      id: 'xp_potion',
      title: 'Poção de XP',
      description: 'Ganha instantaneamente 500 XP para subir de nível.',
      price: 100,
      icon: <Zap className="w-6 h-6 text-blue-400" />,
      type: 'xp',
      value: 500
    },
    {
      id: 'capy_coach',
      title: 'Capy Coach',
      description: 'Desbloqueia a personalidade "Coach" para o Capy (mais rigoroso).',
      price: 500,
      icon: <Bot className="w-6 h-6 text-purple-400" />,
      type: 'personality',
      value: 'coach'
    },
    {
      id: 'capy_zen',
      title: 'Capy Zen',
      description: 'Desbloqueia a personalidade "Zen" para o Capy (calmo e pacífico).',
      price: 300,
      icon: <Coffee className="w-6 h-6 text-emerald-400" />,
      type: 'personality',
      value: 'zen'
    },
    {
      id: 'capy_nerd',
      title: 'Capy Nerd',
      description: 'Desbloqueia a personalidade "Nerd" para o Capy (focado em dados e estatísticas).',
      price: 400,
      icon: <Bot className="w-6 h-6 text-blue-400" />,
      type: 'personality',
      value: 'nerd'
    },
    {
      id: 'capy_sarcastic',
      title: 'Capy Sarcástico',
      description: 'Desbloqueia a personalidade "Sarcástica" para o Capy (humor ácido e irônico).',
      price: 600,
      icon: <Ghost className="w-6 h-6 text-red-400" />,
      type: 'personality',
      value: 'sarcastic'
    },
    {
      id: 'golden_theme',
      title: 'Tema Dourado',
      description: 'Muda a cor principal do aplicativo para dourado.',
      price: 1000,
      icon: <Star className="w-6 h-6 text-yellow-400" />,
      type: 'theme',
      value: '#FFD700'
    },
    {
      id: 'neon_theme',
      title: 'Tema Neon',
      description: 'Muda a cor principal do aplicativo para verde neon vibrante.',
      price: 1200,
      icon: <Palette className="w-6 h-6 text-primary" />,
      type: 'theme',
      value: '#39FF14'
    },
    {
      id: 'deep_dark_theme',
      title: 'Tema Black Out',
      description: 'Muda a cor principal do aplicativo para um cinza ultra escuro.',
      price: 800,
      icon: <Moon className="w-6 h-6 text-slate-400" />,
      type: 'theme',
      value: '#121212'
    },
    {
      id: 'capy_unlimited',
      title: 'Capy Ilimitado',
      description: 'Remove o limite mensal de mensagens com o Capy para sempre.',
      price: 2000,
      icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
      type: 'unlimited_chat',
      value: true
    }
  ];

  const handleBuyItem = async (item: ShopItem) => {
    // Check if already in inventory
    if (inventory.includes(item.id)) {
      alert('Você já possui este item!');
      return;
    }

    // Personalities are Pro-only
    if (item.type === 'personality' && !isPro) {
      if (onUpgrade) onUpgrade();
      return;
    }

    if ((profile.coins || 0) < item.price) {
      alert('Moedas insuficientes!');
      return;
    }

    setBuying(item.id);
    try {
      // 1. Deduct coins and update profile (if XP)
      let profileUpdates: any = {
        coins: (profile.coins || 0) - item.price
      };

      if (item.type === 'xp') {
        const newXP = profile.xp + item.value;
        const newLevelIndex = Math.floor(newXP / xpPerLevel);
        const newLevel = newLevelIndex < levels.length ? levels[newLevelIndex] : levels[levels.length - 1];
        profileUpdates.xp = newXP;
        profileUpdates.level = newLevel;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Add to inventory (if not XP)
      if (item.type !== 'xp') {
        const { error: invError } = await supabase
          .from('user_inventory')
          .insert([{
            user_id: user.id,
            item_id: item.id,
            item_type: item.type,
            item_value: item.value
          }]);
        
        if (invError) throw invError;
        setInventory(prev => [...prev, item.id]);
        await fetchInventory();
      }
      
      alert(`Você comprou: ${item.title}!`);
      onMissionComplete(); // Refresh profile data
    } catch (err: any) {
      console.error('Erro ao comprar item:', err);
      alert(`Erro ao processar compra: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setBuying(null);
    }
  };

  const handleEquipItem = async (item: ShopItem) => {
    // Personalities are Pro-only
    if (item.type === 'personality' && !isPro) {
      if (onUpgrade) onUpgrade();
      return;
    }

    setBuying(item.id);
    try {
      let updates: any = {};
      if (item.type === 'personality') {
        updates.rico_personality = item.value;
      } else if (item.type === 'theme') {
        updates.theme_color = item.value;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      onMissionComplete();
    } catch (err: any) {
      console.error('Erro ao equipar item:', err);
      alert('Erro ao equipar item.');
    } finally {
      setBuying(null);
    }
  };

  const handleUnequipItem = async (type: 'personality' | 'theme') => {
    setBuying('unequip-' + type);
    try {
      let updates: any = {};
      if (type === 'personality') {
        updates.rico_personality = 'default';
      } else if (type === 'theme') {
        updates.theme_color = '#00C853'; // Default green
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      onMissionComplete();
    } catch (err: any) {
      console.error('Erro ao desequipar item:', err);
      alert('Erro ao desequipar item.');
    } finally {
      setBuying(null);
    }
  };

  const getMissionTab = (type: string): 'home' | 'expenses' | 'goals' | 'learn' | 'capy' | 'profile' | 'gamification' | 'forecast' | 'reports' => {
    switch (type) {
      case 'expense': return 'expenses';
      case 'goals': return 'goals';
      case 'capy': return 'capy';
      case 'rico': return 'capy';
      case 'profile': return 'profile';
      case 'invest': return 'forecast';
      case 'budget': return 'forecast';
      case 'save': return 'expenses';
      case 'learn': return 'learn';
      case 'reports': return 'reports';
      case 'history': return 'expenses';
      case 'gamification': return 'gamification';
      default: return 'home';
    }
  };

  const currentLevelIndex = levels.indexOf(profile.level || 'Sobrevivente');
  const nextLevelXP = (currentLevelIndex + 1) * xpPerLevel;
  const currentXPInLevel = profile.xp % xpPerLevel;
  const progress = (currentXPInLevel / xpPerLevel) * 100;

  const handleCompleteMission = async (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    setCompleting(missionId);
    try {
      const eligibility = await checkMissionEligibility(mission);
      
      if (!eligibility.eligible) {
        alert(eligibility.message || 'Você ainda não cumpriu os requisitos desta missão.');
        setCompleting(null);
        return;
      }

      const { error } = await supabase
        .from('daily_missions')
        .update({ completed: true })
        .eq('id', missionId);

      if (error) throw error;
      
      // Award XP and Coins
      const newXP = profile.xp + mission.xp_reward;
      const newCoins = profile.coins + mission.coin_reward;
      
      // Update level if needed
      let newLevel = profile.level;
      const newLevelIndex = Math.floor(newXP / xpPerLevel);
      if (newLevelIndex < levels.length) {
        newLevel = levels[newLevelIndex];
      }

      await supabase.from('profiles').update({
        xp: newXP,
        coins: newCoins,
        level: newLevel
      }).eq('id', user.id);

      onMissionComplete();
    } catch (err) {
      console.error('Erro ao completar missão:', err);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Level Card */}
      <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Trophy className="w-32 h-32 text-primary" />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
            <Star className="w-8 h-8 text-primary fill-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-primary">{profile.level || 'Sobrevivente'}</h3>
            <p className="text-xs text-muted font-bold uppercase tracking-widest">Nível Atual</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
            <span className="text-muted">{currentXPInLevel} XP</span>
            <span className="text-primary">{xpPerLevel} XP para o próximo nível</span>
          </div>
          <div className="h-3 bg-background rounded-full overflow-hidden border border-foreground/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-primary shadow-[0_0_15px_rgba(0,200,83,0.5)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-4">
          <div className="bg-background/50 p-4 rounded-2xl border border-foreground/5 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{profile.coins || 0}</p>
              <p className="text-[10px] text-muted uppercase font-bold">Moedas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex p-1 bg-secondary rounded-2xl border border-foreground/5 sticky top-0 z-10 backdrop-blur-md">
        <button 
          onClick={() => setActiveSubTab('missions')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'missions' ? 'bg-primary text-background' : 'text-muted hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          <span className="hidden sm:inline">Missões</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('shop')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'shop' ? 'bg-primary text-background' : 'text-muted hover:text-white'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span className="hidden sm:inline">Loja</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('inventory')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'inventory' ? 'bg-primary text-background' : 'text-muted hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="hidden sm:inline">Inventário</span>
        </button>
      </div>

      {activeSubTab === 'missions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold">Missões Diárias</h3>
          </div>
          
          <div className="space-y-3">
            {missions.length > 0 ? missions.map(mission => (
              <motion.div 
                key={mission.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => !mission.completed && onNavigate && onNavigate(getMissionTab(mission.type))}
                className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                  mission.completed 
                    ? 'bg-primary/5 border-primary/20 opacity-60' 
                    : 'bg-secondary border-white/5 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    mission.completed ? 'bg-primary/20' : 'bg-background'
                  }`}>
                    {mission.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted" />
                    )}
                  </div>
                  <div>
                    <p className={`font-bold ${mission.completed ? 'line-through text-muted' : ''}`}>
                      {mission.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                        <Zap className="w-3 h-3" /> +{mission.xp_reward} XP
                      </span>
                      <span className="text-[10px] font-bold text-yellow-500 flex items-center gap-1">
                        <Coins className="w-3 h-3" /> +{mission.coin_reward} Moedas
                      </span>
                    </div>
                  </div>
                </div>
                
                {!mission.completed && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteMission(mission.id);
                      }}
                      disabled={completing === mission.id || !eligibilityMap[mission.id]}
                      className={`px-4 py-2 text-background text-xs font-bold rounded-lg active:scale-95 transition-all ${
                        completing === mission.id 
                          ? 'bg-primary/50 cursor-wait' 
                          : !eligibilityMap[mission.id]
                            ? 'bg-foreground/5 text-muted cursor-not-allowed border border-foreground/5'
                            : 'bg-primary shadow-[0_0_10px_rgba(0,200,83,0.3)]'
                      }`}
                    >
                      {completing === mission.id ? 'Verificando...' : 
                       !eligibilityMap[mission.id] ? 'Bloqueado' : 'Concluir'}
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                )}
              </motion.div>
            )) : (
              <div className="p-8 text-center bg-secondary rounded-3xl border border-foreground/5">
                <p className="text-muted text-sm">Nenhuma missão disponível para hoje.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'shop' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-bold">Loja de Recompensas</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shopItems.map(item => {
              // Normalize legacy IDs (rico_* -> capy_*)
              const normalizedId = item.id.startsWith('rico_') ? item.id.replace('rico_', 'capy_') : item.id;
              const isOwned = inventory.some(id => {
                const normalizedInvId = id.startsWith('rico_') ? id.replace('rico_', 'capy_') : id;
                return normalizedInvId === normalizedId;
              });
              const isEquipped = (item.type === 'personality' && profile.rico_personality === item.value) || 
                               (item.type === 'theme' && profile.theme_color === item.value);

              return (
                <motion.div 
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-secondary p-6 rounded-3xl border border-white/5 space-y-4 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center border border-white/5">
                      {item.icon}
                    </div>
                    {!isOwned && (
                      <div className="flex items-center gap-1 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                        <Coins className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs font-bold text-yellow-500">{item.price}</span>
                      </div>
                    )}
                    {isOwned && (
                      <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Adquirido</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-bold">{item.title}</h4>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{item.description}</p>
                  </div>

                  <div className="pt-4 space-y-2">
                    {item.type === 'xp' ? (
                      <button 
                        onClick={() => handleBuyItem(item)}
                        disabled={buying === item.id || (profile.coins || 0) < item.price}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                          (profile.coins || 0) >= item.price
                            ? 'bg-primary text-background'
                            : 'bg-foreground/5 text-muted cursor-not-allowed'
                        }`}
                      >
                        {buying === item.id ? 'Processando...' : 'Comprar'}
                      </button>
                    ) : (
                      <>
                        {isEquipped ? (
                          <button 
                            onClick={() => handleUnequipItem(item.type as 'personality' | 'theme')}
                            disabled={buying === 'unequip-' + item.type}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 bg-primary/20 text-primary border border-primary/30"
                          >
                            {buying === 'unequip-' + item.type ? 'Processando...' : 'Desequipar'}
                          </button>
                        ) : isOwned ? (
                          <button 
                            onClick={() => handleEquipItem(item)}
                            disabled={buying === item.id}
                            className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          >
                            {buying === item.id ? 'Processando...' : 'Equipar'}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleBuyItem(item)}
                            disabled={buying === item.id || (profile.coins || 0) < item.price}
                            className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                              (profile.coins || 0) >= item.price
                                ? 'bg-primary text-background'
                                : 'bg-foreground/5 text-muted cursor-not-allowed'
                            }`}
                          >
                            {buying === item.id ? 'Processando...' : 'Comprar'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold">Meu Inventário</h3>
            </div>
            <button 
              onClick={fetchInventory}
              disabled={loadingInventory}
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all flex items-center gap-2"
            >
              <Zap className={`w-3 h-3 ${loadingInventory ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
          </div>

          {loadingInventory ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {inventory.length === 0 ? (
                <div className="p-12 text-center bg-secondary rounded-3xl border border-foreground/5">
                  <p className="text-muted text-sm">Você ainda não possui itens no inventário.</p>
                  <button 
                    onClick={() => setActiveSubTab('shop')}
                    className="mt-4 text-primary font-bold text-sm hover:underline"
                  >
                    Ir para a Loja
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inventory.map(rawId => {
                    // Normalize legacy IDs (rico_* -> capy_*)
                    const itemId = rawId.startsWith('rico_') ? rawId.replace('rico_', 'capy_') : rawId;
                    const item = shopItems.find(i => i.id === itemId);
                    const isEquipped = item ? ((item.type === 'personality' && profile.rico_personality === item.value) || 
                                     (item.type === 'theme' && profile.theme_color === item.value)) : false;

                    return (
                      <motion.div 
                        key={itemId}
                        whileHover={{ scale: 1.02 }}
                        className="bg-secondary p-6 rounded-3xl border border-white/5 space-y-4 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center border border-white/5">
                            {item ? item.icon : <Trophy className="w-6 h-6 text-muted" />}
                          </div>
                          {isEquipped && (
                            <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Equipado</span>
                            </div>
                          )}
                          {!item && (
                            <div className="bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Especial</span>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="font-bold">{item ? item.title : `Item #${itemId}`}</h4>
                          <p className="text-xs text-muted mt-1 leading-relaxed">
                            {item ? item.description : 'Este é um item especial adquirido anteriormente.'}
                          </p>
                        </div>

                        <div className="pt-4">
                          {item ? (
                            isEquipped ? (
                              <button 
                                onClick={() => handleUnequipItem(item.type as 'personality' | 'theme')}
                                disabled={buying === 'unequip-' + item.type}
                                className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 bg-primary/20 text-primary border border-primary/30"
                              >
                                {buying === 'unequip-' + item.type ? 'Processando...' : 'Desequipar'}
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleEquipItem(item)}
                                disabled={buying === item.id}
                                className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              >
                                {buying === item.id ? 'Processando...' : 'Equipar'}
                              </button>
                            )
                          ) : (
                            <p className="text-[10px] text-muted text-center italic">Item ativo permanentemente</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

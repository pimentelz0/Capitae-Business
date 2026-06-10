import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Calculator, 
  LogOut, 
  Menu, 
  User as UserIcon, 
  X, 
  Coins, 
  BarChart3, 
  Sun, 
  Moon, 
  DollarSign, 
  Eye, 
  EyeOff,
  Package,
  Clock,
  Check,
  AlertCircle
} from 'lucide-react';

// Domain imports
import { Produto, Transacao } from '../types';
import PDV from './PDV';
import Financeiro from './Financeiro';
import Estoque from './Estoque';
import Relatorios from './Relatorios';
import Precificacao from './Precificacao';
import Profile from './Profile';

// Context components
import OnboardingModal from './OnboardingModal';
import TermsConsentModal from './TermsConsentModal';
import NotificationCenter from './NotificationCenter';
import { User } from '@supabase/supabase-js';

// Seed initial stock so the merchant does not start with an empty dashboard
const INITIAL_PRODUCTS: Produto[] = [
  { id: 'prod_1_coco', nome: 'Coca-Cola Lata 350ml', categoria: 'Bebidas', quantidade: 18, estoque_minimo: 5, preco_custo: 2.50, preco_venda: 6.00 },
  { id: 'prod_2_pao', nome: 'Pão de Queijo Assado', categoria: 'Alimentos', quantidade: 25, estoque_minimo: 8, preco_custo: 1.50, preco_venda: 4.50 },
  { id: 'prod_3_cafe', nome: 'Café Expresso Gourmet', categoria: 'Bebidas', quantidade: 40, estoque_minimo: 10, preco_custo: 1.20, preco_venda: 5.00 },
  { id: 'prod_4_coxi', nome: 'Coxinha de Frango', categoria: 'Alimentos', quantidade: 2, estoque_minimo: 5, preco_custo: 2.20, preco_venda: 7.00 },
  { id: 'prod_5_agua', nome: 'Água Mineral sem Gás', categoria: 'Bebidas', quantidade: 30, estoque_minimo: 6, preco_custo: 0.80, preco_venda: 3.00 }
];

// Seed initial financial transactions to make the charts/reports instantly beautiful and active
const generateInitialTransactions = (): Transacao[] => {
  const getPastDateString = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  return [
    { id: 't_seed_1', tipo: 'saida', descricao: 'Aluguel do Ponto Comercial', valor: 900.00, categoria: 'Aluguel', data: getPastDateString(15), tipo_registro: 'imediato', status: 'pago' },
    { id: 't_seed_2', tipo: 'saida', descricao: 'Conta de Energia Elétrica CPFL', valor: 145.20, categoria: 'Contas (Luz/Água)', data: getPastDateString(10), tipo_registro: 'imediato', status: 'pago' },
    { id: 't_seed_3', tipo: 'saida', descricao: 'Fornecedor de Bebidas AMBEV', valor: 350.00, categoria: 'Mercadoria / Estoque', data: getPastDateString(6), tipo_registro: 'imediato', status: 'pago' },
    { id: 't_seed_4', tipo: 'entrada', descricao: 'Vendas acumuladas fim de semana', valor: 1250.00, categoria: 'Vendas', data: getPastDateString(4), tipo_registro: 'imediato', status: 'pago', meio_pagamento: 'Pix' },
    { id: 't_seed_5', tipo: 'entrada', descricao: 'Serviço de buffet sob encomenda', valor: 650.00, categoria: 'Prestação de Serviço', data: getPastDateString(2), tipo_registro: 'imediato', status: 'pago', meio_pagamento: 'Cartão' },
    { id: 't_seed_6', tipo: 'saida', descricao: 'Compra de embalagens térmicas', valor: 75.00, categoria: 'Contas (Luz/Água)', data: getPastDateString(1), tipo_registro: 'imediato', status: 'pago' },
    // Accounts payable pending (vencimentos)
    { id: 't_seed_7', tipo: 'saida', descricao: 'Fornecedor de Doces Congelados', valor: 280.00, categoria: 'Mercadoria / Estoque', data: getPastDateString(0), tipo_registro: 'pagar', data_vencimento: getPastDateString(-5), status: 'pendente' },
    // Accounts receivable pending (duplicatas)
    { id: 't_seed_8', tipo: 'entrada', descricao: 'Festa Infantil - Doce Encomenda', valor: 450.00, categoria: 'Prestação de Serviço', data: getPastDateString(0), tipo_registro: 'receber', data_vencimento: getPastDateString(-3), status: 'pendente' }
  ];
};

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'pdv' | 'financeiro' | 'estoque' | 'relatorios' | 'precificacao' | 'profile'>('pdv');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem(`capitae_business_theme_${user.id}`) as 'dark' | 'light') || 'dark';
  });
  const [isPrivateMode, setIsPrivateMode] = useState(false);

  // Persist theme to localStorage
  useEffect(() => {
    localStorage.setItem(`capitae_business_theme_${user.id}`, theme);
  }, [theme, user.id]);

  // Core Data sets
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Subscription and 7-day Trial state
  const ADMIN_EMAILS = [
    'caiogabriel1995@gmail.com', 
    'josueamorim906@gmail.com', 
    'ruanvictordacostademedeiros@gmail.com', 
    'mvitor8585@gmail.com', 
    'karolgoncallo@gmail.com', 
    'cabrallohan74@gmail.com'
  ];
  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email) : false;

  const [isPremium, setIsPremium] = useState<boolean>(() => {
    if (user?.email && ADMIN_EMAILS.includes(user.email)) return true;
    return localStorage.getItem(`capitae_premium_${user.id}`) === 'true';
  });

  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [emailAtivacao, setEmailAtivacao] = useState('');
  const [ativando, setAtivando] = useState(false);
  const [ativacaoError, setAtivacaoError] = useState('');
  const [ativacaoSuccess, setAtivacaoSuccess] = useState(false);

  // Fallback signup date: use user.created_at or store current time as trial start
  const trialStartDate = (() => {
    const cached = localStorage.getItem(`capitae_trial_start_${user.id}`);
    if (cached) return new Date(cached);
    const start = user.created_at ? new Date(user.created_at) : new Date();
    localStorage.setItem(`capitae_trial_start_${user.id}`, start.toISOString());
    return start;
  })();

  const diffTime = Date.now() - trialStartDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, 7 - Math.floor(diffDays));
  const isTrialExpired = diffDays > 7 && !isPremium && !isAdmin;

  const handleActivatePremium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAtivacao.trim() || !emailAtivacao.includes('@')) {
      setAtivacaoError('Insira um e-mail de compra válido.');
      return;
    }

    setAtivando(true);
    setAtivacaoError('');

    // Simulate verification with KiwiFy
    setTimeout(async () => {
      try {
        // Safe update background in Profiles
        await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
      } catch (err) {
        console.log('Skip profiles table DB updates:', err);
      }

      setIsPremium(true);
      localStorage.setItem(`capitae_premium_${user.id}`, 'true');
      setAtivando(false);
      setAtivacaoSuccess(true);

      setTimeout(() => {
        setIsPremium(true);
        setAtivacaoSuccess(false);
        setShowActivateDialog(false);
      }, 2500);
    }, 1500);
  };

  // Modals
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTermsConsent, setShowTermsConsent] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deletingTransId, setDeletingTransId] = useState<string | null>(null);
  const [returnToStock, setReturnToStock] = useState<boolean>(true);

  // Load from local Cache scoped per user
  useEffect(() => {
    const loadCacheData = async () => {
      try {
        const prodKey = `capitae_business_products_${user.id}`;
        const transKey = `capitae_business_transactions_${user.id}`;
        const onboardingKey = `capitae_seen_onboarding_${user.id}`;

        let prodsLoaded = false;
        let transLoaded = false;

        let loadedProds: Produto[] = [];
        let loadedTrans: Transacao[] = [];

        // Products (Fast Local-First Load)
        const cachedProds = localStorage.getItem(prodKey);
        if (cachedProds) {
          try {
            loadedProds = JSON.parse(cachedProds);
            prodsLoaded = true;
          } catch (e) {}
        }

        // Transactions (Fast Local-First Load)
        const cachedTrans = localStorage.getItem(transKey);
        if (cachedTrans) {
          try {
            loadedTrans = JSON.parse(cachedTrans);
            transLoaded = true;
          } catch (e) {}
        }

        // Real-time Database Hydration Cloud Sync (Only for real registered accounts)
        if (user.id !== 'guest_user') {
          console.log('Dashboard: Fetching persistent cloud backup...');
          try {
            const { data: dbMemories, error: dbError } = await supabase
              .from('user_memories')
              .select('key, value')
              .eq('user_id', user.id)
              .in('key', ['business_products', 'business_transactions']);

            if (!dbError && dbMemories && dbMemories.length > 0) {
              const prodMem = dbMemories.find(m => m.key === 'business_products');
              if (prodMem && prodMem.value) {
                loadedProds = JSON.parse(prodMem.value);
                localStorage.setItem(prodKey, prodMem.value);
                prodsLoaded = true;
                console.log('Dashboard: Successfully synced products backup from cloud.');
              }

              const transMem = dbMemories.find(m => m.key === 'business_transactions');
              if (transMem && transMem.value) {
                loadedTrans = JSON.parse(transMem.value);
                localStorage.setItem(transKey, transMem.value);
                transLoaded = true;
                console.log('Dashboard: Successfully synced transactions backup from cloud.');
              }
            }
          } catch (cloudErr) {
            console.error('Dashboard: Error restoring cache from database:', cloudErr);
          }
        }

        // Migration or default seeding fallbacks (if data wasn't found in cache or DB)
        if (!prodsLoaded) {
          // If no products exist for this user, check if we have unsaved guest_user products to migrate
          const guestProdsStr = localStorage.getItem('capitae_business_products_guest_user');
          if (guestProdsStr && user.id !== 'guest_user') {
            loadedProds = JSON.parse(guestProdsStr);
            localStorage.setItem(prodKey, JSON.stringify(loadedProds));
            
            // Sync newly migrated products to the database
            supabase.from('user_memories').upsert([{
              user_id: user.id,
              key: 'business_products',
              value: JSON.stringify(loadedProds),
              updated_at: new Date().toISOString()
            }], { onConflict: 'user_id,key' }).then(() => {});
          } else {
            // For real logged in users, default to empty list, only seed for guest user
            loadedProds = user.id === 'guest_user' ? INITIAL_PRODUCTS : [];
            localStorage.setItem(prodKey, JSON.stringify(loadedProds));
          }
        }

        if (!transLoaded) {
          // If no transactions exist for this user, check if we have unsaved guest_user transactions to migrate
          const guestTransStr = localStorage.getItem('capitae_business_transactions_guest_user');
          if (guestTransStr && user.id !== 'guest_user') {
            loadedTrans = JSON.parse(guestTransStr);
            localStorage.setItem(transKey, JSON.stringify(loadedTrans));

            // Sync newly migrated transactions to the database
            supabase.from('user_memories').upsert([{
              user_id: user.id,
              key: 'business_transactions',
              value: JSON.stringify(loadedTrans),
              updated_at: new Date().toISOString()
            }], { onConflict: 'user_id,key' }).then(() => {});
          } else {
            // For real logged in users, default to empty list, only seed for guest user
            loadedTrans = user.id === 'guest_user' ? generateInitialTransactions() : [];
            localStorage.setItem(transKey, JSON.stringify(loadedTrans));
          }
        }

        // --- BACKGROUND COG PURCHASE COST BACKFILL ---
        // Loops through loaded products and makes sure any stocked items mapped to a purchase cost
        // have an corresponding auto expense paid trans, safely preventing duplicates
        let updatedTransList = [...loadedTrans];
        let hasNewTransactions = false;

        loadedProds.forEach(p => {
          const totalCustoCompra = (p.preco_custo || 0) * (p.quantidade || 0);
          if (totalCustoCompra > 0) {
            const hasExpense = updatedTransList.some(t => 
              t.tipo === 'saida' &&
              t.categoria === 'Mercadoria / Estoque' &&
              t.descricao.includes(`[Compra de Estoque] ${p.nome}`)
            );

            if (!hasExpense) {
              const newSaida: Transacao = {
                id: `t_backfill_${p.id}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
                tipo: 'saida',
                descricao: `[Compra de Estoque] ${p.nome} (${p.quantidade} un)`,
                valor: totalCustoCompra,
                categoria: 'Mercadoria / Estoque',
                data: new Date().toISOString().split('T')[0],
                tipo_registro: 'imediato',
                status: 'pago'
              };
              updatedTransList.unshift(newSaida);
              hasNewTransactions = true;
            }
          }
        });

        // Set stable state models
        setProdutos(loadedProds);
        if (hasNewTransactions) {
          setTransacoes(updatedTransList);
          localStorage.setItem(transKey, JSON.stringify(updatedTransList));
          if (user.id !== 'guest_user') {
            await supabase.from('user_memories').upsert([{
              user_id: user.id,
              key: 'business_transactions',
              value: JSON.stringify(updatedTransList),
              updated_at: new Date().toISOString()
            }], { onConflict: 'user_id,key' });
          }
        } else {
          setTransacoes(loadedTrans);
        }

        // Setup Onboarding & terms display rules
        const termsKey = `capitae_accepted_terms_${user.id}`;
        const seenOnboarding = localStorage.getItem(onboardingKey) === 'true';
        const acceptedTerms = localStorage.getItem(termsKey) === 'true';
        
        let finalShowOnboarding = !seenOnboarding;
        let finalShowTermsConsent = !acceptedTerms;

        // Supabase Profile load
        if (user.id === 'guest_user') {
          // Look up if they modified their profile locally
          const cachedLocalProf = localStorage.getItem('capitae_profile_guest_user');
          const finalProfile = cachedLocalProf ? JSON.parse(cachedLocalProf) : {
            display_name: 'Usuário Local',
            avatar_url: '',
            bio: 'Minha barbearia, lanchonete ou confecção local sob controle.',
            is_pro: true,
            has_seen_onboarding: true,
            accepted_terms: true
          };
          
          setProfile(finalProfile);
          setShowTermsConsent(false);
          setShowOnboarding(false);
          setLoading(false);
          return;
        }

        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const userEmailLower = user.email ? user.email.toLowerCase() : '';
        const ADMIN_EMAILS = [
          'caiogabriel1995@gmail.com', 
          'josueamorim906@gmail.com', 
          'ruanvictordacostademedeiros@gmail.com', 
          'mvitor8585@gmail.com', 
          'karolgoncallo@gmail.com', 
          'cabrallohan74@gmail.com'
        ];
        const isUserAdmin = ADMIN_EMAILS.includes(userEmailLower);

        if (dbProfile) {
          // Sync missing email/is_premium for admins
          const needsEmailUpdate = !dbProfile.email && user.email;
          const needsAdminPromoValue = isUserAdmin && (!dbProfile.is_premium || !dbProfile.is_pro);
          
          if (needsEmailUpdate || needsAdminPromoValue) {
            const updates: any = {};
            if (needsEmailUpdate) updates.email = user.email;
            if (needsAdminPromoValue) {
              updates.is_premium = true;
              updates.is_pro = true;
            }
            supabase.from('profiles').update(updates).eq('id', user.id).then();
            
            if (needsAdminPromoValue) {
              dbProfile.is_premium = true;
              dbProfile.is_pro = true;
            }
          }

          setProfile(dbProfile);
          if (dbProfile.is_premium || isUserAdmin) {
            setIsPremium(true);
            localStorage.setItem(`capitae_premium_${user.id}`, 'true');
          } else {
            setIsPremium(false);
            localStorage.setItem(`capitae_premium_${user.id}`, 'false');
          }
          
          // If the profile says they have seen onboarding, don't show it even if localStorage was empty
          if (dbProfile.has_seen_onboarding) {
            finalShowOnboarding = false;
            localStorage.setItem(onboardingKey, 'true');
          }
          
          // Check if accepted terms in db
          if (dbProfile.accepted_terms) {
            finalShowTermsConsent = false;
            localStorage.setItem(termsKey, 'true');
          } else {
            // Only show terms if not accepted locally either
            finalShowTermsConsent = !acceptedTerms;
          }
        } else {
          // Fallback if profiles table row is missing (first login / brand new user signup)
          // Trust localStorage to stay local-secure if already completed
          finalShowTermsConsent = !acceptedTerms;
          finalShowOnboarding = !seenOnboarding;

          // Try to upsert/seed default profile in background so the row is ready for future updates
          try {
            const initialProf = {
              id: user.id,
              email: user.email,
              display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Usuário',
              avatar_url: user.user_metadata?.avatar_url || '',
              bio: 'Minhas finanças sob controle.',
              xp: 0,
              level: 'Iniciante',
              coins: 10,
              streak: 1,
              monthly_income: 0,
              payday: 5,
              pay_frequency: 'mensal',
              pay_days: '',
              fixed_costs: 0,
              perc_essentials: 50,
              perc_leisure: 30,
              perc_investment: 20,
              has_seen_onboarding: seenOnboarding,
              accepted_terms: acceptedTerms,
              is_premium: isUserAdmin,
              is_pro: isUserAdmin,
              updated_at: new Date().toISOString()
            };
            
            const { error: upsertErr } = await supabase
              .from('profiles')
              .upsert(initialProf, { onConflict: 'id' });
              
            if (!upsertErr) {
              setProfile(initialProf);
              if (isUserAdmin) {
                setIsPremium(true);
                localStorage.setItem(`capitae_premium_${user.id}`, 'true');
              }
            }
          } catch (e) {
            console.error('Error seeding default profile row:', e);
          }
        }

        setShowOnboarding(finalShowOnboarding);
        setShowTermsConsent(finalShowTermsConsent);
      } catch (err) {
        console.error('Dashboard cache loader error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCacheData();
  }, [user.id]);

  // Sync utilities
  const saveProductsToCache = (updatedList: Produto[]) => {
    setProdutos(updatedList);
    localStorage.setItem(`capitae_business_products_${user.id}`, JSON.stringify(updatedList));

    if (user.id !== 'guest_user') {
      supabase.from('user_memories').upsert([{
        user_id: user.id,
        key: 'business_products',
        value: JSON.stringify(updatedList),
        updated_at: new Date().toISOString()
      }], { onConflict: 'user_id,key' }).then(({ error }) => {
        if (error) console.error('Dashboard: Error backing up products to database:', error);
      });
    }
  };

  const saveTransactionsToCache = (updatedList: Transacao[]) => {
    setTransacoes(updatedList);
    localStorage.setItem(`capitae_business_transactions_${user.id}`, JSON.stringify(updatedList));

    if (user.id !== 'guest_user') {
      supabase.from('user_memories').upsert([{
        user_id: user.id,
        key: 'business_transactions',
        value: JSON.stringify(updatedList),
        updated_at: new Date().toISOString()
      }], { onConflict: 'user_id,key' }).then(({ error }) => {
        if (error) console.error('Dashboard: Error backing up transactions to database:', error);
      });
    }
  };

  // State operations handlers
  const handleAddTransacao = (newT: Omit<Transacao, 'id'> | Omit<Transacao, 'id'>[]) => {
    const items = Array.isArray(newT) ? newT : [newT];
    const itemsWithId = items.map(t => ({
      ...t,
      id: `t_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`
    }));
    const updated = [...itemsWithId, ...transacoes];
    saveTransactionsToCache(updated);
  };

  const handleUpdateTransacaoStatus = (id: string, nuevoStatus: 'pago' | 'pendente') => {
    const updated = transacoes.map(t => 
      t.id === id ? { ...t, status: nuevoStatus, data: new Date().toISOString().split('T')[0] } : t
    );
    saveTransactionsToCache(updated);
  };

  const handleDeleteTransacao = (id: string) => {
    setDeletingTransId(id);
    setReturnToStock(true);
  };

  const executeDeleteTransacao = () => {
    if (!deletingTransId) return;
    const trans = transacoes.find(t => t.id === deletingTransId);

    // If restocking opted in and product exists in active stock collection
    if (trans && returnToStock && trans.tipo === 'entrada' && trans.itens_venda && trans.itens_venda.length > 0) {
      const updatedProducts = produtos.map(p => {
        const itemVendido = trans.itens_venda?.find(item => item.produto_id === p.id);
        if (itemVendido) {
          return {
            ...p,
            quantidade: p.quantidade + itemVendido.qtd
          };
        }
        return p;
      });
      saveProductsToCache(updatedProducts);
    }

    const updated = transacoes.filter(t => t.id !== deletingTransId);
    saveTransactionsToCache(updated);
    setDeletingTransId(null);
  };

  const handleEditTransacao = (updatedT: Transacao) => {
    const updated = transacoes.map(t => t.id === updatedT.id ? updatedT : t);
    saveTransactionsToCache(updated);
  };

  const handleAddProduto = (newP: Omit<Produto, 'id'>) => {
    const pWithId: Produto = {
      ...newP,
      id: `p_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`
    };
    const updated = [...produtos, pWithId];
    saveProductsToCache(updated);

    // Auto-generate purchase expense (saída) transaction if purchase cost is positive
    const totalCustoCompra = (newP.preco_custo || 0) * (newP.quantidade || 0);
    if (totalCustoCompra > 0) {
      const autoTrans: Omit<Transacao, 'id'> = {
        tipo: 'saida',
        descricao: `[Compra de Estoque] ${newP.nome} (${newP.quantidade} un)`,
        valor: totalCustoCompra,
        categoria: 'Mercadoria / Estoque',
        data: new Date().toISOString().split('T')[0],
        tipo_registro: 'imediato',
        status: 'pago'
      };
      handleAddTransacao(autoTrans);
    }
  };

  const handleUpdateProduto = (updatedP: Produto) => {
    const updated = produtos.map(p => p.id === updatedP.id ? updatedP : p);
    saveProductsToCache(updated);
  };

  const handleUpdateProdutoQuantidade = (id: string, novaQuantidade: number) => {
    const updated = produtos.map(p => 
      p.id === id ? { ...p, quantidade: Math.max(0, novaQuantidade) } : p
    );
    saveProductsToCache(updated);
  };

  const handleDeleteProduto = (id: string) => {
    const updated = produtos.filter(p => p.id !== id);
    saveProductsToCache(updated);
  };

  // Onboarding completors
  const handleCompleteOnboarding = async () => {
    setShowOnboarding(false);
    localStorage.setItem(`capitae_seen_onboarding_${user.id}`, 'true');
    try {
      await supabase.from('profiles').upsert({ 
        id: user.id, 
        has_seen_onboarding: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (e) {
      console.error('Error saving onboarding state:', e);
    }
  };

  const handleCompleteTermsConsent = () => {
    setShowTermsConsent(false);
    localStorage.setItem(`capitae_accepted_terms_${user.id}`, 'true');
    setProfile((prev: any) => prev ? { ...prev, accepted_terms: true } : prev);
  };

  const handleSignOut = () => {
    setShowLogoutConfirm(true);
    setIsMenuOpen(false); // Close menu when showing confirm
  };

  const executeSignOut = async () => {
    setShowLogoutConfirm(false);
    if (user.id === 'guest_user') {
      localStorage.removeItem('capitae_is_guest');
      window.location.reload();
      return;
    }
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      console.error('Error signing out:', e);
      window.location.reload();
    }
  };

  // Main UI components mapper
  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'pdv':
        return (
          <PDV 
            produtos={produtos}
            onAddTransacao={handleAddTransacao}
            onUpdateProdutoQuantidade={handleUpdateProdutoQuantidade}
            isPrivateMode={isPrivateMode}
            onAddProduto={handleAddProduto}
          />
        );
      case 'financeiro':
        return (
          <Financeiro 
            transacoes={transacoes}
            onAddTransacao={handleAddTransacao}
            onUpdateTransacaoStatus={handleUpdateTransacaoStatus}
            onDeleteTransacao={handleDeleteTransacao}
            onEditTransacao={handleEditTransacao}
            isPrivateMode={isPrivateMode}
          />
        );
      case 'estoque':
        return (
          <Estoque 
            produtos={produtos}
            onAddProduto={handleAddProduto}
            onUpdateProduto={handleUpdateProduto}
            onDeleteProduto={handleDeleteProduto}
            isPrivateMode={isPrivateMode}
          />
        );
      case 'relatorios':
        return (
          <Relatorios 
            transacoes={transacoes}
            isPrivateMode={isPrivateMode}
          />
        );
      case 'precificacao':
        return (
          <Precificacao 
            isPrivateMode={isPrivateMode}
          />
        );
      case 'profile':
        return (
          <Profile 
            user={user} 
            isPro={isPremium}
            onUpdateProfile={(updatedData) => setProfile((prev: any) => prev ? { ...prev, ...updatedData } : updatedData)}
          />
        );
      default:
        return null;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-background text-foreground pb-24 ${theme === 'light' ? 'light' : ''}`}>
      {/* Header */}
      <header className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] border-b border-foreground/5 bg-background/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between relative">
          
          {/* Left part: Menu (3 lines) button unified with Profile icon */}
          <div className="flex items-center">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-foreground/5 rounded-full border border-foreground/10 transition-all text-muted"
              title="Abrir Menu / Perfil"
            >
              <Menu className="w-4.5 h-4.5" />
              <div className="w-5.5 h-5.5 bg-secondary rounded-full overflow-hidden border border-foreground/10 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Perfil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-3 h-3 text-muted" />
                )}
              </div>
            </button>
          </div>

          {/* Center part: Centered Title and Subtitle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-white dark:text-white font-sans whitespace-nowrap drop-shadow-[0_0_12px_rgba(0,200,83,0.1)]">
              Capitae Business
            </h2>
            <p className="text-[7.5px] sm:text-[8.5px] text-primary font-black uppercase tracking-[0.16em] mt-0.5 whitespace-nowrap">
              Gestor de Negócios
            </p>
          </div>

          {/* Right part: Theme toggle + Notification Center */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-foreground/5 rounded-xl transition-colors text-muted"
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <NotificationCenter 
              userId={user.id} 
              theme={theme}
              onRedirectToTab={(tab) => {
                if ((tab as string) === 'expenses' || tab === 'bills') setActiveTab('financeiro');
              }} 
            />
          </div>

        </div>
      </header>

      {/* Main Screen Container with entry transition effects */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Banner de Teste Ativo */}
        {!isPremium && !isTrialExpired && (
          <div className="mb-6 p-4 rounded-3xl bg-[#00E676]/10 border border-[#00E676]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00E676]/10 flex items-center justify-center text-primary shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <p className="text-white text-sm font-black tracking-tight flex items-center gap-1.5 leading-none">
                  Período de Experiência Ativo 
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded">Grátis</span>
                </p>
                <p className="text-[11px] sm:text-xs text-muted leading-relaxed">
                  Faltam <span className="text-[#00E676] font-extrabold">{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</span> de teste gratuito. Assine o plano completo do Capitae para manter seu fluxo ativo antes do prazo expirar.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <button
                onClick={() => setShowActivateDialog(true)}
                className="px-3.5 py-2 hover:bg-foreground/5 text-xs text-stone-300 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Já Sou Assinante
              </button>
              <a 
                href="https://pay.kiwify.com.br/aNA7SJE"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-primary text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-opacity-95 transition-all text-center flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,230,118,0.25)] active:scale-98"
              >
                Ativar Capitae Business
              </a>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {renderActiveScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-72 bg-secondary border-r border-foreground/5 z-[70] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] flex justify-between items-center shrink-0">
                <h3 className="text-xl font-black text-primary">Capitae Business</h3>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-foreground/5 rounded-xl">
                  <X className="w-6 h-6 text-muted" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-10 overscroll-contain">
                <div className="space-y-3">
                  {[
                    { id: 'pdv', label: 'Caixa', icon: <ShoppingCart /> },
                    { id: 'financeiro', label: 'Fluxo de Caixa', icon: <TrendingUp /> },
                    { id: 'estoque', label: 'Controle de Estoque', icon: <Package /> },
                    { id: 'relatorios', label: 'Painel de Relatórios', icon: <BarChart3 /> },
                    { id: 'precificacao', label: 'Precificação & Lucro', icon: <Calculator /> },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-4 p-3.5 rounded-2xl font-black transition-all text-sm border ${
                        activeTab === item.id 
                          ? 'bg-[#002f1a]/80 text-[#00E676] border-[#00E676]/20 shadow-[inset_0_1px_1px_rgba(0,230,118,0.15)] shadow-md' 
                          : 'text-muted hover:text-white hover:bg-foreground/5 border-transparent'
                      }`}
                    >
                      {React.cloneElement(item.icon as React.ReactElement<any>, { className: `w-5 h-5 ${activeTab === item.id ? 'text-[#00E676] filter drop-shadow-[0_0_6px_rgba(0,230,118,0.4)]' : ''}` })}
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-foreground/5">
                  <button 
                    onClick={() => {
                      setActiveTab('profile');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 p-3.5 rounded-2xl font-black transition-all text-sm border ${
                      activeTab === 'profile' 
                        ? 'bg-[#002f1a]/80 text-[#00E676] border-[#00E676]/20 shadow-[inset_0_1px_1px_rgba(0,230,118,0.15)] shadow-md' 
                        : 'text-muted hover:text-white hover:bg-foreground/5 border-transparent'
                    }`}
                  >
                    <UserIcon className="w-5 h-5" />
                    Meu Perfil
                  </button>

                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl font-bold text-red-500 hover:bg-red-500/10 transition-all text-sm"
                  >
                    <LogOut className="w-5 h-5" />
                    Sair
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Re-aligned Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-foreground/5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex justify-around items-center z-50">
        <NavButton active={activeTab === 'pdv'} onClick={() => setActiveTab('pdv')} icon={<ShoppingCart />} label="Caixa" />
        <NavButton active={activeTab === 'financeiro'} onClick={() => setActiveTab('financeiro')} icon={<TrendingUp />} label="Financeiro" />
        <NavButton active={activeTab === 'estoque'} onClick={() => setActiveTab('estoque')} icon={<Package />} label="Estoque" />
        <NavButton active={activeTab === 'relatorios'} onClick={() => setActiveTab('relatorios')} icon={<BarChart3 />} label="Relatórios" />
        <NavButton active={activeTab === 'precificacao'} onClick={() => setActiveTab('precificacao')} icon={<Calculator />} label="Precificar" />
      </nav>

      {/* Core overlay Modals */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={handleCompleteOnboarding} 
      />
      
      <TermsConsentModal 
        isOpen={showTermsConsent}
        userId={user.id}
        userEmail={user.email || ''}
        onAcceptComplete={handleCompleteTermsConsent}
      />

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-background/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-secondary border border-foreground/10 p-6 rounded-[32px] overflow-hidden shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-400/10 rounded-2xl flex items-center justify-center mx-auto text-red-500">
                <LogOut className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Sair da Conta</h3>
                <p className="text-sm text-muted">
                  {user.id === 'guest_user'
                    ? 'Deseja realmente sair do modo visitante? Seus dados continuarão salvos localmente.'
                    : 'Tem certeza de que deseja sair de sua conta?'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3.5 bg-foreground/5 hover:bg-foreground/10 text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeSignOut}
                  className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                >
                  Sair
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deletingTransId && (() => {
          const transToDel = transacoes.find(t => t.id === deletingTransId);
          // Only show stock return option for entries with items_venda
          const hasStockReturnOption = !!(transToDel && transToDel.tipo === 'entrada' && transToDel.itens_venda && transToDel.itens_venda.length > 0);

          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeletingTransId(null)}
                className="absolute inset-0 bg-background/85 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-secondary border border-foreground/10 p-6 rounded-[32px] overflow-hidden shadow-2xl text-center space-y-6"
              >
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500 animate-pulse">
                  <Trash2 className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Confirmar Exclusão</h3>
                  <p className="text-sm text-muted">
                    Tem certeza de que deseja excluir este lançamento financeiro de forma permanente?
                  </p>
                </div>

                {transToDel && (
                  <div className="text-left bg-background/40 p-4 rounded-2xl border border-foreground/5 space-y-1">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-widest block">Lançamento</span>
                    <p className="text-sm text-white font-bold truncate">{transToDel.descricao}</p>
                    <p className="text-xs text-[#00C853] font-bold">
                      Valor: R$ {transToDel.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {hasStockReturnOption ? (
                  <div className="bg-background/40 hover:bg-background/60 p-4 rounded-2xl border border-foreground/5 flex items-start gap-3 text-left transition-colors">
                    <div className="flex items-center h-5 mt-0.5">
                      <input
                        type="checkbox"
                        id="returnToStockCheckbox"
                        checked={returnToStock}
                        onChange={(e) => setReturnToStock(e.target.checked)}
                        className="w-5 h-5 accent-primary cursor-pointer rounded border-foreground/20 bg-background"
                      />
                    </div>
                    <label htmlFor="returnToStockCheckbox" className="text-xs text-white leading-snug cursor-pointer select-none">
                      <span className="font-extrabold block text-primary">Devolver produtos ao estoque?</span>
                      Os itens desta venda voltarão para a prateleira ativa de estoque.
                    </label>
                  </div>
                ) : (
                  transToDel && transToDel.categoria === 'Vendas (PDV)' && (
                    <div className="bg-foreground/5 p-3 rounded-2xl border border-foreground/5 text-center">
                      <p className="text-[11px] text-muted italic">
                        Venda rápida realizada diretamente sem estoque registrado. Nenhum item retornará ao estoque.
                      </p>
                    </div>
                  )
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingTransId(null)}
                    className="flex-1 py-3.5 bg-foreground/5 hover:bg-foreground/10 text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={executeDeleteTransacao}
                    className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Diálogo de Ativação Manual (KiwiFy) */}
      <AnimatePresence>
        {showActivateDialog && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!ativando) setShowActivateDialog(false); }}
              className="absolute inset-0 bg-background/85 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-secondary border border-foreground/10 p-6 rounded-[32px] shadow-2xl space-y-5 text-center z-10"
            >
              <button 
                onClick={() => setShowActivateDialog(false)}
                disabled={ativando}
                className="absolute top-4 right-4 p-1.5 hover:bg-foreground/5 rounded-full text-muted hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto animate-bounce">
                <Check className="w-6 h-6 font-black" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">Ativação Capitae Business</h3>
                <p className="text-xs text-muted mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Insira o seu e-mail cadastrado na compra da Kiwify para liberarmos o seu acesso instantaneamente.
                </p>
              </div>

              {ativacaoSuccess ? (
                <div className="p-4 bg-[#00E676]/10 border border-[#00E676]/20 rounded-2xl flex flex-col items-center justify-center gap-1">
                  <span className="text-[#00E676] text-xs font-black uppercase tracking-wider">Sucesso!</span>
                  <p className="text-[11px] text-[#00E676] font-medium leading-normal">Seu Capitae Business foi ativado com sucesso. Boas Vendas!</p>
                </div>
              ) : (
                <form onSubmit={handleActivatePremium} className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted font-bold uppercase tracking-wider block">E-mail da Compra</label>
                    <input 
                      type="email"
                      required
                      placeholder="seuemail@exemplo.com"
                      value={emailAtivacao}
                      onChange={(e) => setEmailAtivacao(e.target.value)}
                      disabled={ativando}
                      className="w-full bg-background border border-foreground/10 focus:border-primary px-4 py-3 text-sm text-white rounded-xl placeholder-stone-600 outline-none transition-colors"
                    />
                  </div>

                  {ativacaoError && (
                    <p className="text-xs text-red-400 font-bold text-center">{ativacaoError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowActivateDialog(false)}
                      disabled={ativando}
                      className="flex-1 py-3 bg-foreground/5 hover:bg-foreground/10 text-stone-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={ativando}
                      className="flex-1 py-3 bg-primary text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-opacity-95 transition-all shadow-md shadow-[#00E676]/10 flex items-center justify-center gap-1.5"
                    >
                      {ativando ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Validando...</span>
                        </>
                      ) : (
                        <span>Ativar Premium</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bloqueador de Trial Expirado */}
      {isTrialExpired && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-secondary border border-foreground/10 rounded-[32px] p-8 text-center shadow-2xl animate-scaleIn my-auto outline-none">
            
            <div className="w-16 h-16 bg-[#00E676]/10 rounded-2xl border border-[#00E676]/25 flex items-center justify-center mx-auto mb-6 relative">
              <Clock className="w-8 h-8 text-primary animate-pulse" />
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase tracking-wider rounded-full">Expirado</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">Sua Avaliação Grátis Terminou!</h1>
            <p className="text-xs sm:text-sm text-stone-400 mt-2 max-w-md mx-auto leading-relaxed">
              O seu período de degustação de 7 dias do Capitae Business chegou ao fim. Assine o plano mensal completo da sua nova frente de gestão de negócios para manter todas as suas operações e decolar suas margens.
            </p>

            <div className="my-8 max-w-sm mx-auto text-left gap-3.5 flex flex-col bg-background/40 border border-[#00C853]/10 p-5 rounded-2xl">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-[#00C853]/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Check className="w-3 h-3 font-black" />
                </div>
                <p className="text-xs text-stone-200 font-medium">PDV Frente de Caixa e Venda Avulsa Rápida</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-[#00C853]/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Check className="w-3 h-3 font-black" />
                </div>
                <p className="text-xs text-stone-200 font-medium">Organizador de Fluxo de Caixa Integrado</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-[#00C853]/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Check className="w-3 h-3 font-black" />
                </div>
                <p className="text-xs text-stone-200 font-medium">Controle de Estoque Avançado com Alerta de Itens Baixos</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md bg-[#00C853]/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Check className="w-3 h-3 font-black" />
                </div>
                <p className="text-xs text-stone-200 font-medium">Histórico de Relatórios de Lucro e Eficiência Líquida</p>
              </div>
            </div>

            <div className="space-y-4">
              <a 
                href="https://pay.kiwify.com.br/aNA7SJE"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-4 bg-primary text-slate-950 font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-opacity-95 transition-all text-center flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(0,230,118,0.3)] active:scale-99"
              >
                Garantir Licença Capitae Business
              </a>

              <div className="pt-2 flex flex-col gap-2 sm:flex-row justify-center items-center">
                <button 
                  onClick={() => setShowActivateDialog(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-[#0a1e12] border border-[#00E676]/25 hover:bg-[#0f2c1b] text-primary font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Já realizei o pagamento / Ativar
                </button>
                
                <button
                  onClick={handleSignOut}
                  className="text-xs text-stone-400 hover:text-white underline cursor-pointer mt-2 sm:mt-0 px-4 py-2"
                >
                  Sair da Conta
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all relative ${active ? 'text-primary' : 'text-muted hover:text-white'}`}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { 
        className: `w-5.5 h-5.5 transition-transform hover:scale-105 ${active ? 'drop-shadow-[0_0_8px_rgba(0,200,83,0.55)] filter' : ''}` 
      })}
      <span className="text-[7.5px] sm:text-[8px] font-black uppercase tracking-[0.08em] mt-0.5">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-glow-indicator"
          className="absolute -bottom-2 w-3.5 h-1 bg-primary rounded-full blur-[1px]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  );
}

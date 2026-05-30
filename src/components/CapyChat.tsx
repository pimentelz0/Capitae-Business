import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, X, Loader2, Sparkles, Plus, MessageSquare as MessageIcon, History, ChevronLeft, Trash2 } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { getSafeUser, supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';

import { User as SupabaseUser } from '@supabase/supabase-js';

interface Message {
  id?: string;
  role: 'user' | 'capy';
  content: string;
  isAction?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface CapyChatProps {
  user: SupabaseUser;
  expenses: any[];
  goals: any[];
  bills: any[];
  profile?: any;
  isPro?: boolean;
  onActionComplete?: () => void;
  onUpgrade?: () => void;
  onClose?: () => void;
}

export default function CapyChat({ user, expenses, goals, bills, profile, isPro: isProProp, onActionComplete, onUpgrade, onClose }: CapyChatProps) {
  const isPro = true; // Set to true to unlock full capability and remove any limitations or upgrade prompts
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userMemories, setUserMemories] = useState<any[]>([]);
  const [usageCount, setUsageCount] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [minuteCount, setMinuteCount] = useState(0);
  const [isDailyLimitReached, setIsDailyLimitReached] = useState(false);
  const [isMonthlyLimitReached, setIsMonthlyLimitReached] = useState(false);
  const [isMinuteLimitReached, setIsMinuteLimitReached] = useState(false);
  const [hasUnlimitedItem, setHasUnlimitedItem] = useState(false);
  const skipNextFetch = useRef(false);
  const USAGE_LIMIT_PER_MINUTE = 10;
  const DAILY_USAGE_LIMIT = 9999; // Only enforce monthly limit of 10 messages
  const MONTHLY_LIMIT = 10; // Only 10 messages per month for free/non-pro users
  const messageTimestamps = useRef<number[]>([]);

  const proactiveSent = useRef(false);

  useEffect(() => {
    fetchSessions().catch(err => console.error('RicoChat: Error in fetchSessions:', err));
    fetchMemories().catch(err => console.error('RicoChat: Error in fetchMemories:', err));
    fetchUsage().catch(err => console.error('RicoChat: Error in fetchUsage:', err));
    fetchMonthlyUsage().catch(err => console.error('RicoChat: Error in fetchMonthlyUsage:', err));

    // Proactive Capy for Pro users
    if (isPro && !proactiveSent.current && expenses.length > 0 && profile) {
      const now = new Date();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthProgress = dayOfMonth / daysInMonth;

      // Calculate spending by category for current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthExpenses = expenses.filter(e => new Date(e.data) >= startOfMonth && e.valor > 0);
      
      const categorySpending = currentMonthExpenses.reduce((acc: any, curr) => {
        acc[curr.categoria] = (acc[curr.categoria] || 0) + curr.valor;
        return acc;
      }, {});

      const budget = {
        'Essenciais': (profile.monthly_income || 0) * (profile.perc_essentials || 50) / 100,
        'Lazer': (profile.monthly_income || 0) * (profile.perc_leisure || 30) / 100,
        'Investir': (profile.monthly_income || 0) * (profile.perc_investment || 20) / 100
      };

      let alertMsg = '';
      for (const [cat, spent] of Object.entries(categorySpending)) {
        const limit = (budget as any)[cat];
        if (limit && (spent as number) > limit * 0.8) {
          const perc = Math.round(((spent as number) / limit) * 100);
          alertMsg = `Ei! Notei que você já gastou ${perc}% do seu orçamento de ${cat} e ainda estamos no dia ${dayOfMonth}. Que tal dar uma segurada para fechar o mês no azul? 🚀`;
          break;
        }
      }

      if (alertMsg) {
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'capy', content: alertMsg }]);
          proactiveSent.current = true;
        }, 1500);
      }
    }

    // Update minute usage count every 5 seconds
    const interval = setInterval(() => {
      updateMinuteCount();
    }, 5000);
    return () => clearInterval(interval);
  }, [isPro, expenses, profile]);

  const updateMinuteCount = () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    messageTimestamps.current = messageTimestamps.current.filter(ts => ts > oneMinuteAgo);
    setMinuteCount(messageTimestamps.current.length);
    
    if (messageTimestamps.current.length >= USAGE_LIMIT_PER_MINUTE) {
      setIsMinuteLimitReached(true);
    } else {
      setIsMinuteLimitReached(false);
    }

    // Also refresh daily limit check
    if (!isPro) {
      fetchUsage().catch(err => console.error('RicoChat: Error in updateMinuteCount daily check:', err));
    }
  };

  const fetchUsage = async () => {
    try {
      // Check for unlimited item in inventory
      const { data: inventory, error: invError } = await supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', user.id)
        .eq('item_id', 'capy_unlimited')
        .maybeSingle();

      if (invError) {
        console.warn('RicoChat: Erro ao verificar inventário:', invError.message);
      }

      const unlimited = !!inventory;
      setHasUnlimitedItem(unlimited);

      // Pro users or users with the item have no daily limit
      if (unlimited || isPro) {
        setIsDailyLimitReached(false);
        return { count: 0, unlimited: true };
      }

      // Track daily usage in the DB
      const today = new Date().toLocaleDateString('en-CA');
      const { data, error: usageError } = await supabase
        .from('user_ai_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();
      
      if (usageError) {
        console.error('RicoChat: Erro ao buscar uso diário:', usageError.message);
      }

      if (data) {
        setUsageCount(data.count);
        if (data.count >= DAILY_USAGE_LIMIT) {
          setIsDailyLimitReached(true);
        } else {
          setIsDailyLimitReached(false);
        }
        return { count: data.count, unlimited: false };
      } else {
        setUsageCount(0);
        setIsDailyLimitReached(false);
        return { count: 0, unlimited: false };
      }
    } catch (err) {
      console.error('RicoChat: Erro fatal no fetchUsage:', err);
      return { count: 0, unlimited: false };
    }
  };

  const fetchMonthlyUsage = async (): Promise<number> => {
    try {
      // Check for unlimited item in inventory
      const { data: inventory } = await supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', user.id)
        .eq('item_id', 'capy_unlimited')
        .maybeSingle();

      const unlimited = !!inventory;
      if (unlimited || isPro) {
        setIsMonthlyLimitReached(false);
        setMonthlyCount(0);
        return 0;
      }

      const { data: userSessions, error: sessError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', user.id);

      if (sessError) throw sessError;

      if (!userSessions || userSessions.length === 0) {
        setMonthlyCount(0);
        setIsMonthlyLimitReached(false);
        return 0;
      }

      const sessionIds = userSessions.map(s => s.id);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count, error: msgError } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds)
        .eq('role', 'user')
        .gte('created_at', startOfMonth);

      if (msgError) throw msgError;

      const totalSent = count || 0;
      setMonthlyCount(totalSent);

      if (totalSent >= MONTHLY_LIMIT) {
        setIsMonthlyLimitReached(true);
      } else {
        setIsMonthlyLimitReached(false);
      }

      return totalSent;
    } catch (err) {
      console.error('CapyChat: Erro ao buscar uso mensal:', err);
      return 0;
    }
  };

  const incrementUsage = async () => {
    // Pro users or users with the item don't need to increment usage for limit purposes,
    // but we can still track it if we want. For now, let's skip to save DB calls.
    if (isPro || hasUnlimitedItem) return;

    try {
      const today = new Date().toLocaleDateString('en-CA');
      
      const { data: currentData } = await supabase
        .from('user_ai_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();

      const newCount = (currentData?.count || 0) + 1;

      await supabase
        .from('user_ai_usage')
        .upsert({
          user_id: user.id,
          usage_date: today,
          count: newCount
        }, { onConflict: 'user_id,usage_date' });

      await fetchUsage(); 
    } catch (err) {
      console.error('RicoChat: Erro ao incrementar uso:', err);
    }
  };

  const checkMinuteLimit = () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    messageTimestamps.current = messageTimestamps.current.filter(ts => ts > oneMinuteAgo);
    setMinuteCount(messageTimestamps.current.length);
    
    if (messageTimestamps.current.length >= USAGE_LIMIT_PER_MINUTE) {
      setIsMinuteLimitReached(true);
      return false;
    }
    
    setIsMinuteLimitReached(false);
    return true;
  };

  useEffect(() => {
    if (currentSessionId) {
      if (skipNextFetch.current) {
        skipNextFetch.current = false;
        return;
      }
      fetchMessages(currentSessionId).catch(err => console.error('CapyChat: Error in fetchMessages:', err));
    } else {
      setMessages([{ role: 'capy', content: 'Olá! Sou o Capy, seu assistente do Capitae. Como posso te ajudar a organizar suas finanças hoje?' }]);
    }
  }, [currentSessionId]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase.from('chat_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setSessions(data);
    } catch (err) {
      console.error('CapyChat: Error fetching sessions:', err);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
      if (error) throw error;
      
      if (data && data.length > 0) {
        setMessages(data.map(m => ({ id: m.id, role: m.role as 'user' | 'capy', content: m.content })));
      } else {
        setMessages([{ role: 'capy', content: 'Olá novamente! Vamos continuar de onde paramos ou quer falar sobre algo novo?' }]);
      }
    } catch (err) {
      console.error('CapyChat: Error fetching messages:', err);
    }
  };

  const fetchMemories = async () => {
    try {
      const { data, error } = await supabase.from('user_memories').select('*').eq('user_id', user.id);
      if (error) throw error;
      if (data) setUserMemories(data);
    } catch (err) {
      console.error('RicoChat: Error fetching memories:', err);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // confirm() is blocked in iframes, so we'll just delete it to make it "functional"
    // as per user request, or we could implement a custom modal.
    
    try {
      const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([{ role: 'capy', content: 'Olá! Sou o Capy, seu assistente do Capitae. Como posso te ajudar a organizar suas finanças hoje?' }]);
      }
    } catch (err) {
      console.error('Erro ao excluir sessão:', err);
    }
  };

  const createNewSession = async () => {
    try {
      const { data, error } = await supabase.from('chat_sessions').insert([{
        user_id: user.id,
        title: `Conversa ${new Date().toLocaleDateString('pt-BR')}`
      }]).select().single();

      if (error) throw error;

      if (data) {
        setSessions([data, ...sessions]);
        setCurrentSessionId(data.id);
        setShowSidebar(false);
      }
    } catch (err) {
      console.error('RicoChat: Error creating new session:', err);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const addExpenseTool: FunctionDeclaration = {
    name: "add_expense",
    description: "Registra um novo gasto/despesa REAL (já realizado) para o usuário.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        valor: { type: Type.NUMBER, description: "O valor da despesa (ex: 35.50)" },
        categoria: { type: Type.STRING, description: "A categoria (Alimentação, Transporte, Lazer, Saúde, Educação, Outros)" },
        data: { type: Type.STRING, description: "A data no formato YYYY-MM-DD. Se não informada, use a data de hoje." },
        descricao: { type: Type.STRING, description: "Uma breve descrição do gasto." }
      },
      required: ["valor", "categoria"]
    }
  };

  const addBillTool: FunctionDeclaration = {
    name: "add_bill",
    description: "Registra uma conta prevista para o futuro (Contas a Pagar ou Contas a Receber).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        descricao: { type: Type.STRING, description: "O nome da conta ou recebimento (ex: Aluguel, Salário Freelance)." },
        valor: { type: Type.NUMBER, description: "O valor da conta." },
        data_vencimento: { type: Type.STRING, description: "A data de vencimento ou previsão no formato YYYY-MM-DD." },
        categoria: { type: Type.STRING, description: "A categoria da conta." },
        tipo: { type: Type.STRING, enum: ["pagar", "receber"], description: "Indica se é uma conta a pagar ou um valor a receber." }
      },
      required: ["descricao", "valor", "data_vencimento", "categoria", "tipo"]
    }
  };

  const updateProfileTool: FunctionDeclaration = {
    name: "update_profile",
    description: "Atualiza informações do perfil financeiro do usuário, como salário, gastos fixos ou metas de distribuição.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        monthly_income: { type: Type.NUMBER, description: "O novo salário mensal do usuário." },
        fixed_costs: { type: Type.NUMBER, description: "O valor total de gastos fixos." },
        display_name: { type: Type.STRING, description: "O nome de exibição do usuário." },
        bio: { type: Type.STRING, description: "A bio ou objetivo financeiro." }
      }
    }
  };

  const createGoalTool: FunctionDeclaration = {
    name: "create_goal",
    description: "Cria uma nova caixinha ou meta de economia.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "O nome da meta (ex: Viagem, Reserva de Emergência)" },
        valor_meta: { type: Type.NUMBER, description: "O valor total que se deseja atingir." }
      },
      required: ["nome", "valor_meta"]
    }
  };

  const allocateToGoalTool: FunctionDeclaration = {
    name: "allocate_to_goal",
    description: "Deposita ou retira dinheiro de uma caixinha/meta específica.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "O ID da caixinha." },
        valor: { type: Type.NUMBER, description: "O valor a ser depositado (positivo) ou retirado (negativo)." }
      },
      required: ["id", "valor"]
    }
  };

  const markBillAsPaidTool: FunctionDeclaration = {
    name: "mark_bill_as_paid",
    description: "Marca uma conta pendente como paga ou um recebimento como recebido.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "O ID da conta a ser marcada como paga/recebida." }
      },
      required: ["id"]
    }
  };

  const saveMemoryTool: FunctionDeclaration = {
    name: "save_user_memory",
    description: "Salva uma informação importante sobre o usuário para lembrar no futuro (ex: preferências, apelidos, objetivos de vida).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: { type: Type.STRING, description: "Uma chave curta para a memória (ex: 'preferencia_investimento', 'apelido')" },
        value: { type: Type.STRING, description: "O conteúdo da memória." }
      },
      required: ["key", "value"]
    }
  };

  const handleSend = async (overrideMessage?: string) => {
    try {
      const messageToSend = overrideMessage || input;
      if (!messageToSend.trim() || isTyping) return;

      // Check monthly limit first (client-side)
      if (isMonthlyLimitReached && !(isPro || hasUnlimitedItem)) {
        const limitMsg = { 
          role: 'capy' as const, 
          content: `Ops! Você atingiu o seu limite de ${MONTHLY_LIMIT} mensagens gratuitas deste mês. Faça o upgrade para o plano Pro para ter conversas ilimitadas com o Capy! 🚀`,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, { role: 'user', content: messageToSend.trim() }, limitMsg]);
        setInput('');
        return;
      }

      // Check minute limit first (client-side)
      if (!checkMinuteLimit()) {
        const limitMsg = { 
          role: 'capy' as const, 
          content: `Ops! Você atingiu o limite de ${USAGE_LIMIT_PER_MINUTE} mensagens por minuto. Aguarde um instante para continuar!`,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, { role: 'user', content: messageToSend.trim() }, limitMsg]);
        setInput('');
        return;
      }

      const userMessage = messageToSend.trim();
      setInput('');
      setIsTyping(true);
      
      // Add current timestamp to minute limit tracker
      const now = Date.now();
      messageTimestamps.current.push(now);
      setMinuteCount(messageTimestamps.current.length);
      if (messageTimestamps.current.length >= USAGE_LIMIT_PER_MINUTE) {
        setIsMinuteLimitReached(true);
      }
      
      // Auto-create session if none exists
      let sessionId = currentSessionId;
      if (!sessionId) {
        const { data, error: sessionError } = await supabase.from('chat_sessions').insert([{
          user_id: user.id,
          title: userMessage.substring(0, 30) + '...'
        }]).select().single();
        
        if (sessionError) throw sessionError;
        
        if (data) {
          sessionId = data.id;
          skipNextFetch.current = true;
          setCurrentSessionId(data.id);
          setSessions([data, ...sessions]);
        }
      }

      if (sessionId) {
        try {
          const { error: msgError } = await supabase.from('chat_messages').insert([{
            session_id: sessionId,
            role: 'user',
            content: userMessage
          }]);
          if (msgError) throw msgError;
          fetchMonthlyUsage().catch(err => console.error('Error refreshing monthly usage:', err));
        } catch (err) {
          console.error('RicoChat: Error saving user message to DB:', err);
        }
      }

      // Add user message to local state immediately
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

      // List of models to try in order of preference to handle regional 503 errors
      const modelsToTry = [
        "gemini-3-flash-preview", 
        "gemini-3.1-flash-lite-preview", 
        "gemini-flash-latest"
      ];
      
      let personality = 'Seu tom é amigável, prestativo e educativo. Você é um parceiro na jornada financeira do usuário.';
      
      // Personalities are Pro-only
      if (isPro) {
        if (profile?.rico_personality === 'coach') {
          personality = 'Você é um COACH FINANCEIRO RIGOROSO. Seu tom é motivador mas firme. Se o usuário gastar demais, dê um "puxão de orelha" amigável. Use frases como "Foco no objetivo!" e "Você quer mesmo essa meta?".';
        } else if (profile?.rico_personality === 'zen') {
          personality = 'Você é um GURU FINANCEIRO ZEN. Seu tom é extremamente calmo, relaxado e pacífico. Você foca em tranquilidade mental e em não se estressar com dinheiro. Use frases como "Respire fundo...", "A paz vale mais que o ouro" e "Tudo flui no seu tempo".';
        } else if (profile?.rico_personality === 'nerd') {
          personality = 'Você é um ANALISTA FINANCEIRO NERD/GEEK. Você ama dados, estatísticas e termos técnicos complexos (mas explica se necessário). Você é preciso, lógico e um pouco introvertido. Use referências a tecnologia e matemática.';
        } else if (profile?.rico_personality === 'sarcastic') {
          personality = 'Você é um ASSISTENTE FINANCEIRO SARCÁSTICO. Você é inteligente e prestativo, mas não resiste a uma piadinha ou comentário irônico sobre os gastos do usuário. Seu humor é ácido mas nunca ofensivo. Use frases como "Ah, claro, porque você realmente precisava disso...", "Seu saldo mandou lembranças" e "Parabéns, o capitalismo agradece".';
        }
      }

      const recentMessages = messages.concat({ role: 'user', content: userMessage }).slice(-8);
      
      const recentExpenses = Array.isArray(expenses) 
        ? expenses.slice(-30).map(e => ({ valor: e.valor, categoria: e.categoria, data: e.data })) 
        : [];
      const recentMemories = Array.isArray(userMemories) 
        ? userMemories.slice(-10).map(m => ({ key: m.key, value: m.value })) 
        : [];
      const simplifiedGoals = Array.isArray(goals)
        ? goals.map(g => ({ nome: g.nome, valor_meta: g.valor_meta, valor_atual: g.valor_atual }))
        : [];
      const pendingBills = Array.isArray(bills)
        ? bills.filter(b => b.status === 'pendente').map(b => ({ id: b.id, descricao: b.descricao, valor: b.valor, data_vencimento: b.data_vencimento, tipo: b.tipo }))
        : [];

      const systemInstruction = `
        Você é o Capy, um assistente financeiro PROATIVO e INTELIGENTE do aplicativo Capitae.
        Seu objetivo não é apenas responder, mas guiar o usuário para a liberdade financeira.
        
        PERSONALIDADE:
        ${personality}
        
        DADOS DO USUÁRIO (REAIS):
        - Perfil: ${JSON.stringify({ 
          name: profile?.full_name, 
          level: profile?.level, 
          streak: profile?.streak,
          monthly_income: profile?.monthly_income,
          pay_frequency: profile?.pay_frequency,
          pay_days: profile?.pay_days
        })}
        - Gastos Recentes: ${JSON.stringify(recentExpenses)}
        - Contas Pendentes: ${JSON.stringify(pendingBills)}
        - Metas Atuais: ${JSON.stringify(simplifiedGoals)}
        - Memórias: ${JSON.stringify(recentMemories)}
        
        SUAS NOVAS DIRETRIZES:
        1. PROATIVIDADE: Se notar que o usuário está gastando muito em uma categoria, alerte-o educadamente.
        2. RESUMOS: Gere "Resumos Financeiros" com Total gasto vs Guardado, Top categorias e Ações práticas.
        3. PREVISÃO DE RISCO: Avise se o ritmo de gastos comprometer as metas.
        4. INTEGRAÇÃO: Você pode criar metas ('create_goal'), registrar gastos ('add_expense'), registrar contas a pagar ou receber ('add_bill'), atualizar o perfil/salário ('update_profile'), marcar uma conta registrada como paga ('mark_bill_as_paid') e depositar/retirar dinheiro de metas ('allocate_to_goal').
        5. LINGUAGEM: Use linguagem simples, direta e motivadora.
        
        CAPACIDADES TÉCNICAS:
        - Registrar gastos/entradas REAIS: 'add_expense'.
        - Registrar CONTAS PREVISTAS (pagar/receber): 'add_bill'.
        - Atualizar SALÁRIO ou informações de PERFIL: 'update_profile'.
        - Criar metas: 'create_goal'.
        - Depositar/Retirar de metas: 'allocate_to_goal'.
        - Marcar conta como paga/recebida: 'mark_bill_as_paid'. Se o usuário disser que pagou algo (ex: 'paguei a luz'), procure o ID na lista de contas pendentes e use esta ferramenta.
        - Se o usuário recebeu salário, recomende a função 'Distribuir Salário' na aba de Gastos.
        - Você pode LEMBRAR de coisas sobre o usuário usando 'save_user_memory'.
        - Você PODE e DEVE realizar análises financeiras complexas sobre os dados de gastos fornecidos.
      `;

      // Helper for API call with streaming logic
      const callGeminiStreaming = async (maxRetriesPerModel = 2) => {
        let lastError: any = null;
        
        // Use process.env.GEMINI_API_KEY as the primary key source (following skill guidelines)
        // Fallback to VITE_ version if process.env is not available in browser but was injected
        const rawKeys = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
        const apiKeys = rawKeys.split(',').map((k: string) => k.trim()).filter((k: string) => k !== '');
        
        if (apiKeys.length === 0) {
          throw new Error('Não foi possível encontrar uma chave de API válida para o Capy. Por favor, verifique as configurações do sistema.');
        }

        for (const currentModel of modelsToTry) {
          for (let i = 0; i < maxRetriesPerModel; i++) {
            const apiKeyToUse = apiKeys[i % apiKeys.length];
            const genAIInstance = new GoogleGenAI({ apiKey: apiKeyToUse });

            try {
              const responseStream = await genAIInstance.models.generateContentStream({
                model: currentModel,
                contents: recentMessages.map(m => ({
                  role: m.role === 'capy' ? 'model' : 'user',
                  parts: [{ text: m.content }]
                })),
                config: {
                  systemInstruction: systemInstruction,
                  tools: [{ functionDeclarations: [addExpenseTool, addBillTool, updateProfileTool, createGoalTool, allocateToGoalTool, markBillAsPaidTool, saveMemoryTool] }],
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                }
              });
              
              // Create a placeholder message for the stream
              const streamMessageId = crypto.randomUUID();
              setMessages(prev => [...prev, { id: streamMessageId, role: 'capy', content: '' }]);
              
              let fullText = '';
              let calls: any[] = [];

              for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                if (chunkText) {
                  fullText += chunkText;
                  setMessages(prev => prev.map(m => 
                    m.id === streamMessageId ? { ...m, content: fullText } : m
                  ));
                }
                
                // Collect function calls if any
                const chunkCalls = chunk.functionCalls;
                if (chunkCalls) {
                  calls = [...calls, ...chunkCalls];
                }
              }

              return { text: fullText, functionCalls: calls.length > 0 ? calls : null };
            } catch (err: any) {
              lastError = err;
              const errorMsg = err.message || '';
              const isRetryable = errorMsg.includes('429') || errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE');
              if (isRetryable && i < maxRetriesPerModel - 1) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
              }
              break;
            }
          }
        }
        throw lastError;
      };

      const result = await callGeminiStreaming();
      await incrementUsage();

      const { text: capyResponse, functionCalls } = result;

      if (functionCalls) {
        for (const call of functionCalls) {
          try {
            const user = await getSafeUser();
            if (!user) continue;

            if (call.name === 'add_expense') {
              const { valor, categoria, data, descricao } = call.args as any;
              const { error } = await supabase.from('gastos').insert([{
                user_id: user.id,
                valor,
                categoria: categoria || 'Outros',
                data: data || new Date().toLocaleDateString('en-CA'),
                descricao: descricao || ''
              }]);
              if (error) throw error;

              const actionMsg = `✅ Registrei seu gasto de R$ ${valor} em ${categoria}!`;
              setMessages(prev => [...prev, { role: 'capy', content: actionMsg, isAction: true }]);
              if (sessionId) {
                try {
                  await supabase.from('chat_messages').insert([{ session_id: sessionId, role: 'capy', content: actionMsg }]);
                } catch (e) {
                  console.error('CapyChat: Error saving action message:', e);
                }
              }
            }

            if (call.name === 'add_bill') {
              const { descricao, valor, data_vencimento, categoria, tipo } = call.args as any;
              const { error } = await supabase.from('bills').insert([{
                user_id: user.id,
                descricao,
                valor,
                data_vencimento,
                categoria,
                tipo,
                status: 'pendente'
              }]);
              if (error) throw error;

              const emoji = tipo === 'receber' ? '💰' : '📅';
              const actionMsg = `${emoji} Registrei a conta "${descricao}" (${tipo}) de R$ ${valor} para o dia ${data_vencimento.split('-').reverse().join('/')}!`;
              setMessages(prev => [...prev, { role: 'capy', content: actionMsg, isAction: true }]);
              if (sessionId) {
                try {
                  await supabase.from('chat_messages').insert([{ session_id: sessionId, role: 'capy', content: actionMsg }]);
                } catch (e) {
                  console.error('CapyChat: Error saving action message:', e);
                }
              }
            }

            if (call.name === 'update_profile') {
              const updates = call.args as any;
              const { error } = await supabase.from('profiles').update({
                ...updates,
                updated_at: new Date().toISOString()
              }).eq('id', user.id);
              if (error) throw error;

              let actionMsg = '👤 Perfil atualizado com sucesso!';
              if (updates.monthly_income) {
                actionMsg = `💰 Salário mensal atualizado para R$ ${updates.monthly_income}!`;
              }
              
              setMessages(prev => [...prev, { role: 'capy', content: actionMsg, isAction: true }]);
              if (sessionId) {
                try {
                  await supabase.from('chat_messages').insert([{ session_id: sessionId, role: 'capy', content: actionMsg }]);
                } catch (e) {
                  console.error('CapyChat: Error saving action message:', e);
                }
              }
            }

            if (call.name === 'mark_bill_as_paid') {
              const { id } = call.args as any;
              const bill = bills.find(b => b.id === id);
              
              if (bill) {
                const isReceivable = bill.tipo === 'receber';
                
                // 1. Mark as paid in bills table
                const { error: updateError } = await supabase
                  .from('bills')
                  .update({ status: 'paga' })
                  .eq('id', id);
                if (updateError) throw updateError;

                // 2. Insert into gastos
                const { error: insertError } = await supabase.from('gastos').insert([{
                  user_id: user.id,
                  descricao: bill.descricao,
                  valor: isReceivable ? -Math.abs(bill.valor) : Math.abs(bill.valor),
                  categoria: bill.categoria,
                  data: new Date().toLocaleDateString('en-CA'),
                  metodo_pagamento: 'saldo'
                }]);
                if (insertError) throw insertError;

                const actionMsg = isReceivable 
                  ? `💵 Recebimento de R$ ${bill.valor} ("${bill.descricao}") registrado com sucesso!`
                  : `✅ Pagamento de R$ ${bill.valor} ("${bill.descricao}") registrado com sucesso!`;
                
                setMessages(prev => [...prev, { role: 'capy', content: actionMsg, isAction: true }]);
                if (sessionId) {
                  try {
                    await supabase.from('chat_messages').insert([{ session_id: sessionId, role: 'capy', content: actionMsg }]);
                  } catch (e) {
                    console.error('CapyChat: Error saving action message:', e);
                  }
                }
              }
            }

            if (call.name === 'allocate_to_goal') {
              const { id, valor } = call.args as any;
              const goal = goals.find(g => g.id === id);

              if (goal) {
                // 1. Update goal
                const { error: updateError } = await supabase
                  .from('caixinhas')
                  .update({ valor_atual: Math.max(0, goal.valor_atual + valor) })
                  .eq('id', id);
                if (updateError) throw updateError;

                // 2. Insert into gastos to affect available balance
                const { error: insertError } = await supabase.from('gastos').insert([{
                  user_id: user.id,
                  valor: valor, // Positive value reduces available balance (deposit), negative increases it (rescue)
                  categoria: valor > 0 ? `Depósito: ${goal.nome}` : `Resgate: ${goal.nome}`,
                  data: new Date().toLocaleDateString('en-CA')
                }]);
                if (insertError) throw insertError;

                const actionMsg = valor > 0 
                  ? `💰 Depositei R$ ${valor} na sua caixinha "${goal.nome}"!`
                  : `💸 Resgatei R$ ${Math.abs(valor)} da sua caixinha "${goal.nome}" para o saldo disponível!`;
                
                setMessages(prev => [...prev, { role: 'capy', content: actionMsg, isAction: true }]);
                if (sessionId) {
                  try {
                    await supabase.from('chat_messages').insert([{ session_id: sessionId, role: 'capy', content: actionMsg }]);
                  } catch (e) {
                    console.error('CapyChat: Error saving action message:', e);
                  }
                }
              }
            }

            if (call.name === 'create_goal') {
              const { nome, valor_meta } = call.args as any;
              const { error } = await supabase.from('caixinhas').insert([{
                user_id: user.id,
                nome,
                valor_meta,
                valor_atual: 0
              }]);
              if (error) throw error;

              const actionMsg = `🚀 Caixinha "${nome}" criada com meta de R$ ${valor_meta}. Boa sorte!`;
              setMessages(prev => [...prev, { role: 'capy', content: actionMsg, isAction: true }]);
              if (sessionId) {
                try {
                  await supabase.from('chat_messages').insert([{ session_id: sessionId, role: 'capy', content: actionMsg }]);
                } catch (e) {
                  console.error('CapyChat: Error saving action message:', e);
                }
              }
            }

            if (call.name === 'save_user_memory') {
              const { key, value } = call.args as any;
              const { error } = await supabase.from('user_memories').upsert([{
                user_id: user.id,
                key,
                value,
                updated_at: new Date().toISOString()
              }], { onConflict: 'user_id,key' });
              if (error) throw error;
              
              await fetchMemories().catch(e => console.error('CapyChat: Error refreshing memories:', e));
            }
          } catch (err) {
            console.error(`CapyChat: Error executing tool ${call.name}:`, err);
          }
        }
        if (onActionComplete) onActionComplete();
      }

      if (capyResponse) {
        if (sessionId) {
          try {
            const { error: msgError } = await supabase.from('chat_messages').insert([{
              session_id: sessionId,
              role: 'capy',
              content: capyResponse
            }]);
            if (msgError) throw msgError;
          } catch (err) {
            console.error('CapyChat: Error saving Capy response to DB:', err);
          }
        }
      } else if (!functionCalls) {
        // If no text and no function calls, something might be wrong with the response
        console.warn('Capy: Empty response from Gemini');
        setMessages(prev => [...prev, { role: 'capy', content: 'Entendi seu ponto, mas não consegui gerar uma resposta detalhada agora. Pode reformular?' }]);
      }
    } catch (err: any) {
      console.error('CapyChat: Error in handleSend:', err);
      setMessages(prev => [...prev, { 
        role: 'capy', 
        content: `Desculpe, tive um problema técnico ao processar sua mensagem: ${err.message || 'Erro desconhecido'}. Tente novamente em alguns instantes.` 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-full bg-background relative overflow-hidden justify-center">
      {/* Sidebar for Sessions */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="absolute inset-y-0 left-0 w-72 bg-secondary border-r border-white/5 z-30 flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h4 className="font-bold flex items-center gap-2"><History className="w-4 h-4" /> Histórico</h4>
              <button onClick={() => setShowSidebar(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <button 
                onClick={createNewSession}
                className="w-full p-4 bg-primary text-background rounded-2xl font-bold flex items-center justify-center gap-2 mb-4 active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" /> Nova Conversa
              </button>
              {sessions.map(s => (
                <div key={s.id} className="relative group">
                  <button
                    onClick={() => {
                      setCurrentSessionId(s.id);
                      setShowSidebar(false);
                    }}
                    className={`w-full p-4 rounded-2xl text-left text-sm transition-all flex items-center gap-3 pr-12 ${
                      currentSessionId === s.id ? 'bg-primary/10 border border-primary/20 text-primary' : 'hover:bg-white/5 text-muted'
                    }`}
                  >
                    <MessageIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </button>
                  <button 
                    onClick={(e) => deleteSession(s.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted/30 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full relative max-w-4xl w-full border-x border-white/5">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-secondary/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSidebar(true)}
              className="p-2 hover:bg-white/5 rounded-xl lg:hidden"
            >
              <History className="w-5 h-5 text-muted" />
            </button>
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,200,83,0.3)]">
              <Bot className="w-6 h-6 text-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-none">Capy</h3>
                {profile?.rico_personality && profile.rico_personality !== 'default' && (
                  <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[8px] font-black uppercase tracking-tighter text-primary">
                    {profile.rico_personality}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Inteligência Capitae
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSidebar(true)}
              className="hidden lg:flex p-2 hover:bg-white/5 rounded-xl items-center gap-2 text-xs font-bold text-muted"
            >
              <History className="w-4 h-4" /> Histórico
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={m.id || i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${m.role === 'capy' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`flex gap-3 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${
                    m.role === 'capy' ? 'bg-primary/10 text-primary' : 'bg-white/5 text-muted'
                  }`}>
                    {m.role === 'capy' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'capy' 
                      ? 'bg-secondary border border-white/5 text-foreground rounded-tl-none' 
                      : 'bg-primary text-background font-medium rounded-tr-none shadow-lg shadow-primary/10'
                  }`}>
                    {m.role === 'capy' ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                            code: ({ children }) => <code className="bg-white/10 px-1 rounded text-primary">{children}</code>,
                            strong: ({ children }) => <strong className="text-primary font-bold">{children}</strong>,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{m.content}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-secondary border border-white/5 p-4 rounded-2xl rounded-tl-none">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="p-6 border-t border-white/5 bg-background/80 backdrop-blur-md">
          {/* Quick Actions */}
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            <button 
              onClick={() => handleSend('Gere um resumo financeiro do meu mês atual.')}
              className="whitespace-nowrap bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary hover:border-primary/30 transition-all"
            >
              📊 Resumo Mensal
            </button>
            <button 
              onClick={() => handleSend('Quais são meus maiores gastos e como posso economizar?')}
              className="whitespace-nowrap bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary hover:border-primary/30 transition-all"
            >
              💡 Dicas de Economia
            </button>
            <button 
              onClick={() => handleSend('Analise meu progresso nas metas.')}
              className="whitespace-nowrap bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary hover:border-primary/30 transition-all"
            >
              🎯 Progresso Metas
            </button>
          </div>

          <div className="flex justify-between items-center mb-2 px-1">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${(isMonthlyLimitReached || isMinuteLimitReached) ? 'text-red-500' : 'text-muted'}`}>
              {isPro || hasUnlimitedItem ? (
                `Pro: ${minuteCount}/${USAGE_LIMIT_PER_MINUTE} msgs/min`
              ) : (
                isMonthlyLimitReached ? 'Limite mensal atingido' : (isMinuteLimitReached ? 'Limite por minuto atingido' : `Uso: ${monthlyCount}/${MONTHLY_LIMIT} msgs/mês`)
              )}
            </span>
            {(isMonthlyLimitReached || isMinuteLimitReached) && !(isPro || hasUnlimitedItem) && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-primary font-bold uppercase tracking-widest animate-pulse">
                  {isMonthlyLimitReached ? 'Limite mensal atingido!' : 'Aguarde um instante!'}
                </span>
                <button 
                  onClick={onUpgrade}
                  className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest hover:bg-primary/20 transition-colors"
                >
                  Ser Pro
                </button>
              </div>
            )}
            {(isPro || hasUnlimitedItem) && (
              <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
            )}
          </div>
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pergunte ao Capy..."
              className="flex-1 bg-secondary border border-white/10 p-4 pr-14 rounded-2xl outline-none focus:border-primary transition-all text-sm"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-3 bg-primary text-background rounded-xl disabled:opacity-30 transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-center text-muted mt-4 uppercase tracking-widest font-bold opacity-50">
            Capy pode cometer erros. Revise informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
}

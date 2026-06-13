import React, { useState, useEffect } from 'react';
import { getSafeUser, supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Save, Loader2, LogOut, Mail, Info, CheckCircle2, Zap, Lock, AlertTriangle, Clock, Shield, Search, RefreshCw, UserCheck, UserX, Copy } from 'lucide-react';

import { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileData {
  display_name: string;
  avatar_url: string;
  bio: string;
  xp: number;
  level: string;
  coins: number;
  streak: number;
  monthly_income: number;
  payday: number;
  pay_frequency: string;
  pay_days: string;
  fixed_costs: number;
  perc_essentials: number;
  perc_leisure: number;
  perc_investment: number;
}

interface ProfileProps {
  user: SupabaseUser;
  isPro?: boolean;
  isTrialActive?: boolean;
  onUpgrade?: () => void;
  onUpdateProfile?: (updatedData: Partial<ProfileData>) => void;
}

export default function Profile({ user, isPro, isTrialActive, onUpgrade, onUpdateProfile }: ProfileProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    display_name: '',
    avatar_url: '',
    bio: '',
    xp: 0,
    level: 'Sobrevivente',
    coins: 0,
    streak: 0,
    monthly_income: 0,
    payday: 5,
    pay_frequency: 'mensal',
    pay_days: '',
    fixed_costs: 0,
    perc_essentials: 50,
    perc_leisure: 30,
    perc_investment: 20
  });
  const [userEmail, setUserEmail] = useState<string | undefined>(user.email);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Admin configurations and State
  const ADMIN_EMAILS = [
    'caiogabriel1995@gmail.com', 
    'josueamorim906@gmail.com'
  ];
  const isAdminUser = user?.email ? ADMIN_EMAILS.includes(user.email) : false;
  const sqlEmailList = ADMIN_EMAILS.map(e => `'${e}'`).join(', ');

  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [showRlsModal, setShowRlsModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Kiwify Webhook Simulator states
  const [simulatedEmail, setSimulatedEmail] = useState(user?.email || '');
  const [simulatedStatus, setSimulatedStatus] = useState<'paid' | 'refunded'>('paid');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; title: string; msg: string } | null>(null);

  useEffect(() => {
    if (user?.email && !simulatedEmail) {
      setSimulatedEmail(user.email);
    }
  }, [user]);

  const handleRunSimulation = async () => {
    if (!simulatedEmail) {
      setSimResult({ success: false, title: 'Erro de validação', msg: 'Por favor, insira um e-mail válido para simulação.' });
      return;
    }
    setSimulating(true);
    setSimResult(null);
    try {
      const payload = {
        order_status: simulatedStatus,
        customer: {
          email: simulatedEmail.trim(),
          name: 'Simulador Cliente Capitae',
          mobile: '+5511999999999'
        },
        product: {
          product_name: 'Capitae Business - Premium Pro'
        },
        test: true
      };

      const resp = await fetch('/api/webhooks/kiwify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kiwify-signature': 'simulation'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await resp.text();
      
      if (resp.ok) {
        setSimResult({
          success: true,
          title: 'Simulação Enviada com Sucesso!',
          msg: `A API de Webhook processou o sinal "${simulatedStatus}" em tempo real para:\n📧 ${simulatedEmail}\n\nResposta: ${responseText}\n\n👉 Caso tenha simulado para a sua própria conta, recarregue a página (ou clique em outra aba e volte) para ver a atualização PRO!`
        });
        
        // Trigger a profile refresh
        setTimeout(() => {
          fetchProfile().catch(err => console.error('Error reloading updated status:', err));
        }, 1500);
      } else {
        setSimResult({
          success: false,
          title: `Falha na Simulação (${resp.status})`,
          msg: `Servidor recusou a simulação: ${responseText}\n\nNota: Certifique-se de que o usuário com este e-mail já existe/está cadastrado no aplicativo antes de testar.`
        });
      }
    } catch (err: any) {
      setSimResult({
        success: false,
        title: 'Erro de Conexão',
        msg: err?.message || 'Erro inesperado na chamada da API.'
      });
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    fetchProfile().catch(err => console.error('Profile: Error in fetchProfile:', err));
    if (isAdminUser) {
      fetchAllProfiles().catch(err => console.error('Profile: Error in fetchAllProfiles:', err));
    }
  }, []);

  const fetchAllProfiles = async () => {
    if (!isAdminUser || !user?.email) return;
    setLoadingProfiles(true);
    try {
      let data: any[] = [];
      let loadedFromApi = false;

      // 1. Try to fetch from server-side API first
      try {
        const response = await fetch('/api/admin/users', {
          headers: {
            'x-admin-email': user.email
          }
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && !contentType.includes('text/html')) {
          const apiData = await response.json();
          if (Array.isArray(apiData)) {
            data = apiData;
            loadedFromApi = true;
          }
        }
      } catch (apiErr) {
        console.warn('API /api/admin/users is not available. Falling back to direct Supabase query. Error:', apiErr);
      }

      // 2. Direct client-side Supabase query fallback (essential for Vercel/static deploys)
      if (!loadedFromApi) {
        console.log('Fetching users directly from Supabase...');
        let supabaseProfiles: any[] | null = null;
        let supabaseError: any = null;

        // Try executing RPC function to retrieve users securely bypassing client RLS
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('admin_get_users');
          if (!rpcError && Array.isArray(rpcData)) {
            supabaseProfiles = rpcData;
          } else {
            console.warn('RPC admin_get_users error or not available, falling back to direct table select...', rpcError);
            const { data: tableData, error: tableError } = await supabase
              .from('profiles')
              .select('*');
            supabaseProfiles = tableData;
            supabaseError = tableError;
          }
        } catch (rpcErr) {
          console.warn('RPC admin_get_users failed, falling back to database select:', rpcErr);
          const { data: tableData, error: tableError } = await supabase
            .from('profiles')
            .select('*');
          supabaseProfiles = tableData;
          supabaseError = tableError;
        }

        if (supabaseError) {
          throw supabaseError;
        }

        // Apply same status normalization as the backend server (Admins always show up as PRO)
        data = (supabaseProfiles || []).map((usr: any) => {
          const emailLower = (usr.email || '').toLowerCase();
          const isAdmin = ADMIN_EMAILS.includes(emailLower);
          const isPremiumOrPro = usr.is_premium === true || usr.is_pro === true || isAdmin;

          return {
            ...usr,
            is_premium: isPremiumOrPro,
            is_pro: isPremiumOrPro
          };
        });
      }

      setAllProfiles(data);
    } catch (err: any) {
      console.error('Erro ao buscar todos os perfis:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const toggleUserPremium = async (targetUserId: string, currentStatus: boolean) => {
    if (!user?.email) return;
    setUpdatingUserId(targetUserId);
    try {
      const nextStatus = !currentStatus;
      let updatedSuccessfully = false;

      // 1. Try server API first
      try {
        const response = await fetch('/api/admin/users/toggle-premium', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-email': user.email
          },
          body: JSON.stringify({ targetUserId, currentStatus })
        });
        
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && !contentType.includes('text/html')) {
          const result = await response.json();
          if (result && result.success) {
            updatedSuccessfully = true;
          } else if (result && result.error) {
            throw new Error(result.error);
          }
        }
      } catch (apiErr: any) {
        console.warn('POST /api/admin/users/toggle-premium failed. Falling back to direct Supabase update on client. Error:', apiErr);
      }

      // 2. Direct client-side update fallback (essential for Vercel/static hosts)
      if (!updatedSuccessfully) {
        // Prevent deleting admin credentials
        const targetUser = allProfiles.find(p => p.id === targetUserId);
        if (targetUser && targetUser.email && ADMIN_EMAILS.includes(targetUser.email.toLowerCase())) {
          throw new Error('Não é permitido remover privilégios de um Administrador.');
        }

        // Try calling the RPC to toggle value with SECURITY DEFINER
        try {
          const { data: rpcResult, error: rpcError } = await supabase.rpc('admin_toggle_premium', {
            target_user_id: targetUserId,
            next_status: nextStatus
          });
          if (!rpcError && rpcResult && rpcResult.success) {
            updatedSuccessfully = true;
          } else {
            console.warn('RPC admin_toggle_premium failed, falling back to direct table update:', rpcError);
          }
        } catch (rpcErr) {
          console.warn('RPC admin_toggle_premium failed with error, falling back to direct table update:', rpcErr);
        }

        if (!updatedSuccessfully) {
          const { data, error: dbError } = await supabase
            .from('profiles')
            .update({
              is_premium: nextStatus,
              is_pro: nextStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetUserId)
            .select();

          if (dbError) throw dbError;

          if (!data || data.length === 0) {
            setShowRlsModal(true);
            throw new Error(
              'A atualização no banco de dados foi barrada por restrição de segurança (RLS). ' +
              'Como o Vercel é um site estático e não roda nosso backend nativo em Node para contornar o RLS, ' +
              'você precisa rodar a função segura RPC admin_toggle_premium no console do Supabase para que as atualizações funcionem diretamente.'
            );
          }
          updatedSuccessfully = true;
        }
      }

      if (updatedSuccessfully) {
        // Update state locally
        setAllProfiles(prev => prev.map(p => p.id === targetUserId ? { ...p, is_premium: nextStatus, is_pro: nextStatus } : p));
      }
    } catch (err: any) {
      console.error('Error toggling premium:', err);
      if (err.message && (err.message.includes('RLS') || err.message.includes('admin_toggle_premium') || err.message.includes('barrada por restrição') || err.message.includes('permissão') || err.message.includes('denied'))) {
        setShowRlsModal(true);
        alert(
          'Atenção: A atualização no banco de dados falhou devido a restrições de segurança RLS do Supabase.\n\n' +
          'Se você está acessando a partir de um ambiente estático (como o Vercel), você precisa instalar as funções RPC seguras no console do Supabase para que a atualização direta funcione.\n\n' +
          'Abriremos o painel com o código SQL e instruções na tela para você copiar.'
        );
      } else {
        alert('Erro ao atualizar status do usuário: ' + err.message);
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  const fetchProfile = async () => {
    try {
      if (user.id === 'guest_user') {
        const cached = localStorage.getItem('capitae_profile_guest_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          setProfile(parsed);
          if (onUpdateProfile) {
            onUpdateProfile(parsed);
          }
        } else {
          const defaultGuest = {
            display_name: 'Usuário Local',
            avatar_url: '',
            bio: 'Minha barbearia, lanchonete ou confecção local sob controle.',
            xp: 150,
            level: 'Estrategista',
            coins: 10,
            streak: 1,
            monthly_income: 0,
            payday: 5,
            pay_frequency: 'mensal',
            pay_days: '',
            fixed_costs: 0,
            perc_essentials: 50,
            perc_leisure: 30,
            perc_investment: 20
          };
          setProfile(defaultGuest);
          if (onUpdateProfile) {
            onUpdateProfile(defaultGuest);
          }
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const loadedProfile = {
          display_name: data.display_name || '',
          avatar_url: data.avatar_url || '',
          bio: data.bio || '',
          xp: data.xp || 0,
          level: data.level || 'Sobrevivente',
          coins: data.coins || 0,
          streak: data.streak || 0,
          monthly_income: data.monthly_income || 0,
          payday: data.payday || 5,
          pay_frequency: data.pay_frequency || 'mensal',
          pay_days: data.pay_days || '',
          fixed_costs: data.fixed_costs || 0,
          perc_essentials: data.perc_essentials || 50,
          perc_leisure: data.perc_leisure || 30,
          perc_investment: data.perc_investment || 20
        };
        setProfile(loadedProfile);
        if (onUpdateProfile) {
          onUpdateProfile(loadedProfile);
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar perfil:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (user.id === 'guest_user') {
        localStorage.setItem('capitae_profile_guest_user', JSON.stringify(profile));
        if (onUpdateProfile) {
          onUpdateProfile(profile);
        }
        // Force trigger an update event or simply delay a bit to show a nice loader animation
        await new Promise(resolve => setTimeout(resolve, 800));
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 3000);
        return;
      }

      const { error } = await supabase.from('profiles').update({
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);

      if (error) throw error;
      
      if (onUpdateProfile) {
        onUpdateProfile({
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio
        });
      }

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    } catch (error: any) {
      alert('Erro ao salvar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const compressAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // High capability, small size compressed JPEG
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = (err) => {
          reject(err);
        };
      };
      reader.onerror = (err) => {
        reject(err);
      };
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);

      // Compress and convert to Base64 (100% reliable local mechanism avoiding storage policies)
      const base64String = await compressAndGetBase64(file);

      setProfile(prev => {
        const updated = { ...prev, avatar_url: base64String };
        if (user.id === 'guest_user') {
          localStorage.setItem('capitae_profile_guest_user', JSON.stringify(updated));
        }
        return updated;
      });

      // Synchronize in real-time across Dashboard
      if (onUpdateProfile) {
        onUpdateProfile({ avatar_url: base64String });
      }

      if (user.id !== 'guest_user') {
        const { error: dbError } = await supabase.from('profiles').update({
          avatar_url: base64String,
          updated_at: new Date().toISOString()
        }).eq('id', user.id);
        if (dbError) throw dbError;
      }

    } catch (error: any) {
      alert('Erro ao fazer upload da avatar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => {
    setShowLogoutConfirm(true);
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
    } catch (err) {
      console.error('Profile: Error signing out:', err);
      window.location.reload();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (user.id === 'guest_user') {
      setPasswordError('Como visitante local (Sem Login), você não possuí uma senha cadastrada no banco de dados. Cadastre sua conta para proteger seus dados!');
      return;
    }

    if (newPassword.trim().length < 6) {
      setPasswordError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err: any) {
      console.error('Password change error details:', err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit')) {
        setPasswordError('Você atingiu o limite de tentativas de autenticação. Aguarde um momento antes de tentar novamente.');
      } else {
        setPasswordError(err.message || 'Ocorreu um erro ao atualizar sua senha.');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="relative group">
          <div className="w-32 h-32 bg-secondary rounded-full overflow-hidden border-4 border-primary/20 flex items-center justify-center shadow-2xl relative">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-16 h-16 text-muted" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </div>
          <label className="absolute bottom-0 right-0 p-2 bg-primary rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform">
            <Camera className="w-5 h-5 text-background" />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
        <div className="text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <h3 className="text-xl font-black text-white">{profile.display_name || 'Seu Nome'}</h3>
            {isAdminUser ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-[#00E676]/20 text-primary border border-primary/40 rounded-full font-black text-[9px] tracking-widest uppercase shadow-[0_0_12px_rgba(0,230,118,0.25)] select-none animate-pulse">
                <Shield className="w-3 h-3 text-primary shrink-0" />
                ADMIN PRO
              </span>
            ) : isPro ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-emerald-500/20 to-primary/20 text-[#00E676] border border-[#00E676]/30 rounded-full font-black text-[9px] tracking-widest uppercase shadow-[0_0_12px_rgba(0,230,118,0.15)] select-none">
                <Zap className="w-3 h-3 fill-[#00E676]" />
                PRO
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-foreground/5 text-muted border border-foreground/10 rounded-full font-black text-[9px] tracking-widest uppercase select-none">
                FREE
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs text-muted flex items-center gap-1">
              <Mail className="w-3 h-3" /> {userEmail}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
        <div className="space-y-2">
          <label className="text-xs text-muted uppercase font-bold tracking-widest">Nome de Exibição</label>
          <input 
            type="text"
            value={profile.display_name}
            onChange={e => setProfile({ ...profile, display_name: e.target.value })}
            placeholder="Como quer ser chamado?"
            className="w-full bg-background border border-white/5 p-4 rounded-2xl outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted uppercase font-bold tracking-widest">Bio / Objetivo Financeiro</label>
          <textarea 
            value={profile.bio}
            onChange={e => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Conte um pouco sobre seus planos financeiros..."
            rows={3}
            className="w-full bg-background border border-foreground/5 p-4 rounded-2xl outline-none focus:border-primary transition-all resize-none"
          />
        </div>

        <div className="pt-4 space-y-3">
          <button 
            onClick={handleSave}
            disabled={saving || uploading}
            className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,200,83,0.3)] active:scale-95 transition-all disabled:opacity-50 ${
              showSaved ? 'bg-green-500 text-white' : 'bg-primary text-background'
            }`}
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : showSaved ? (
              <><CheckCircle2 className="w-5 h-5" /> Salvo</>
            ) : (
              <><Save className="w-5 h-5" /> Salvar Alterações</>
            )}
          </button>

          <button 
            onClick={handleSignOut}
            className="w-full bg-foreground/5 text-red-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" /> Sair da Conta
          </button>
        </div>
      </div>

      {/* Plano & Assinatura */}
      <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
        <div className="flex items-center gap-2 border-b border-foreground/5 pb-4">
          <Zap className="w-5 h-5 text-primary" />
          <h4 className="font-bold text-white text-base">Plano & Assinatura</h4>
        </div>

        {isAdminUser ? (
          <div className="p-5 bg-gradient-to-r from-amber-500/10 to-primary/10 border border-primary/25 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-white text-sm font-black tracking-tight">Administrador Permanente</p>
                <p className="text-[11px] text-primary font-black uppercase tracking-wider">Acesso Vitalício PRO Ativo</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-primary/10">
              Você está conectado como um dos administradores nativos do sistema Capitae Business. Seu acesso à licença PRO é permanente, ilimitado e vitalício. Use o Painel Administrativo de Controle logo abaixo para conceder, gerenciar e conferir as assinaturas dos demais usuários.
            </p>
          </div>
        ) : isPro ? (
          <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-white text-sm font-black tracking-tight">Capitae PRO Ativo</p>
                <p className="text-[11px] text-[#00E676] font-extrabold uppercase">Acesso Ilimitado Aberto</p>
              </div>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed pt-2 border-t border-primary/10">
              Seu Capitae Business está ativo no plano integral mensal! Obrigado por apoiar e gerenciar seu negócio conosco. Todas as frentes de caixa (PDV), fluxo de caixa, estoque e relatórios estão totalmente liberadas.
            </p>
          </div>
        ) : (
          <div className="p-5 bg-background/50 border border-foreground/10 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-white text-sm font-bold tracking-tight">Período de Experiência Grátis</p>
                <p className="text-[11px] text-muted uppercase font-black tracking-widest text-[9px]">Apenas 7 dias de teste</p>
              </div>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed pt-2 border-t border-foreground/10">
              Você está utilizando o período experimental gratuito do Capitae Business. Mude para a assinatura completa para garantir seu acesso definitivo, manter seus dados sob total controle e expandir as margens do seu negócio.
            </p>
            <div className="pt-2">
              <a 
                href="https://pay.kiwify.com.br/aNA7SJE"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-4 bg-primary text-slate-950 text-xs font-black text-center uppercase tracking-widest rounded-2xl hover:bg-opacity-95 transition-all shadow-[0_4px_12px_rgba(0,230,118,0.25)]"
              >
                Garantir Licença Capitae PRO
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Painel do Administrador (Visível somente para Administradores permitidos) */}
      {isAdminUser && (
        <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
          <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-white text-base">Painel do Administrador</h4>
            </div>
            <button
              onClick={fetchAllProfiles}
              disabled={loadingProfiles}
              className="p-2 hover:bg-foreground/5 rounded-xl text-muted hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Atualizar lista de usuários"
            >
              <RefreshCw className={`w-4 h-4 ${loadingProfiles ? 'animate-spin text-primary' : ''}`} />
              Sincronizar
            </button>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Como administrador, você pode visualizar todos os usuários cadastrados e gerenciar de forma autônoma o acesso às licenças PRO do Capitae Business em tempo real.
          </p>

          {/* Estatísticas administrativas */}
          <div className="grid grid-cols-3 gap-2 px-1">
            <div className="bg-background/40 border border-foreground/5 p-3 rounded-2xl text-center space-y-0.5">
              <span className="text-[9px] text-muted font-bold uppercase tracking-widest block">Cadastros</span>
              <span className="text-lg font-black text-white">{allProfiles.length}</span>
            </div>
            <div className="bg-background/40 border border-emerald-500/10 p-3 rounded-2xl text-center space-y-0.5">
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest block">Assinantes PRO</span>
              <span className="text-lg font-black text-[#00E676]">
                {allProfiles.filter(p => p.is_premium).length}
              </span>
            </div>
            <div className="bg-background/40 border border-foreground/5 p-3 rounded-2xl text-center space-y-0.5">
              <span className="text-[9px] text-muted font-bold uppercase tracking-widest block">Gratuitos</span>
              <span className="text-lg font-black text-stone-400">
                {allProfiles.filter(p => !p.is_premium).length}
              </span>
            </div>
          </div>

          {/* Barra de Pesquisa */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Pesquisar por nome de exibição..."
              value={profileSearch}
              onChange={(e) => setProfileSearch(e.target.value)}
              className="w-full bg-background border border-foreground/10 focus:border-primary pl-11 pr-4 py-3 text-xs text-white rounded-xl placeholder-stone-600 outline-none transition-colors"
            />
          </div>

          {/* Lista de usuários */}
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            {loadingProfiles ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-muted">Carregando usuários cadastrados...</span>
              </div>
            ) : allProfiles.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted">Nenhum perfil encontrado no banco de dados.</div>
            ) : (() => {
              const filtered = allProfiles.filter(p => 
                (p.display_name || 'Sem nome').toLowerCase().includes(profileSearch.toLowerCase()) ||
                (p.email || '').toLowerCase().includes(profileSearch.toLowerCase())
              );

              if (filtered.length === 0) {
                return <div className="text-center py-6 text-xs text-muted">Nenhum resultado para a pesquisa.</div>;
              }

              return filtered.map((usr) => {
                return (
                  <div 
                    key={usr.id} 
                    className="p-3 bg-background/50 border border-white/5 rounded-2xl flex items-center justify-between gap-3 hover:border-white/10 transition-all animate-fadeIn"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-secondary border border-foreground/5 overflow-hidden flex items-center justify-center shrink-0">
                        {usr.avatar_url ? (
                          <img src={usr.avatar_url} alt="" className="w-full h-full object-cover animate-scaleIn" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-4 h-4 text-muted" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-white leading-none">
                            {usr.display_name || 'Usuário Sem Nome'}
                          </span>
                          {usr.id === user.id && (
                            <span className="px-1 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded uppercase">Você</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted leading-relaxed max-w-[170px] truncate">
                          {usr.email || ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {usr.is_premium ? (
                        <span className="px-2 py-1 bg-emerald-500/10 text-[#00E676] border border-emerald-500/20 text-[9px] font-black rounded-lg uppercase tracking-wider select-none">
                          PRO
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-foreground/5 text-muted border border-foreground/10 text-[9px] font-black rounded-lg uppercase tracking-wider select-none">
                          FREE
                        </span>
                      )}

                      {/* Botão de Conceder/Remover acesso (exceto si mesmo se for admin) */}
                      {usr.id !== user.id && (
                        <button
                          onClick={() => toggleUserPremium(usr.id, usr.is_premium)}
                          disabled={updatingUserId === usr.id}
                          className={`p-2 rounded-xl transition-all outline-none focus:ring-1 focus:ring-primary cursor-pointer border ${
                            usr.is_premium 
                              ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400' 
                              : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-[#00E676]'
                          }`}
                          title={usr.is_premium ? 'Remover Licença PRO' : 'Conceder Acesso PRO'}
                        >
                          {updatingUserId === usr.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : usr.is_premium ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Alterar Senha */}
      <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
        <div className="flex items-center gap-2 border-b border-foreground/5 pb-4">
          <Lock className="w-5 h-5 text-primary" />
          <h4 className="font-bold text-white text-base">Alterar Senha</h4>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && (
            <div className="p-4 text-xs sm:text-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{passwordError}</span>
            </div>
          )}
          {passwordSuccess && (
            <div className="p-4 text-xs sm:text-sm bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">Sua senha foi alterada com sucesso!</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-muted uppercase font-bold tracking-widest">Nova Senha</label>
            <input 
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Digite sua nova senha (mínimo 6 caracteres)"
              className="w-full bg-background border border-white/5 p-4 rounded-2xl outline-none focus:border-primary transition-all text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted uppercase font-bold tracking-widest">Confirmar Nova Senha</label>
            <input 
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirme sua nova senha"
              className="w-full bg-background border border-white/5 p-4 rounded-2xl outline-none focus:border-primary transition-all text-sm"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={changingPassword}
            className="w-full bg-primary text-background hover:bg-primary/95 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-sm shadow-[0_0_20px_rgba(0,200,83,0.15)] disabled:opacity-50"
          >
            {changingPassword ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Atualizar Senha'
            )}
          </button>
        </form>
      </div>

      <div className="bg-primary/5 border border-primary/10 p-6 rounded-3xl space-y-3">
        <h4 className="font-bold text-primary flex items-center gap-2">
          <Info className="w-4 h-4" /> Dica de Segurança
        </h4>
        <p className="text-xs text-muted leading-relaxed">
          Suas informações de perfil são privadas e usadas apenas para personalizar sua experiência no Capitae.
        </p>
      </div>

      {/* Simulador de Vendas Kiwify para testes simples e autômatos */}
      <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
        <div className="flex items-center gap-2 border-b border-foreground/5 pb-4">
          <Zap className="w-5 h-5 text-[#00E676] animate-pulse" />
          <h4 className="font-bold text-white text-base">Painel de Testes: Simulador de Compra Kiwify</h4>
        </div>
        
        <p className="text-xs text-muted leading-relaxed">
          Digite um e-mail cadastrado no aplicativo no campo abaixo para enviar um sinal de webhook idêntico ao processo oficial da Kiwify. Com essa ferramenta, você testa o fluxo completo de ativação do PRO em 1 clique!
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] text-muted uppercase font-bold tracking-widest pl-1">E-mail para simular o Webhook</label>
            <div className="flex gap-2">
              <input 
                type="email"
                value={simulatedEmail}
                onChange={e => setSimulatedEmail(e.target.value)}
                placeholder="Exemplo: josueufceconomia@gmail.com"
                className="flex-1 bg-background border border-white/5 p-3.5 rounded-2xl outline-none focus:border-primary transition-all text-xs text-white"
              />
              <button
                type="button"
                onClick={() => setSimulatedEmail(user?.email || '')}
                className="px-4 bg-white/5 hover:bg-white/10 text-xs text-muted hover:text-white rounded-2xl transition-all font-semibold border border-white/5 cursor-pointer"
              >
                Meu E-mail
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-muted uppercase font-bold tracking-widest pl-1">Status do Evento Kiwify</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimulatedStatus('paid')}
                className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  simulatedStatus === 'paid' 
                    ? 'border-[#00E676] bg-[#00E676]/10 text-[#00E676]' 
                    : 'border-white/5 bg-background text-muted hover:text-white'
                }`}
              >
                paid (Aprovado / Ativar PRO)
              </button>
              <button
                type="button"
                onClick={() => setSimulatedStatus('refunded')}
                className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  simulatedStatus === 'refunded' 
                    ? 'border-red-500 bg-red-500/10 text-red-500' 
                    : 'border-white/5 bg-background text-muted hover:text-white'
                }`}
              >
                refunded (Cancelado / Retirar PRO)
              </button>
            </div>
          </div>

          {simResult && (
            <div className={`p-4 rounded-2xl border text-[11px] font-mono whitespace-pre-wrap transition-all leading-relaxed ${
              simResult.success 
                ? 'bg-green-500/5 border-green-500/20 text-green-400' 
                : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              <div className="flex items-center gap-1.5 mb-2 font-sans font-black text-xs uppercase tracking-wide">
                {simResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 animate-bounce" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                {simResult.title}
              </div>
              {simResult.msg}
            </div>
          )}

          <button
            type="button"
            disabled={simulating}
            onClick={handleRunSimulation}
            className="w-full bg-[#00E676] text-background hover:bg-[#00E676]/90 disabled:opacity-50 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs cursor-pointer shadow-[0_0_20px_rgba(0,230,118,0.15)]"
          >
            {simulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" /> 
                {simulatedStatus === 'paid' ? 'Disparar Sinal de Compra e Ativar PRO' : 'Disparar Sinal de Reembolso e Remover PRO'}
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-secondary border border-foreground/10 p-6 rounded-[32px] overflow-hidden shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500">
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

        {showRlsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRlsModal(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#141517] border border-white/5 p-6 md:p-8 rounded-[32px] shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white shrink-0">Instalação Simples via SQL Editor</h3>
                  <p className="text-xs text-muted">Basta rodar o código abaixo no SQL Editor do seu console Supabase.</p>
                </div>
              </div>

              <div className="space-y-4 text-left leading-relaxed text-slate-300 text-sm">
                <p>
                  Como o <strong>Vercel é um serviço de hospedagem estático</strong>, os recursos de API do nosso backend em Node.js (que usam a chave mestre para modificar usuários bypassando RLS) não funcionam.
                </p>
                <p>
                  Para resolver isso com total segurança, você só precisa criar duas pequenas funções (RPC) com privilégio de administrador executado via <code>SECURITY DEFINER</code>. Ambas estão programadas para só permitirem execução se o usuário logado for de fato um administrador (<code>{ADMIN_EMAILS.join(' ou ')}</code>).
                </p>
                
                <div className="space-y-2">
                  <span className="text-xs text-primary uppercase font-bold tracking-widest block">Instruções de Instalação rápida:</span>
                  <ol className="list-decimal pl-5 space-y-2 text-xs text-muted">
                    <li>Acesse o console do seu projeto no <strong>Supabase</strong> (supabase.com).</li>
                    <li>No menu esquerdo, vá em <strong>SQL Editor</strong> e crie uma nova query (clique em <code>New query</code>).</li>
                    <li>Cole o código SQL fornecido abaixo e clique em <strong>Run</strong>.</li>
                    <li>Pronto! O painel de controle e a troca de status do PRO passarão a funcionar imediatamente.</li>
                  </ol>
                </div>

                <div className="relative bg-[#0d0e10] p-4 rounded-2xl border border-white/5 font-mono text-xs overflow-x-auto max-h-60 mt-3 select-all">
                  <pre className="text-emerald-400">
{`CREATE TABLE IF NOT EXISTS public.kiwify_payments (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  used_by_user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE public.kiwify_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for anyone" ON public.kiwify_payments;
CREATE POLICY "Allow read for anyone" ON public.kiwify_payments FOR SELECT USING (true);

DROP FUNCTION IF EXISTS public.admin_toggle_premium(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_get_users();
DROP FUNCTION IF EXISTS public.activate_kiwify_premium(TEXT);

CREATE OR REPLACE FUNCTION public.activate_kiwify_premium(buyer_email TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  payment_row RECORD;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT * INTO payment_row FROM public.kiwify_payments WHERE LOWER(email) = LOWER(buyer_email) LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma compra ativa encontrada com este e-mail na Kiwify. Se você acabou de comprar, aguarde 2 minutos e tente novamente.');
  END IF;

  IF NOT (payment_row.status IN ('paid', 'approved', 'renewed', 'succeeded')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pagamento deste e-mail na Kiwify não está ativo ou foi cancelado.');
  END IF;

  IF payment_row.used_by_user_id IS NOT NULL AND payment_row.used_by_user_id <> current_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este e-mail de compra já está em uso por outro perfil do Capitae.');
  END IF;

  UPDATE public.kiwify_payments
  SET used_by_user_id = current_user_id
  WHERE LOWER(email) = LOWER(buyer_email);

  UPDATE public.profiles
  SET is_premium = true, is_pro = true, updated_at = NOW()
  WHERE id = current_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.admin_toggle_premium(target_user_id UUID, next_status BOOLEAN)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  current_user_email := (auth.jwt() ->> 'email')::text;

  IF current_user_email IN (${sqlEmailList}) THEN
    UPDATE public.profiles
    SET is_premium = next_status, is_pro = next_status, updated_at = NOW()
    WHERE id = target_user_id;
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS SETOF public.profiles
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  current_user_email := (auth.jwt() ->> 'email')::text;

  IF current_user_email IN (${sqlEmailList}) THEN
    RETURN QUERY SELECT * FROM public.profiles;
  ELSE
    RAISE EXCEPTION 'Access denied';
  END IF;
END;
$$ LANGUAGE plpgsql;`}
                  </pre>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `CREATE TABLE IF NOT EXISTS public.kiwify_payments (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  used_by_user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE public.kiwify_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for anyone" ON public.kiwify_payments;
CREATE POLICY "Allow read for anyone" ON public.kiwify_payments FOR SELECT USING (true);

DROP FUNCTION IF EXISTS public.admin_toggle_premium(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_get_users();
DROP FUNCTION IF EXISTS public.activate_kiwify_premium(TEXT);

CREATE OR REPLACE FUNCTION public.activate_kiwify_premium(buyer_email TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  payment_row RECORD;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT * INTO payment_row FROM public.kiwify_payments WHERE LOWER(email) = LOWER(buyer_email) LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma compra ativa encontrada com este e-mail na Kiwify. Se você acabou de comprar, aguarde 2 minutos e tente novamente.');
  END IF;

  IF NOT (payment_row.status IN ('paid', 'approved', 'renewed', 'succeeded')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'O pagamento deste e-mail na Kiwify não está ativo ou foi cancelado.');
  END IF;

  IF payment_row.used_by_user_id IS NOT NULL AND payment_row.used_by_user_id <> current_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este e-mail de compra já está em uso por outro perfil do Capitae.');
  END IF;

  UPDATE public.kiwify_payments
  SET used_by_user_id = current_user_id
  WHERE LOWER(email) = LOWER(buyer_email);

  UPDATE public.profiles
  SET is_premium = true, is_pro = true, updated_at = NOW()
  WHERE id = current_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.admin_toggle_premium(target_user_id UUID, next_status BOOLEAN)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  current_user_email := (auth.jwt() ->> 'email')::text;

  IF current_user_email IN (${sqlEmailList}) THEN
    UPDATE public.profiles
    SET is_premium = next_status, is_pro = next_status, updated_at = NOW()
    WHERE id = target_user_id;
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS SETOF public.profiles
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_email TEXT;
BEGIN
  current_user_email := (auth.jwt() ->> 'email')::text;

  IF current_user_email IN (${sqlEmailList}) THEN
    RETURN QUERY SELECT * FROM public.profiles;
  ELSE
    RAISE EXCEPTION 'Access denied';
  END IF;
END;
$$ LANGUAGE plpgsql;`;
                      navigator.clipboard.writeText(sql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="flex-1 bg-primary text-background font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-95 text-xs"
                  >
                    {copiedSql ? (
                      <><CheckCircle2 className="w-4 h-4" /> Copiado com sucesso!</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Copiar Código SQL</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRlsModal(false)}
                    className="flex-1 bg-white/5 text-white hover:bg-white/10 font-bold py-3.5 px-4 rounded-xl transition-all active:scale-95 text-xs"
                  >
                    Fechar Instruções
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

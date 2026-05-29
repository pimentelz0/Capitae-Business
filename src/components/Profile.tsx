import React, { useState, useEffect } from 'react';
import { getSafeUser, supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Save, Loader2, LogOut, Mail, Info, CheckCircle2, Zap, Lock, AlertTriangle } from 'lucide-react';

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
}

export default function Profile({ user, isPro, isTrialActive, onUpgrade }: ProfileProps) {
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

  useEffect(() => {
    fetchProfile().catch(err => console.error('Profile: Error in fetchProfile:', err));
  }, []);

  const fetchProfile = async () => {
    try {
      if (user.id === 'guest_user') {
        const cached = localStorage.getItem('capitae_profile_guest_user');
        if (cached) {
          setProfile(JSON.parse(cached));
        } else {
          setProfile({
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
          });
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
        setProfile({
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
        });
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
      
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    } catch (error: any) {
      alert('Erro ao salvar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);

      if (user.id === 'guest_user') {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setProfile(prev => {
            const updated = { ...prev, avatar_url: base64String };
            localStorage.setItem('capitae_profile_guest_user', JSON.stringify(updated));
            return updated;
          });
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      
      // Auto-save the new avatar URL to profile
      await supabase.from('profiles').update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);

    } catch (error: any) {
      alert('Erro ao fazer upload: ' + error.message);
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
      // Fallback reload in case of any issues
      window.location.reload();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

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
        setPasswordError('Calma lá! Você atingiu o limite de tentativas de autenticação. Aguarde um momento antes de tentar novamente.');
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
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-bold">{profile.display_name || 'Seu Nome'}</h3>
            {isPro ? (
              <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full border border-primary/20">
                Pro
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-foreground/10 text-muted text-[10px] font-bold uppercase tracking-widest rounded-full border border-foreground/10">
                Teste Grátis
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20 uppercase tracking-widest">
              {profile.level || 'Sobrevivente'}
            </span>
            <span className="text-xs text-muted flex items-center gap-1">
              <Mail className="w-3 h-3" /> {userEmail}
            </span>
          </div>
          
          {!isPro && (
            <button 
              onClick={onUpgrade}
              className="mt-4 px-6 py-2 bg-primary text-background rounded-xl font-bold text-xs shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mx-auto hover:scale-[1.02] transition-all"
            >
              <Zap className="w-3 h-3 fill-background" />
              Seja Pro por R$ 14,90/mês
            </button>
          )}
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
          Suas informações de perfil são privadas e usadas apenas para personalizar sua experiência no Capitae e ajudar o Capy a te dar conselhos melhores.
        </p>
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
      </AnimatePresence>
    </motion.div>
  );
}

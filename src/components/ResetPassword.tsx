import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { KeyRound, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

interface ResetPasswordProps {
  onClose: () => void;
}

export default function ResetPassword({ onClose }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      localStorage.removeItem('is_recovery_mode');
      setSuccess(true);
      // Wait shortly, then call onClose to transition cleanly to the logged-in dashboard
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Erro ao tentar atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 bg-secondary border border-white/5 p-8 rounded-3xl"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tighter text-primary">Nova Senha</h1>
          <p className="mt-2 text-muted text-sm">
            Crie sua nova senha de acesso e recupere o controle da sua conta Capitae.
          </p>
        </div>

        {success ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-6 text-center space-y-4"
          >
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Senha atualizada!</h3>
              <p className="text-sm text-muted">
                Sua senha foi redefinida com sucesso. Você será redirecionado para o seu painel financeiro.
              </p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {error && (
              <div className="p-3 text-sm bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Nova Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-white/5 rounded-xl focus:outline-none focus:border-primary transition-colors text-white"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-white/5 rounded-xl focus:outline-none focus:border-primary transition-colors text-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  <span>Salvar Nova Senha</span>
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

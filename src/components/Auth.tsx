import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Loader2, Chrome, Mail, ArrowLeft, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  console.log('Auth: Rendering...');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        });
        if (error) throw error;
        setSuccess('Link de recuperação enviado! Verifique sua caixa de entrada.');
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
        setSuccess('Link de confirmação enviado com sucesso! Por favor, verifique sua caixa de entrada e também a pasta de Lixo Eletrônico/Spam.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      const rawMessage = err.message || '';
      const lower = rawMessage.toLowerCase();
      const status = err.status;

      const isRateLimit = lower.includes('rate limit') || lower.includes('limit exceeded') || lower.includes('too many requests') || lower.includes('once every') || status === 429;
      const isInvalidCreds = lower.includes('invalid credentials') || lower.includes('email or password');
      const isAlreadyRegistered = lower.includes('already exists') || lower.includes('registered');
      const isEmailNotConfirmed = lower.includes('email not confirmed') || lower.includes('confirm your email') || lower.includes('confirm email') || lower.includes('unconfirmed');

      if (isRateLimit || isInvalidCreds || isAlreadyRegistered || isEmailNotConfirmed) {
        // Log expected system states as warning/info instead of scary uncaught errors
        console.warn('Auth state handled gracefully:', rawMessage);
      } else {
        console.error('Auth error detailed:', err);
      }

      if (isRateLimit) {
        setError('Calma lá, você atingiu o limite de tentativas, tente novamente em 1h. Em breve estaremos melhorando esse serviço!');
      } else if (isEmailNotConfirmed) {
        setError('E-mail não confirmado! Por segurança, é necessário confirmar seu e-mail antes de fazer login. Verifique sua pasta de Spam ou Lixo Eletrônico.');
      } else if (isInvalidCreds) {
        setError('E-mail ou senha incorretos. Por favor, verifique suas credenciais.');
      } else if (isAlreadyRegistered) {
        setError('Este e-mail já está associado a uma conta ativa. Tente fazer o login.');
      } else {
        setError(err.message || 'Ocorreu um erro inesperado.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) throw error;

      if (data?.url) {
        const authWindow = window.open(
          data.url,
          'capitae_google_oauth',
          'width=500,height=600,resizable=yes,scrollbars=yes,status=yes'
        );

        if (!authWindow) {
          setError('O popup de login foi bloqueado. Por favor, libere popups neste navegador para logar com o Google.');
        }
      } else {
        throw new Error('Não foi possível obter a URL de autenticação do Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao tentar conectar com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090B] text-zinc-100 dark">
      <motion.div 
        key={isForgotPassword ? 'forgot-form' : (isSignUp ? 'signup-form' : 'signin-form')}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <motion.img
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 12 }}
            src="/icon.png"
            alt="Logo"
            className="w-20 h-20 rounded-2xl shadow-2xl shadow-emerald-500/10 border border-white/10 mx-auto mb-6 object-cover select-none pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-4xl font-bold tracking-tighter text-primary">Capitae Business</h1>
          <p className="mt-2 text-zinc-400 font-medium">
            <span>
              {isForgotPassword 
                ? 'Recupere sua senha com facilidade' 
                : 'Sua liberdade financeira começa aqui.'}
            </span>
          </p>
        </div>

        <form onSubmit={handleAuth} className="mt-8 space-y-4">
          {error && (
            <motion.div 
              key="error-msg" 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 text-xs sm:text-sm bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div 
              key="success-msg" 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 text-xs sm:text-sm bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="leading-relaxed">{success}</span>
            </motion.div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300"><span>Email</span></label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-white placeholder-zinc-500 transition-all"
              placeholder="seu@email.com"
            />
          </div>

          {!isForgotPassword && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-zinc-300"><span>Senha</span></label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccess(null);
                      setIsForgotPassword(true);
                    }}
                    className="text-xs text-zinc-400 hover:text-primary transition-colors focus:outline-none cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-3 bg-zinc-900 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-white placeholder-zinc-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-zinc-950 font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/5 active:scale-[0.98] transition-transform"
          >
            {loading ? (
              <Loader2 key="loader-icon" className="w-5 h-5 animate-spin" />
            ) : isForgotPassword ? (
              <React.Fragment key="forgot-content">
                <Mail className="w-5 h-5" />
                <span>Enviar Link de Recuperação</span>
              </React.Fragment>
            ) : isSignUp ? (
              <React.Fragment key="signup-content">
                <UserPlus className="w-5 h-5" />
                <span>Criar Conta</span>
              </React.Fragment>
            ) : (
              <React.Fragment key="signin-content">
                <LogIn className="w-5 h-5" />
                <span>Entrar</span>
              </React.Fragment>
            )}
          </button>
        </form>

        {!isForgotPassword && (
          <div className="space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <span className="relative px-3 bg-[#09090B] text-zinc-500 text-[11px] font-bold uppercase tracking-widest">
                Ou continue com
              </span>
            </div>

            <button
              type="button"
              disabled={googleLoading || loading}
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 border border-white/10 hover:border-white/20 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] cursor-pointer"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.13-.33-.23-.67-.32-1.02z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>Entrar com o Google</span>
            </button>
          </div>
        )}

        {isForgotPassword ? (
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setError(null);
                setSuccess(null);
                setIsForgotPassword(false);
              }}
              className="text-sm text-zinc-400 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para o Login</span>
            </button>
          </div>
        ) : (
          <>
            <div className="text-center pt-2 flex flex-col gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setIsSignUp(!isSignUp);
                }}
                className="text-xs text-zinc-400 hover:text-primary transition-colors focus:outline-none cursor-pointer"
              >
                {isSignUp ? (
                  <span key="goto-login">Já tem uma conta? Entre</span>
                ) : (
                  <span key="goto-signup">Não tem uma conta? Cadastre-se</span>
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

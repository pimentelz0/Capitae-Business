import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Sparkles, Check, Info } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [browserSupportError, setBrowserSupportError] = useState(false);

  useEffect(() => {
    // 1. Detect if running in standalone mode (already installed & opened on home screen)
    const checkStandalone = () => {
      if (typeof window === 'undefined') return false;
      const isStandaloneMed = window.matchMedia('(display-mode: standalone)').matches;
      const isNavStandalone = (navigator as any).standalone === true;
      return isStandaloneMed || isNavStandalone;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);

    // 2. If it's already running as installed app, never show the prompt
    if (standalone) {
      setShowPrompt(false);
      return;
    }

    // 3. Always show prompt immediately when opened on a web browser
    setShowPrompt(true);

    // 4. Capture browser's native install trigger event (such as on Chrome/Edge/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Track successful installation
    const handleAppInstalled = () => {
      setInstalledSuccess(true);
      setShowPrompt(false);
      setIsStandalone(true);
      setDeferredPrompt(null);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // In browsers where the automatic 'beforeinstallprompt' is not supported or hasn't fired yet
      // (like Firefox, desktop Safari, iOS browsers), we display a friendly native warning.
      setBrowserSupportError(true);
      setTimeout(() => setBrowserSupportError(false), 6000);
      return;
    }

    try {
      // Trigger native browser install dialog directly with 1-click
      deferredPrompt.prompt();

      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA PWAInstallPrompt: User choice was: ${outcome}`);

      if (outcome === 'accepted') {
        setInstalledSuccess(true);
        setShowPrompt(false);
        setIsStandalone(true);
        setDeferredPrompt(null);
        setTimeout(() => setInstalledSuccess(false), 5000);
      }
    } catch (err) {
      console.error('Error invoking native prompt:', err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (isStandalone && !installedSuccess) return null;
  if (!showPrompt && !installedSuccess) return null;

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[380px] z-50">
      <AnimatePresence>
        {/* Success toast */}
        {installedSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-primary/95 text-background font-bold p-4 rounded-2xl flex items-center gap-3 shadow-[0_10px_30px_rgba(0,200,83,0.3)] backdrop-blur-md"
          >
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-background stroke-[3px]" />
            </div>
            <div>
              <p className="text-sm font-extrabold leading-none">Business Instalado!</p>
              <p className="text-xs font-semibold opacity-80 mt-1">Aproveite seu app na tela de início.</p>
            </div>
          </motion.div>
        )}

        {/* The main install trigger prompt */}
        {showPrompt && !installedSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="relative overflow-hidden bg-[#161616]/95 border border-white/10 rounded-[2rem] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col gap-4"
            id="pwa-prompt-container"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary border border-primary/10 shrink-0">
                <Smartphone className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5">
                  Business no Celular
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                </h4>
                <p className="text-xs text-neutral-400 mt-1 leading-snug">
                  Adicione o Capitae Business diretamente à sua tela inicial sem precisar abrir lojas de aplicativos.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform restriction explanation helper info */}
            {browserSupportError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-xl flex items-start gap-2"
              >
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="leading-normal">
                  Siga pelo menu do seu navegador (como os três pontinhos no Chrome ou "Compartilhar" no Safari) e escolha a opção <strong>"Adicionar à tela de início"</strong>.
                </span>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold py-3.5 rounded-xl text-neutral-300 transition-colors"
              >
                Agora Não
              </button>
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-[2] bg-primary text-background hover:bg-primary/95 text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,200,83,0.15)] animate-bounce-short"
                id="btn-install-pwa"
              >
                <Download className="w-4 h-4 text-background" />
                <span>Instalar Aplicativo</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

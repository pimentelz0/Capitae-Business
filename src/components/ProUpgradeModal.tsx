import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Zap, TrendingUp, MessageSquare, PiggyBank, Star } from 'lucide-react';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export default function ProUpgradeModal({ isOpen, onClose, onUpgrade }: ProUpgradeModalProps) {
  if (!isOpen) return null;

  const benefits = [
    {
      icon: <TrendingUp className="w-5 h-5 text-primary" />,
      title: "Previsões Financeiras (Forecast)",
      description: "Saiba exatamente quando o seu dinheiro vai acabar com base nos seus hábitos."
    },
    {
      icon: <PiggyBank className="w-5 h-5 text-primary" />,
      title: "Caixinhas Ilimitadas",
      description: "Crie quantas metas quiser para organizar toda a sua vida financeira."
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-primary" />,
      title: "Capy (IA) Ilimitado",
      description: "Consultoria financeira 24h sem limite mensal de mensagens."
    },
    {
      icon: <Star className="w-5 h-5 text-primary" />,
      title: "Personalização Exclusiva",
      description: "Acesso a temas e itens raros na loja que só assinantes podem comprar."
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-secondary border border-foreground/10 rounded-[32px] overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="relative h-28 sm:h-36 bg-primary flex items-center justify-center overflow-hidden shrink-0">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            </div>
            <Zap className="w-14 h-14 sm:w-16 sm:h-16 text-background relative z-10" />
            <button 
              onClick={onClose}
              className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 bg-background/20 hover:bg-background/30 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-background" />
            </button>
          </div>

          <div className="p-5 sm:p-8 space-y-5 sm:space-y-8 overflow-y-auto flex-1 scrollbar-thin">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Capitae Pro</h2>
              <p className="text-xs sm:text-sm text-muted">Desbloqueie todo o potencial da sua vida financeira.</p>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-background/50 border border-foreground/5">
                  <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    {benefit.icon}
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <h4 className="text-xs sm:text-sm font-bold">{benefit.title}</h4>
                    <p className="text-[11px] sm:text-xs text-muted leading-relaxed">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 sm:pt-4 space-y-3 sm:space-y-4">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold">R$ 14,90<span className="text-xs sm:text-sm text-muted font-normal">/mês</span></p>
                <p className="text-[10px] text-muted uppercase font-bold tracking-widest mt-1">Cancele quando quiser</p>
              </div>

              <button 
                onClick={() => {
                  // In a real app, this would redirect to a checkout page (Stripe, etc.)
                  // For now, we'll just show a message or handle it via a callback
                  if (onUpgrade) onUpgrade();
                  window.open('https://pay.kiwify.com.br/mnejSlT', '_blank');
                }}
                className="w-full py-3.5 sm:py-4 bg-primary text-background rounded-2xl font-bold text-base sm:text-lg shadow-[0_0_20px_rgba(0,200,83,0.4)] hover:shadow-[0_0_30px_rgba(0,200,83,0.6)] transition-all active:scale-95"
              >
                Assinar Agora
              </button>
              
              <p className="text-[9px] sm:text-[10px] text-center text-muted px-4 sm:px-8">
                Ao assinar, você concorda com nossos Termos de Uso e Política de Privacidade.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Check, Wallet, TrendingUp, MessageSquare, Zap, Target } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Bem-vindo ao Capitae!",
      description: "O seu novo parceiro na jornada para a liberdade financeira. Vamos te mostrar como tirar o melhor proveito do app.",
      icon: <Zap className="w-12 h-12 text-primary" />,
      color: "bg-primary/10"
    },
    {
      title: "Controle Total",
      description: "Registre seus gastos e ganhos de forma simples. O Capitae organiza tudo para você entender para onde seu dinheiro está indo.",
      icon: <Wallet className="w-12 h-12 text-blue-500" />,
      color: "bg-blue-500/10"
    },
    {
      title: "Caixinhas e Metas",
      description: "Crie caixinhas para seus sonhos. O Capitae ajuda você a poupar de forma inteligente para atingir seus objetivos mais rápido.",
      icon: <Target className="w-12 h-12 text-purple-500" />,
      color: "bg-purple-500/10"
    },
    {
      title: "Conheça o Capy",
      description: "Nossa IA financeira está sempre pronta para te dar conselhos, tirar dúvidas e ajudar no seu planejamento diário.",
      icon: <MessageSquare className="w-12 h-12 text-green-500" />,
      color: "bg-green-500/10"
    },
    {
      title: "Previsões do Futuro",
      description: "Com o Forecast, você sabe exatamente como estará seu saldo no final do mês com base nos seus hábitos atuais.",
      icon: <TrendingUp className="w-12 h-12 text-yellow-500" />,
      color: "bg-yellow-500/10"
    }
  ];

  if (!isOpen) return null;

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-secondary border border-foreground/10 rounded-[40px] overflow-hidden shadow-2xl"
        >
          <div className="p-8 space-y-8">
            {/* Progress Bar */}
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    i <= step ? 'bg-primary' : 'bg-foreground/10'
                  }`} 
                />
              ))}
            </div>

            {/* Content */}
            <div className="flex flex-col items-center text-center space-y-6 py-4">
              <motion.div 
                key={step}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`w-24 h-24 ${steps[step].color} rounded-[32px] flex items-center justify-center`}
              >
                {steps[step].icon}
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">{steps[step].title}</h2>
                <p className="text-muted text-sm leading-relaxed">
                  {steps[step].description}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4">
              <button 
                onClick={prevStep}
                className={`p-4 rounded-2xl border border-foreground/5 text-muted hover:bg-foreground/5 transition-all ${
                  step === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button 
                onClick={nextStep}
                className="flex-1 ml-4 py-4 bg-primary text-background rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(0,200,83,0.4)] transition-all active:scale-95"
              >
                {step === steps.length - 1 ? (
                  <>Começar Agora <Check className="w-5 h-5" /></>
                ) : (
                  <>Próximo <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

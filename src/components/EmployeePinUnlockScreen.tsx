import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Delete, ShieldAlert, CheckCircle, Smartphone } from 'lucide-react';

const hashPIN = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "capitae_salt_2026");
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface EmployeePinUnlockScreenProps {
  pinHash: string;
  onUnlock: () => void;
}

export default function EmployeePinUnlockScreen({ pinHash, onUnlock }: EmployeePinUnlockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState(false);

  // Monitor hardware keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (success) return;
      
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          setPin(prev => prev + e.key);
          setError(false);
        }
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        setError(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, success]);

  // Check pin when it reaches 4 digits
  useEffect(() => {
    if (pin.length === 4) {
      verifyPin();
    }
  }, [pin]);

  const verifyPin = async () => {
    const enteredHash = await hashPIN(pin);
    
    if (enteredHash === pinHash) {
      setSuccess(true);
      setTimeout(() => {
        onUnlock();
      }, 700);
    } else {
      setError(true);
      setShaking(true);
      // Reset shaking after animation completes
      setTimeout(() => setShaking(false), 500);
      // Clear PIN with a brief delay so they see the 4th dot
      setTimeout(() => setPin(''), 600);
    }
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !success) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !success) {
      setPin(prev => prev.slice(0, -1));
      setError(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8 animate-fadeIn">
      <motion.div
        animate={shaking ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm bg-secondary p-8 rounded-[36px] border border-foreground/5 shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden"
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

        {/* Dynamic header icon */}
        <div className="relative">
          {success ? (
            <motion.div 
              initial={{ scale: 0.5 }} 
              animate={{ scale: 1 }} 
              className="w-16 h-16 bg-emerald-500/10 text-[#00E676] rounded-2xl flex items-center justify-center border border-emerald-500/10"
            >
              <CheckCircle className="w-8 h-8" />
            </motion.div>
          ) : error ? (
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center border border-red-500/10 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/10">
              <Lock className="w-8 h-8" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-white">Área Restrita</h3>
          <p className="text-xs text-muted max-w-[260px] leading-relaxed mx-auto">
            Este painel está bloqueado pelo <strong>Modo Funcionário</strong>. Digite o PIN de 4 dígitos para acessar nesta sessão.
          </p>
        </div>

        {/* DOTS Indicator */}
        <div className="flex justify-center gap-4 py-2">
          {[0, 1, 2, 3].map(index => (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                pin.length > index
                  ? success 
                    ? 'bg-[#00E676] border-[#00E676] scale-110 drop-shadow-[0_0_6px_rgba(0,230,118,0.5)]'
                    : error 
                      ? 'bg-red-500 border-red-500' 
                      : 'bg-primary border-primary scale-110 drop-shadow-[0_0_6px_rgba(0,200,83,0.5)]'
                  : 'bg-background border-white/10'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-[11px] font-black text-red-500 uppercase tracking-widest animate-bounce">
            PIN Inválido! Tente novamente.
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[270px] pt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleNumberClick(num)}
              className="py-3.5 rounded-2xl bg-background border border-foreground/5 hover:border-primary/20 text-white font-extrabold text-lg flex items-center justify-center transition-all active:scale-95 hover:bg-foreground/5 cursor-pointer"
            >
              {num}
            </button>
          ))}
          
          {/* Empty Space or Action */}
          <div className="flex items-center justify-center text-muted select-none">
            <Smartphone className="w-4 h-4 opacity-35" />
          </div>

          <button
            type="button"
            onClick={() => handleNumberClick('0')}
            className="py-3.5 rounded-2xl bg-background border border-foreground/5 hover:border-primary/20 text-white font-extrabold text-lg flex items-center justify-center transition-all active:scale-95 hover:bg-foreground/5 cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="py-3.5 rounded-2xl bg-background/50 text-muted hover:text-white flex items-center justify-center transition-all active:scale-95 hover:bg-foreground/5 cursor-pointer border border-transparent"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[9px] text-muted tracking-wide capitalize font-mono pt-2">
          Também pode digitar usando o teclado numérico
        </p>
      </motion.div>
    </div>
  );
}

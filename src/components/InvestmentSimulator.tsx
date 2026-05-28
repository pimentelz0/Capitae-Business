import React, { useState } from 'react';

export function InvestmentSimulator() {
  const [initial, setInitial] = useState(1000);
  const [monthly, setMonthly] = useState(200);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(10);

  const calculate = () => {
    let total = initial;
    const monthlyRate = Math.pow(1 + (rate / 100), 1 / 12) - 1;
    const months = years * 12;

    for (let i = 0; i < months; i++) {
      total = (total + monthly) * (1 + monthlyRate);
    }
    return total;
  };

  const totalInvested = initial + (monthly * years * 12);
  const total = calculate();
  const profit = total - totalInvested;

  return (
    <div className="bg-secondary p-6 rounded-3xl border border-foreground/5 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted uppercase font-bold">Quanto tem hoje?</label>
          <input 
            type="number" 
            value={initial || ''} 
            onChange={e => setInitial(e.target.value === '' ? 0 : Number(e.target.value))} 
            className="w-full bg-background border border-foreground/5 p-3 rounded-xl outline-none" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted uppercase font-bold">Guardar por mês</label>
          <input 
            type="number" 
            value={monthly || ''} 
            onChange={e => setMonthly(e.target.value === '' ? 0 : Number(e.target.value))} 
            className="w-full bg-background border border-foreground/5 p-3 rounded-xl outline-none" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted uppercase font-bold">Anos</label>
          <input 
            type="number" 
            value={years || ''} 
            onChange={e => setYears(e.target.value === '' ? 0 : Number(e.target.value))} 
            className="w-full bg-background border border-foreground/5 p-3 rounded-xl outline-none" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted uppercase font-bold">Rendimento (%)</label>
          <input 
            type="number" 
            value={rate || ''} 
            onChange={e => setRate(e.target.value === '' ? 0 : Number(e.target.value))} 
            className="w-full bg-background border border-foreground/5 p-3 rounded-xl outline-none" 
          />
        </div>
      </div>

      <div className="pt-6 border-t border-foreground/5 space-y-2">
        <p className="text-sm text-muted">No final, você terá:</p>
        <h2 className="text-3xl font-bold text-primary">R$ {total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</h2>
        <div className="flex justify-between text-xs font-bold pt-2">
          <span className="text-muted">Total investido: R$ {totalInvested.toLocaleString('pt-BR')}</span>
          <span className="text-primary">Lucro em juros: R$ {profit.toLocaleString('pt-BR')}</span>
        </div>
      </div>
    </div>
  );
}

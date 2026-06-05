import React, { useState } from 'react';
import { Produto, Transacao } from '../types';
import { ShoppingCart, Plus, Minus, Search, Tag, Check, CreditCard, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PDVProps {
  produtos: Produto[];
  onAddTransacao: (transacao: Omit<Transacao, 'id'> | Omit<Transacao, 'id'>[]) => void;
  onUpdateProdutoQuantidade: (id: string, novaQuantidade: number) => void;
  isPrivateMode: boolean;
}

export default function PDV({ produtos, onAddTransacao, onUpdateProdutoQuantidade, isPrivateMode }: PDVProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<{ produto: Produto; qtd: number }[]>([]);
  const [discount, setDiscount] = useState<number>(0); // Discount in percentage
  const [meioPagamento, setMeioPagamento] = useState<string>('Pix');
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [recentTotal, setRecentTotal] = useState(0);

  // Revenda Rápida States
  const [pdvMode, setPdvMode] = useState<'estoque' | 'revenda'>('estoque');
  const [revendaNome, setRevendaNome] = useState('');
  const [revendaCusto, setRevendaCusto] = useState<number | ''>('');
  const [revendaVenda, setRevendaVenda] = useState<number | ''>('');
  const [revendaQtd, setRevendaQtd] = useState<number>(1);
  const [revendaMeio, setRevendaMeio] = useState<string>('Pix');

  // Categories extraction
  const categories = ['Todos', ...Array.from(new Set(produtos.map(p => p.categoria)))];

  // Filter products
  const filteredProducts = produtos.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.categoria.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart operations
  const addToCart = (produto: Produto) => {
    const existing = cart.find(item => item.produto.id === produto.id);
    const currentQtdInCart = existing ? existing.qtd : 0;

    if (currentQtdInCart >= produto.quantidade) {
      alert(`Quantidade máxima em estoque atingida para ${produto.nome} (${produto.quantidade} un)`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => 
        item.produto.id === produto.id ? { ...item, qtd: item.qtd + 1 } : item
      ));
    } else {
      setCart([...cart, { produto, qtd: 1 }]);
    }
  };

  const updateCartQtd = (produtoId: string, delta: number) => {
    const item = cart.find(i => i.produto.id === produtoId);
    if (!item) return;

    const targetQty = item.qtd + delta;
    if (targetQty <= 0) {
      setCart(cart.filter(i => i.produto.id !== produtoId));
      return;
    }

    const available = item.produto.quantidade;
    if (targetQty > available) {
      alert(`Quantidade máxima em estoque atingida para ${item.produto.nome} (${available} un)`);
      return;
    }

    setCart(cart.map(i => 
      i.produto.id === produtoId ? { ...i, qtd: targetQty } : i
    ));
  };

  const removeFromCart = (produtoId: string) => {
    setCart(cart.filter(i => i.produto.id !== produtoId));
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.produto.preco_venda * item.qtd), 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = Math.max(0, subtotal - discountAmount);
  const totalCustoEstoque = cart.reduce((acc, item) => acc + ((item.produto.preco_custo || 0) * item.qtd), 0);

  // Finalize sale
  const handleFinalizeSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    // Build sale descriptions
    const itemsDescription = cart.map(item => `${item.qtd}x ${item.produto.nome}`).join(', ');
    const descriptionText = `Venda PDV: ${itemsDescription}`;

    // Update stocks
    cart.forEach(item => {
      onUpdateProdutoQuantidade(item.produto.id, item.produto.quantidade - item.qtd);
    });

    // Create single unified entry transaction with integrated product cost and items metadata
    const transacaoUnica: Omit<Transacao, 'id'> = {
      tipo: 'entrada',
      descricao: descriptionText,
      valor: total,
      categoria: 'Vendas (PDV)',
      data: new Date().toISOString().split('T')[0],
      tipo_registro: 'imediato',
      status: 'pago',
      meio_pagamento: meioPagamento,
      custo_venda: totalCustoEstoque,
      itens_venda: cart.map(item => ({
        produto_id: item.produto.id,
        qtd: item.qtd,
        nome: item.produto.nome
      }))
    };

    onAddTransacao(transacaoUnica);

    setRecentTotal(total);
    setCart([]);
    setDiscount(0);
    setSaleSuccess(true);
    setTimeout(() => setSaleSuccess(false), 3000);
  };

  // Finalizar Revenda Rápida (sem estoque)
  const handleFinalizeRevenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revendaNome.trim()) {
      alert('Por favor, informe o nome do produto.');
      return;
    }
    const valorVenda = Number(revendaVenda);
    if (!valorVenda || valorVenda <= 0) {
      alert('Por favor, informe um preço de revenda válido.');
      return;
    }

    const valorCusto = Number(revendaCusto) || 0;
    const totalVendaFinal = valorVenda * revendaQtd;
    const totalCustoFinal = valorCusto * revendaQtd;

    // Create a single entry transaction with integrated product cost
    const transacaoUnica: Omit<Transacao, 'id'> = {
      tipo: 'entrada',
      descricao: `[Revenda Direta] ${revendaQtd}x ${revendaNome} (Venda: R$ ${valorVenda.toFixed(2)} un)`,
      valor: totalVendaFinal,
      categoria: 'Vendas (PDV)',
      data: new Date().toISOString().split('T')[0],
      tipo_registro: 'imediato',
      status: 'pago',
      meio_pagamento: revendaMeio,
      custo_venda: totalCustoFinal
    };

    onAddTransacao(transacaoUnica);

    setRecentTotal(totalVendaFinal);
    setSaleSuccess(true);

    // Limpar formulário de revenda
    setRevendaNome('');
    setRevendaCusto('');
    setRevendaVenda('');
    setRevendaQtd(1);

    setTimeout(() => setSaleSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Visual Header / Caixa Banner */}
      <div className="relative overflow-hidden bg-secondary border border-foreground/5 p-6 rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-2 inline-block">
            Frente de Caixa
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Venda Rápida</h1>
          <p className="text-xs text-muted mt-1">Abata estoque e lance no caixa diário em segundos.</p>
        </div>
        <div className="bg-background/40 hover:bg-background/60 p-4 rounded-2xl border border-foreground/5 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Produtos Cadastrados</p>
            <p className="text-base font-extrabold text-foreground">{produtos.length} itens</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {saleSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-5 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Check className="w-5 h-5 text-background font-bold" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Venda finalizada com sucesso!</p>
                <p className="text-xs text-primary font-medium">R$ {recentTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} adicionado ao caixa.</p>
              </div>
            </div>
            <button 
              onClick={() => setSaleSuccess(false)}
              className="text-xs text-muted font-bold hover:text-white"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Product Selector or Resale Form */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Sub-tabs to choose either Product Sales or Quick Direct Resale */}
          <div className="flex bg-background/40 p-1.5 rounded-2xl border border-foreground/5 gap-1">
            <button
              type="button"
              onClick={() => setPdvMode('estoque')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                pdvMode === 'estoque'
                  ? 'bg-secondary text-white shadow-sm border border-foreground/5'
                  : 'text-muted hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-primary" />
              Vender do Estoque
            </button>
            <button
              type="button"
              onClick={() => setPdvMode('revenda')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                pdvMode === 'revenda'
                  ? 'bg-secondary text-white shadow-sm border border-foreground/5'
                  : 'text-muted hover:text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              Revenda Rápida (Sem Estoque)
            </button>
          </div>

          {pdvMode === 'estoque' ? (
            <>
              <div className="bg-secondary border border-foreground/5 p-4 rounded-3xl space-y-3">
                {/* Search and Filters */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input 
                    type="text"
                    placeholder="Pesquisar produto pelo nome ou categoria..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-background border border-foreground/5 pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none focus:border-primary transition-all text-white placeholder-muted"
                  />
                </div>

                {/* Category tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        selectedCategory === cat 
                          ? 'bg-primary text-background' 
                          : 'bg-background hover:bg-foreground/5 text-muted hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Cards List */}
              <div className="flex flex-col gap-2">
                {filteredProducts.length === 0 ? (
                  <div className="bg-secondary/50 border border-dashed border-foreground/5 p-12 rounded-3xl text-center text-muted">
                    <AlertCircle className="w-10 h-10 text-muted/40 mx-auto mb-3" />
                    <p className="text-sm font-medium">Nenhum produto encontrado.</p>
                    <p className="text-xs mt-1">Adicione itens no Controle de Estoque primeiro.</p>
                  </div>
                ) : (
                  filteredProducts.map(p => {
                    const isOutOfStock = p.quantidade <= 0;
                    const isLowStock = p.quantidade <= p.estoque_minimo && !isOutOfStock;
                    
                    return (
                      <motion.button
                        disabled={isOutOfStock}
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        whileTap={{ scale: isOutOfStock ? 1 : 0.99 }}
                        className={`group w-full bg-secondary border text-left p-3.5 px-4 rounded-2xl flex items-center justify-between transition-all gap-4 ${
                          isOutOfStock 
                            ? 'opacity-40 border-foreground/5 cursor-not-allowed' 
                            : 'border-foreground/5 hover:border-primary/20 hover:bg-foreground/5 cursor-pointer'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[9px] uppercase font-bold text-muted bg-background/60 px-2 py-0.5 rounded-md">
                              {p.categoria}
                            </span>
                            {isLowStock && (
                              <span className="text-[9px] text-yellow-500 font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                Estoque Baixo
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-foreground truncate">{p.nome}</h4>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-base font-extrabold text-primary">
                              R$ {isPrivateMode ? '•••' : p.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {isOutOfStock ? (
                              <span className="text-[9px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                Sem Estoque
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-muted">
                                Qtd: {p.quantidade} un
                              </span>
                            )}
                          </div>
                          
                          <div className="w-8 h-8 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-background rounded-xl flex items-center justify-center transition-colors shrink-0">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Revenda Rápida Direct Mode Form */
            <form onSubmit={handleFinalizeRevenda} className="bg-secondary border border-foreground/5 p-6 rounded-[32px] space-y-6">
              <div>
                <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  Nova Revenda sem Estoque
                </h3>
                <p className="text-xs text-muted mt-1">Lançamento direto de produtos de oportunidade sem precisar atualizar o estoque.</p>
              </div>

              <div className="space-y-4">
                {/* Nome do Produto */}
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase tracking-wider block">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Camiseta Importada Revenda"
                    value={revendaNome}
                    onChange={(e) => setRevendaNome(e.target.value)}
                    className="w-full bg-background border border-foreground/5 px-4 py-3.5 rounded-2xl text-sm outline-none focus:border-primary transition-all text-white placeholder-muted"
                  />
                </div>

                {/* Custo e Venda */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-wider block">Custo de Compra (un)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={revendaCusto || ''}
                        onChange={(e) => setRevendaCusto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full bg-background border border-foreground/5 pl-10 pr-4 py-3.5 rounded-2xl text-sm outline-none focus:border-primary transition-all text-white font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-wider block">Preço de Revenda (un)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-primary">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0,00"
                        value={revendaVenda || ''}
                        onChange={(e) => setRevendaVenda(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full bg-background border border-foreground/5 pl-10 pr-4 py-3.5 rounded-2xl text-sm outline-none focus:border-primary transition-all text-primary font-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Profit Margin Calculations Info Box */}
                {revendaVenda !== '' && revendaVenda > 0 && (
                  <div className="p-4 bg-background/40 border border-foreground/5 rounded-2xl grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Lucro Unitário</p>
                      <p className="text-sm font-black text-primary mt-1">
                        R$ {isPrivateMode ? '•••' : (Number(revendaVenda) - (Number(revendaCusto) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Margem de Lucro</p>
                      <p className="text-sm font-black text-[#00C853] mt-1">
                        {(() => {
                          const c = Number(revendaCusto) || 0;
                          const v = Number(revendaVenda);
                          if (v <= 0) return '0%';
                          return `${Math.round(((v - c) / v) * 100)}%`;
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Markup / Retorno</p>
                      <p className="text-sm font-black text-blue-400 mt-1">
                        {(() => {
                          const c = Number(revendaCusto) || 0;
                          const v = Number(revendaVenda);
                          if (c <= 0) return '100%';
                          return `${Math.round(((v - c) / c) * 100)}%`;
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quantidade e Meio de Pagamento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-wider block">Quantidade</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRevendaQtd(Math.max(1, revendaQtd - 1))}
                        className="w-11 h-11 bg-background text-muted hover:text-white rounded-xl flex items-center justify-center border border-foreground/5"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex-1 bg-background rounded-xl border border-foreground/5 h-11 flex items-center justify-center text-sm font-extrabold text-white">
                        {revendaQtd}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRevendaQtd(revendaQtd + 1)}
                        className="w-11 h-11 bg-background text-muted hover:text-white rounded-xl flex items-center justify-center border border-foreground/5"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase tracking-wider block">Meio de Pagamento</label>
                    <select
                      value={revendaMeio}
                      onChange={(e) => setRevendaMeio(e.target.value)}
                      className="w-full h-11 bg-background border border-foreground/5 px-4 rounded-xl text-sm text-foreground outline-none focus:border-primary transition-all font-bold"
                    >
                      <option value="Pix">Pix</option>
                      <option value="Cartão">Cartão</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Total and Launch Button */}
              <div className="pt-4 border-t border-foreground/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-xs text-muted font-bold uppercase tracking-wider block">Valor Total Recebido</span>
                  <p className="text-2xl font-black text-primary">
                    R$ {isPrivateMode ? '•••' : ((Number(revendaVenda) || 0) * revendaQtd).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3.5 bg-primary hover:bg-opacity-95 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-[0_4px_20px_rgba(0,200,83,0.25)] flex items-center justify-center gap-2 active:scale-98"
                >
                  <Check className="w-4 h-4 font-black" />
                  Lançar Revenda
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Right Side: Cart / Checkout (5 cols) */}
        <div className="lg:col-span-5">
          <form onSubmit={handleFinalizeSale} className="bg-secondary border border-foreground/5 rounded-[32px] p-6 space-y-6 sticky top-24">
            <div className="flex justify-between items-center pb-2 border-b border-foreground/5">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-white">Carrinho de Compras</h3>
              </div>
              {cart.length > 0 && (
                <button 
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-500 hover:underline font-bold"
                >
                  Esvaziar
                </button>
              )}
            </div>

            {/* Cart Items */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-muted">
                  <p className="text-sm">O carrinho está vazio.</p>
                  <p className="text-xs mt-1">Selecione produtos ao lado.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.produto.id} className="flex justify-between items-center p-3 bg-background/50 border border-foreground/5 rounded-2xl">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-xs text-muted truncate">{item.produto.categoria}</p>
                      <h4 className="text-sm font-bold text-white truncate">{item.produto.nome}</h4>
                      <p className="text-xs text-primary font-bold mt-0.5">
                        R$ {isPrivateMode ? '•••' : item.produto.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateCartQtd(item.produto.id, -1)}
                        className="w-7 h-7 bg-background text-muted hover:text-white rounded-lg flex items-center justify-center border border-foreground/5"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-bold text-white w-6 text-center">{item.qtd}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQtd(item.produto.id, 1)}
                        className="w-7 h-7 bg-background text-muted hover:text-white rounded-lg flex items-center justify-center border border-foreground/5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Price Calculations */}
            {cart.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-foreground/5">
                <div className="flex justify-between text-xs text-muted font-medium">
                  <span>Subtotal</span>
                  <span>R$ {isPrivateMode ? '•••' : subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center gap-3 bg-background/40 p-3 rounded-2xl border border-foreground/5">
                  <Tag className="w-4 h-4 text-primary" />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-xs text-muted font-bold">Desconto (%)</span>
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      value={discount || ''}
                      onChange={(e) => setDiscount(e.target.value === '' ? 0 : Math.min(100, Math.max(0, parseInt(e.target.value))))}
                      className="w-16 bg-background rounded-lg border border-foreground/5 py-1 text-center font-bold text-primary focus:border-primary outline-none text-xs"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Payment Selection */}
                <div className="space-y-2">
                  <span className="text-xs text-muted font-bold uppercase tracking-wider">Meio de Pagamento</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['Pix', 'Cartão', 'Dinheiro'].map(method => (
                      <button
                        type="button"
                        key={method}
                        onClick={() => setMeioPagamento(method)}
                        className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                          meioPagamento === method
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-background border-foreground/5 text-muted hover:text-white'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Unified Total */}
                <div className="pt-4 border-t border-foreground/5 flex justify-between items-end">
                  <div>
                    <span className="text-xs text-muted font-bold uppercase">Valor Final</span>
                    <p className="text-2xl font-black text-white">
                      R$ {isPrivateMode ? '•••' : total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-primary hover:bg-opacity-95 text-background font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-[0_0_20px_rgba(0,200,83,0.2)]"
                  >
                    Finalizar Venda
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

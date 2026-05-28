import React, { useState } from 'react';
import { Produto, Transacao } from '../types';
import { ShoppingCart, Plus, Minus, Search, Tag, Check, CreditCard, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PDVProps {
  produtos: Produto[];
  onAddTransacao: (transacao: Omit<Transacao, 'id'>) => void;
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

    // Create entry transaction
    onAddTransacao({
      tipo: 'entrada',
      descricao: descriptionText,
      valor: total,
      categoria: 'Vendas (PDV)',
      data: new Date().toISOString().split('T')[0],
      tipo_registro: 'imediato',
      status: 'pago',
      meio_pagamento: meioPagamento
    });

    setRecentTotal(total);
    setCart([]);
    setDiscount(0);
    setSaleSuccess(true);
    setTimeout(() => setSaleSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Visual Header / Caixa Banner */}
      <div className="relative overflow-hidden bg-secondary border border-foreground/5 p-6 rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-2 inline-block">
            Frente de Caixa (PDV)
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
        {/* Left Side: Product Selector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
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

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full bg-secondary/50 border border-dashed border-foreground/5 p-12 rounded-3xl text-center text-muted">
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
                    onClick={() => addToCart(p)}
                    whileTap={{ scale: isOutOfStock ? 1 : 0.98 }}
                    className={`bg-secondary border text-left p-4 rounded-3xl flex flex-col justify-between h-36 transition-all ${
                      isOutOfStock 
                        ? 'opacity-40 border-foreground/5 cursor-not-allowed' 
                        : 'border-foreground/5 hover:border-primary/20'
                    }`}
                  >
                    <div>
                      <span className="text-[9px] uppercase font-bold text-muted bg-background px-2 py-0.5 rounded-md">
                        {p.categoria}
                      </span>
                      <h4 className="text-sm font-bold text-white line-clamp-2 mt-1.5">{p.nome}</h4>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <div>
                        {isOutOfStock ? (
                          <span className="text-[9px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">Sem Estoque</span>
                        ) : (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isLowStock ? 'text-yellow-500 bg-yellow-500/10' : 'text-muted'}`}>
                            Qtd: {p.quantidade} un
                          </span>
                        )}
                        <p className="text-base font-extrabold text-primary mt-1">
                          R$ {isPrivateMode ? '•••' : p.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl flex items-center justify-center transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
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

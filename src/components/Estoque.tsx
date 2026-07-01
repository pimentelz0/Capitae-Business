import React, { useState } from 'react';
import { Produto } from '../types';
import { Plus, Pencil, Trash2, ShieldAlert, Layers, ShieldCheck, DollarSign, Package, PlusCircle, MinusCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EstoqueProps {
  produtos: Produto[];
  onAddProduto: (produto: Omit<Produto, 'id'>) => void;
  onUpdateProduto: (produto: Produto) => void;
  onDeleteProduto: (id: string) => void;
  isPrivateMode: boolean;
}

export default function Estoque({ produtos, onAddProduto, onUpdateProduto, onDeleteProduto, isPrivateMode }: EstoqueProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProdutoId, setEditingProdutoId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Produto | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [quantidade, setQuantidade] = useState<number>(0);
  const [estoqueMinimo, setEstoqueMinimo] = useState<number>(5);
  const [precoCusto, setPrecoCusto] = useState<number | null>(null);
  const [precoVenda, setPrecoVenda] = useState<number>(0);
  const [codigoBarras, setCodigoBarras] = useState('');

  // Edit form wrapper triggers
  const startEdit = (p: Produto) => {
    setEditingProdutoId(p.id);
    setNome(p.nome);
    setCategoria(p.categoria);
    setQuantidade(p.quantidade);
    setEstoqueMinimo(p.estoque_minimo);
    setPrecoCusto(p.preco_custo !== undefined ? p.preco_custo : null);
    setPrecoVenda(p.preco_venda);
    setCodigoBarras(p.codigo_barras || '');
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setEditingProdutoId(null);
    setNome('');
    setCategoria('');
    setQuantidade(0);
    setEstoqueMinimo(5);
    setPrecoCusto(null);
    setPrecoVenda(0);
    setCodigoBarras('');
    setShowAddForm(false);
  };

  // Submit product creation or update
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isPrecoCustoValid = precoCusto === null || precoCusto === undefined || precoCusto >= 0;
    if (!nome || !categoria || quantidade < 0 || !isPrecoCustoValid || precoVenda < 0) {
      alert('Preencha os campos obrigatórios com valores válidos.');
      return;
    }

    if (editingProdutoId) {
      onUpdateProduto({
        id: editingProdutoId,
        nome,
        categoria,
        quantidade,
        estoque_minimo: estoqueMinimo,
        preco_custo: precoCusto,
        preco_venda: precoVenda,
        codigo_barras: codigoBarras.trim() || null
      });
    } else {
      onAddProduto({
        nome,
        categoria,
        quantidade,
        estoque_minimo: estoqueMinimo,
        preco_custo: precoCusto,
        preco_venda: precoVenda,
        codigo_barras: codigoBarras.trim() || null
      });
    }

    handleCancel();
  };

  // Smart background global barcode scanner listener for Estoque screen
  React.useEffect(() => {
    if (!showAddForm) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      const activeElement = document.activeElement;
      const isFocusedOnInput = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.getAttribute('contenteditable') === 'true'
      );

      // Enter key finishes the barcode
      if (e.key === 'Enter') {
        const cleanCode = buffer.trim();
        if (cleanCode.length >= 3) {
          e.preventDefault();
          setCodigoBarras(cleanCode);

          // Clean up any leaked first character from active input
          if (isFocusedOnInput && activeElement && (activeElement instanceof HTMLInputElement)) {
            const firstChar = cleanCode.charAt(0);
            if (activeElement.value.endsWith(firstChar)) {
              activeElement.value = activeElement.value.slice(0, -1);
              activeElement.dispatchEvent(new Event('input', { bubbles: true }));
              
              // Trigger onChange handlers manually if applicable
              if (activeElement.placeholder?.includes('Coca-Cola')) {
                setNome(activeElement.value);
              } else if (activeElement.placeholder?.includes('Bebidas')) {
                setCategoria(activeElement.value);
              }
            }
          }
        }
        buffer = '';
        return;
      }

      if (e.key.length !== 1) return;

      const isScannerSpeed = timeDiff < 50;
      if (isFocusedOnInput && !isScannerSpeed) {
        buffer = '';
      }

      if (isScannerSpeed && buffer.length > 0) {
        e.preventDefault();
      }

      buffer += e.key;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAddForm]);

  // Micro adjustments in-line
  const adjustQty = (produto: Produto, increment: number) => {
    onUpdateProduto({
      ...produto,
      quantidade: Math.max(0, produto.quantidade + increment)
    });
  };

  // Stats
  const totalItems = produtos.length;
  const lowStockItems = produtos.filter(p => p.quantidade <= p.estoque_minimo && p.quantidade > 0).length;
  const outOfStockItems = produtos.filter(p => p.quantidade === 0).length;
  
  const investidoTotal = produtos.reduce((sum, p) => sum + ((p.preco_custo || 0) * p.quantidade), 0);
  const faturamentoEstimado = produtos.reduce((sum, p) => sum + (p.preco_venda * p.quantidade), 0);
  const retornoEstimado = faturamentoEstimado - investidoTotal;

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="relative overflow-hidden bg-secondary border border-foreground/5 p-6 rounded-[32px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#00C853] bg-[#00C853]/10 px-3 py-1.5 rounded-full mb-2 inline-block font-sans">
            Garantia de Abastecimento
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">Controle de Estoque</h1>
          <p className="text-xs text-muted mt-1">Estoque inteligente com alertas automáticos de reposição para comércios.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            console.log('Estoque: Cadastrar Produto button clicked! Current state:', showAddForm);
            if (showAddForm) {
              handleCancel();
            } else {
              setShowAddForm(true);
            }
          }}
          className="relative z-20 cursor-pointer px-6 py-3.5 bg-primary hover:bg-opacity-95 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-[0_4px_20px_rgba(0,200,83,0.25)] active:scale-98 flex items-center gap-2"
        >
          <Plus className="w-4 h-4 font-black" />
          Cadastrar Produto
        </button>
      </div>

      {/* Grid of Inventory Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total catalog items */}
        <div className="bg-secondary p-5 rounded-3xl border border-foreground/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-scaleIn">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] text-muted font-black uppercase tracking-widest leading-none mb-1">Total de Itens</p>
            <h3 className="text-3xl font-black text-white leading-none tracking-tight">{totalItems}</h3>
          </div>
        </div>

        {/* Low Stock count */}
        <div className="bg-secondary p-5 rounded-3xl border border-foreground/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] text-muted font-black uppercase tracking-widest leading-none mb-1">Estoque Baixo</p>
            <h3 className="text-3xl font-black text-yellow-500 leading-none tracking-tight">{lowStockItems} <span className="text-xs text-muted font-medium">itens</span></h3>
          </div>
        </div>

        {/* Out of Stock count */}
        <div className="bg-secondary p-5 rounded-3xl border border-foreground/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] text-muted font-black uppercase tracking-widest leading-none mb-1">Sem Estoque</p>
            <h3 className="text-3xl font-black text-red-500 leading-none tracking-tight">{outOfStockItems} <span className="text-xs text-muted font-medium">itens</span></h3>
          </div>
        </div>

        {/* Total Cost Invested */}
        <div className="bg-secondary p-5 rounded-3xl border border-foreground/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[9px] text-muted font-black uppercase tracking-widest leading-none mb-1">Ativo do Estoque</p>
            <h3 className="text-3xl font-black text-emerald-400 leading-none tracking-tight">
              R$ {isPrivateMode ? '•••' : investidoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </h3>
          </div>
        </div>
      </div>

      {/* Slide down Product Entry / Edit Form Overlay Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-secondary border border-foreground/5 rounded-[32px] shadow-2xl overflow-hidden animate-fadeIn my-auto">
            <div className="p-6 border-b border-foreground/5 bg-background/60 flex justify-between items-center relative z-10">
              <h3 className="font-bold text-base text-white">
                {editingProdutoId ? `Editar Produto: ${nome}` : 'Cadastrar Novo Produto'}
              </h3>
              <button 
                type="button"
                onClick={handleCancel}
                className="text-xs text-muted hover:text-white bg-foreground/5 px-3 py-1.5 rounded-xl transition-all hover:bg-foreground/10"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[80vh] overflow-y-auto relative z-10">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Nome do Produto*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Coca-Cola Lata 350ml, Camiseta Polo G..."
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Categoria*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bebidas, Roupas, Serviços, Alimentos..."
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase flex items-center gap-1">
                    <span>Código de Barras</span>
                    <span className="text-[10px] text-primary lowercase">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Escaneie com o leitor ou digite..."
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm font-mono transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Quantidade Atual em Estoque*</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quantidade || ''}
                    onChange={(e) => setQuantidade(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm font-bold transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase">Estoque Mínimo de Alerta</label>
                  <input
                    type="number"
                    min="0"
                    value={estoqueMinimo || ''}
                    onChange={(e) => setEstoqueMinimo(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase">Custo de Aquisição (R$) <span className="text-[10px] text-primary lowercase">(opcional)</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 0,00"
                      value={precoCusto === null || precoCusto === undefined || isNaN(precoCusto) ? '' : precoCusto}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        setPrecoCusto(val === null || isNaN(val) ? null : Math.max(0, val));
                      }}
                      className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm font-black text-red-400 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted font-bold uppercase">Preço de Venda (R$)*</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0,00"
                      value={precoVenda || ''}
                      onChange={(e) => setPrecoVenda(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-background border border-foreground/10 p-3.5 rounded-2xl text-white outline-none focus:border-primary text-sm font-black text-emerald-400 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 py-3.5 bg-background border border-foreground/5 hover:bg-foreground/5 text-muted hover:text-white rounded-2xl font-bold transition-all text-xs text-center uppercase"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-primary text-background font-bold rounded-2xl transition-all hover:bg-opacity-95 text-xs text-center uppercase"
                  >
                    Salvar Item
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product List Table */}
      <div className="bg-secondary border border-foreground/5 rounded-[32px] overflow-hidden">
        <div className="p-6 border-b border-foreground/5 bg-background/55">
          <h3 className="font-bold text-base text-white">Catálogo de Produtos e Insumos</h3>
        </div>

        <div className="p-6">
          {produtos.length === 0 ? (
            <div className="py-20 text-center text-muted">
              <AlertCircle className="w-12 h-12 text-muted/30 mx-auto mb-4" />
              <p className="text-base font-bold">Nenhum item cadastrado no estoque.</p>
              <p className="text-xs mt-1">Utilize o botão "Cadastrar Produto" acima para carregar itens ao estoque.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-foreground/5 text-[10px] text-muted font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Produto</th>
                    <th className="py-3 px-2">Categoria</th>
                    <th className="py-3 px-2 text-center">Quantidade</th>
                    <th className="py-3 px-2 text-center">Status Estoque</th>
                    <th className="py-3 px-2 text-right">Preço Custo</th>
                    <th className="py-3 px-2 text-right">Preço Venda</th>
                    <th className="py-3 px-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5 text-sm font-semibold text-white">
                  {produtos.map(p => {
                    const isOutOfStock = p.quantidade === 0;
                    const isLowStock = p.quantidade <= p.estoque_minimo && p.quantidade > 0;
                    
                    return (
                      <tr key={p.id} className="hover:bg-foreground/5 transition-colors group">
                        {/* Name */}
                        <td className="py-3.5 px-2">
                          <p className="font-extrabold text-foreground truncate max-w-xs">{p.nome}</p>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-muted font-mono">ID: #{p.id.substring(0, 8)}</span>
                            {p.codigo_barras && (
                              <span className="text-[10px] text-primary font-mono font-bold flex items-center gap-1" title="Código de barras cadastrado">
                                🏷️ {p.codigo_barras}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-2">
                          <span className="text-xs bg-background border border-foreground/5 px-2.5 py-1 rounded-lg">
                            {p.categoria}
                          </span>
                        </td>

                        {/* Inline Qty Adjust */}
                        <td className="py-3.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => adjustQty(p, -1)}
                              className="text-muted hover:text-red-500 transition-colors"
                              title="Diminuir unidade"
                            >
                              <MinusCircle className="w-5 h-5 pointer-events-auto" />
                            </button>
                            <span className="font-mono text-base font-bold w-8 text-center">{p.quantidade}</span>
                            <button
                              onClick={() => adjustQty(p, 1)}
                              className="text-muted hover:text-emerald-500 transition-colors"
                              title="Aumentar unidade"
                            >
                              <PlusCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </td>

                        {/* Status alert badges */}
                        <td className="py-3.5 px-2 text-center">
                          {isOutOfStock ? (
                            <span className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 border border-red-500/10 px-2.5 py-1 rounded-full">
                              Esgotado
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[10px] font-black uppercase text-yellow-500 bg-yellow-500/10 border border-yellow-500/10 px-2.5 py-1 rounded-full">
                              Baixo (Repor)
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-1 rounded-full">
                              Adequado
                            </span>
                          )}
                        </td>

                        {/* Cost */}
                        <td className="py-3.5 px-2 text-right font-mono font-medium text-red-400">
                          R$ {isPrivateMode ? '•••' : p.preco_custo !== null && p.preco_custo !== undefined ? p.preco_custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-2 text-right font-mono font-bold text-emerald-400">
                          R$ {isPrivateMode ? '•••' : p.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-2 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => startEdit(p)}
                              className="p-1.5 text-muted hover:text-white rounded-lg hover:bg-foreground/5 transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setProductToDelete(p)}
                              className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Custom premium delete confirmation modal overlay */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-secondary border border-foreground/5 rounded-[32px] p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Excluir do Estoque</h3>
                  <p className="text-[9px] text-red-400 font-mono uppercase tracking-widest">Ação Irreversível</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-xs text-muted leading-relaxed">
                  Tem certeza que deseja remover o produto <strong className="text-white">{productToDelete.nome}</strong> do seu estoque?
                </p>
                {productToDelete.quantidade > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 text-[11px] text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p>
                      Este item tem <strong>{productToDelete.quantidade} un.</strong> no estoque. Excluir apagará seu saldo e valor de custo correspondentes.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3 bg-background border border-foreground/5 hover:bg-foreground/5 text-muted hover:text-white rounded-2xl font-bold transition-all text-xs text-center uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProduto(productToDelete.id);
                    setProductToDelete(null);
                  }}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-650 text-white font-bold rounded-2xl transition-all text-xs text-center uppercase cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

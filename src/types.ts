export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  estoque_minimo: number;
  preco_custo: number;
  preco_venda: number;
}

export interface Transacao {
  id: string;
  tipo: 'entrada' | 'saida';
  descricao: string;
  valor: number;
  categoria: string;
  data: string; // ISO date string (YYYY-MM-DD)
  tipo_registro: 'imediato' | 'pagar' | 'receber';
  data_vencimento?: string; // ISO date string (YYYY-MM-DD)
  status: 'pago' | 'pendente';
  meio_pagamento?: string; // Pix, Cartão, Dinheiro (optional, for entries)
  custo_venda?: number; // Embedded cost of products sold
  produto_id?: string; // If single product or quick sale
  produto_qtd?: number; // Quantity of the product
  itens_venda?: { produto_id: string; qtd: number; nome: string }[]; // If multiple items (from PDV cart)
}

export interface CaixaDiario {
  saldo_inicial: number;
  aberto: boolean;
  data_abertura?: string;
}

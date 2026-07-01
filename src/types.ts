export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  estoque_minimo: number;
  preco_custo: number | null;
  preco_venda: number;
  codigo_barras?: string | null;
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
  itens_venda?: { produto_id: string; qtd: number; nome: string; preco_custo?: number | null; custo_pendente?: boolean }[]; // If multiple items (from PDV cart)
  custo_pendente?: boolean;
}

export interface CaixaDiario {
  saldo_inicial: number;
  aberto: boolean;
  data_abertura?: string;
}

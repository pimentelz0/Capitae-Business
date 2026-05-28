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
}

export interface CaixaDiario {
  saldo_inicial: number;
  aberto: boolean;
  data_abertura?: string;
}

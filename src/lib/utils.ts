import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSafeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Data N/A';
  
  try {
    // Para formato YYYY-MM-DD puro (comum no Supabase DATE type),
    // usamos o construtor com números para evitar que o JS interprete como UTC
    // e acabe subtraindo um dia dependendo do fuso horário local.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    }
    
    // Se for uma data ISO completa ou outro formato, tenta o parse direto
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Se falhar, tenta normalizar espaços para T (alguns formatos de BD)
      const normalized = dateStr.replace(' ', 'T');
      const retryDate = new Date(normalized);
      if (!isNaN(retryDate.getTime())) {
        return retryDate.toLocaleDateString('pt-BR');
      }
      return 'Data Inválida';
    }
    
    return date.toLocaleDateString('pt-BR');
  } catch (e) {
    return 'Data Inválida';
  }
}

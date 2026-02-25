
import { InvoiceFile, Transaction } from '../types.ts';

/**
 * Constrói um mapa de invoiceId → data de importação (YYYY-MM-DD).
 * Usado por Dashboard e Reports para determinar o ciclo de cada transação.
 */
export function buildInvoiceDateMap(files: InvoiceFile[]): Record<string, string> {
  const map: Record<string, string> = {};
  files.forEach(f => {
    if (f.id) {
      const date = new Date(f.uploadDate);
      map[f.id] = date.toISOString().split('T')[0];
    }
  });
  return map;
}

/**
 * Determina o ciclo (mês/ano) de uma transação com base na data de importação
 * da fatura ou, para entradas manuais, na data da compra.
 *
 * Regra: se a transação pertence a uma fatura, o ciclo é a data de importação.
 *        se for entrada manual (sem invoice), o ciclo é a data da compra.
 */
export function getCycleInfo(
  t: Transaction,
  invoiceDateMap: Record<string, string>
): { label: string; order: number } {
  let refDateStr = '';

  if (t.invoiceId && invoiceDateMap[t.invoiceId]) {
    refDateStr = invoiceDateMap[t.invoiceId];
  } else {
    refDateStr = t.purchaseDate || t.date;
  }

  if (!refDateStr) return { label: 'Sem Ciclo', order: 0 };

  const refDate = new Date(refDateStr);
  const month = refDate.getUTCMonth();
  const year = refDate.getUTCFullYear();

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return {
    label: `${monthNames[month]}/${year.toString().slice(-2)}`,
    order: year * 100 + month
  };
}

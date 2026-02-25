
/**
 * @deprecated Este arquivo será removido na próxima iteração de limpeza (Story 1.3+).
 * Use 'services/ai/index.ts' diretamente.
 *
 * Mantido temporariamente como re-export para evitar breaking changes durante a migração.
 */
export { extractInvoiceData, categorizeTransactions } from './ai/index.ts';
export type { ExtractedTransaction, CategorySuggestion } from './ai/index.ts';
